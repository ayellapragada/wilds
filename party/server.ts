import { routePartykitRequest, Server } from "partyserver";
import type { Connection, ConnectionContext } from "partyserver";
import type { GameState, Action, ConnectionRole, ConnectionInfo, GameEvent } from "../engine/types";
import { createInitialState, resolveAction, createTVView, createPhoneView } from "../engine/index";
import { strategies, autoBustPenalty } from "../engine/sim/strategies";
import { ADMIN_HTML } from "./admin-page";

const ADMIN_USER = "admin";
const ADMIN_PASS = "password";
const BOT_DELAY_MS = 800;

function checkAuth(request: Request): Response | null {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
    });
  }
  const decoded = atob(auth.slice(6));
  const [user, pass] = decoded.split(":");
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}

function parseConnParams(url: string): { role: ConnectionRole; token: string | null } {
  const parsed = new URL(url);
  const role = (parsed.searchParams.get("role") as ConnectionRole) || "tv";
  const token = parsed.searchParams.get("token");
  return { role, token };
}

export class Wilds extends Server<ConnectionInfo> {
  state: GameState | null = null;

  async onStart() {
    const stored = await this.ctx.storage.get<GameState>("state");
    if (stored) {
      this.state = stored;
      console.log(`[${this.name}] Room restored from storage`);
    } else {
      this.state = createInitialState(this.name);
      this.ctx.storage.put("state", this.state);
      console.log(`[${this.name}] Room started`);
    }
  }

  getConnectionTags(_conn: Connection, ctx: ConnectionContext): string[] {
    const { role } = parseConnParams(ctx.request.url);
    return [role];
  }

  onConnect(conn: Connection<ConnectionInfo>, ctx: ConnectionContext) {
    const { role, token } = parseConnParams(ctx.request.url);

    const trainerId = token && this.state!.trainers[token] ? token : null;
    conn.setState({ role, trainerId });

    if (role === "phone" && trainerId) {
      this.sendTo(conn, { type: "state_sync", state: createPhoneView(this.state!, trainerId) });
    } else {
      this.sendTo(conn, { type: "state_sync", state: createTVView(this.state!) });
    }
  }

  onMessage(sender: Connection<ConnectionInfo>, message: string | ArrayBuffer) {
    let action: Action;
    try {
      action = JSON.parse(message as string);
    } catch {
      this.sendTo(sender, { type: "error", message: "Invalid message format" });
      return;
    }

    console.log(`[${this.name}] Action:`, action.type);

    let [newState, events] = resolveAction(this.state!, action);
    this.state = newState;

    // If join_game succeeded, update the sender's connection state with new trainerId
    if (action.type === "join_game" && events.some((e: GameEvent) => e.type === "trainer_joined")) {
      const joinEvent = events.find((e: GameEvent) => e.type === "trainer_joined") as Extract<GameEvent, { type: "trainer_joined" }>;
      const senderState = sender.state;
      if (senderState) {
        sender.setState({ ...senderState, trainerId: joinEvent.trainerId });
      }
    }

    // Run instant bot actions (hub, world) and schedule delayed route actions
    const botEvents = this.runInstantBotActions();
    events = [...events, ...botEvents];

    this.ctx.storage.put("state", this.state);
    this.broadcastViews(events);

    // Schedule staggered route bot actions if needed
    this.scheduleBotTick();
  }

  async onAlarm() {
    const events = this.runOneRouteBotTick();
    if (events.length > 0) {
      this.ctx.storage.put("state", this.state);
      this.broadcastViews(events);
    }

    // If bots still need to act (still in route with exploring bots), schedule next tick
    // Also handle phase transitions: if route ended and we're now in hub/world, run those instantly
    const instantEvents = this.runInstantBotActions();
    if (instantEvents.length > 0) {
      this.ctx.storage.put("state", this.state);
      this.broadcastViews(instantEvents);
    }

    this.scheduleBotTick();
  }

  async onRequest(request: Request): Promise<Response> {
    const authFail = checkAuth(request);
    if (authFail) return authFail;

    if (request.method === "GET") {
      let connectionCount = 0;
      for (const _ of this.getConnections()) connectionCount++;
      return Response.json({
        roomCode: this.name,
        connections: connectionCount,
        state: this.state,
      });
    }

    if (request.method === "POST") {
      const body = await request.json<{ action: string }>();
      if (body.action === "reset") {
        this.state = createInitialState(this.name);
        this.ctx.storage.put("state", this.state);

        // Send filtered views to all connections, resetting trainerIds
        for (const conn of this.getConnections<ConnectionInfo>()) {
          const connState = conn.state;
          if (connState) {
            conn.setState({ ...connState, trainerId: null });
          }
          this.sendTo(conn, { type: "state_sync", state: createTVView(this.state!) });
        }

        return Response.json({ ok: true, message: "Room reset" });
      }
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  /** Run one action per bot in route phase. Returns events from this tick. */
  private runOneRouteBotTick(): GameEvent[] {
    const allEvents: GameEvent[] = [];
    const botIds = Object.keys(this.state!.botStrategies);
    if (botIds.length === 0 || this.state!.phase !== "route") return allEvents;

    for (const botId of botIds) {
      const trainer = this.state!.trainers[botId];
      if (!trainer || trainer.status !== "exploring") continue;

      const strategyName = this.state!.botStrategies[botId];
      const strategy = strategies[strategyName];
      const action = strategy.route(this.state!, botId);
      const [newState, events] = resolveAction(this.state!, action);
      this.state = newState;
      allEvents.push(...events);

      // Handle bust penalty immediately
      const updated = this.state!.trainers[botId];
      if (updated?.status === "busted") {
        const [penaltyState, penaltyEvents] = resolveAction(this.state!, autoBustPenalty(botId));
        this.state = penaltyState;
        allEvents.push(...penaltyEvents);
      }
    }

    return allEvents;
  }

  /** Run bot actions for hub and world phases (instant, no delay needed). */
  private runInstantBotActions(): GameEvent[] {
    const allEvents: GameEvent[] = [];
    const botIds = Object.keys(this.state!.botStrategies);
    if (botIds.length === 0) return allEvents;

    if (this.state!.phase === "hub") {
      for (const botId of botIds) {
        if (this.state!.hub && this.state!.hub.confirmedTrainers.includes(botId)) continue;

        const strategyName = this.state!.botStrategies[botId];
        const strategy = strategies[strategyName];
        const actions = strategy.hub(this.state!, botId);
        for (const action of actions) {
          const [newState, events] = resolveAction(this.state!, action);
          this.state = newState;
          allEvents.push(...events);
        }
      }
    }

    if (this.state!.phase === "world") {
      for (const botId of botIds) {
        if (this.state!.votes && this.state!.votes[botId] !== undefined) continue;

        const strategyName = this.state!.botStrategies[botId];
        const strategy = strategies[strategyName];
        const action = strategy.world(this.state!, botId);
        const [newState, events] = resolveAction(this.state!, action);
        this.state = newState;
        allEvents.push(...events);
      }
    }

    return allEvents;
  }

  /** Schedule the next bot tick if bots still need to act in route phase. */
  private scheduleBotTick() {
    const botIds = Object.keys(this.state!.botStrategies);
    if (botIds.length === 0 || this.state!.phase !== "route") return;

    const hasExploringBot = botIds.some(id => {
      const trainer = this.state!.trainers[id];
      return trainer && trainer.status === "exploring";
    });

    if (hasExploringBot) {
      this.ctx.storage.setAlarm(Date.now() + BOT_DELAY_MS);
    }
  }

  private broadcastViews(events: GameEvent[]) {
    for (const conn of this.getConnections<ConnectionInfo>()) {
      const connState = conn.state;
      const role = connState?.role ?? "tv";
      const trainerId = connState?.trainerId ?? null;

      if (role === "phone" && trainerId) {
        this.sendTo(conn, {
          type: "state_update",
          events,
          state: createPhoneView(this.state!, trainerId),
        });
      } else {
        this.sendTo(conn, {
          type: "state_update",
          events,
          state: createTVView(this.state!),
        });
      }
    }
  }

  private sendTo(conn: Connection, data: unknown) {
    conn.send(JSON.stringify(data));
  }
}

interface Env {
  Wilds: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return new Response(ADMIN_HTML, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
