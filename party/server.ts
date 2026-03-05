import { routePartykitRequest, Server } from "partyserver";
import type { Connection, ConnectionContext } from "partyserver";
import type { GameState, Action } from "../engine/types";
import { createInitialState, resolveAction } from "../engine/index";

export class Wilds extends Server {
  state: GameState | null = null;

  onStart() {
    this.state = createInitialState(this.name);
    console.log(`[${this.name}] Room started`);
  }

  onConnect(conn: Connection, _ctx: ConnectionContext) {
    this.sendTo(conn, { type: "state_sync", state: this.state! });
  }

  onMessage(sender: Connection, message: string | ArrayBuffer) {
    let action: Action;
    try {
      action = JSON.parse(message as string);
    } catch {
      this.sendTo(sender, { type: "error", message: "Invalid message format" });
      return;
    }

    console.log(`[${this.name}] Action:`, action.type);

    const [newState, events] = resolveAction(this.state!, action);
    this.state = newState;

    this.broadcast(JSON.stringify({
      type: "state_update",
      events,
      state: this.state,
    }));
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
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
