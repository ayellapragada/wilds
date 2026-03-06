import type { Action, GameEvent, ConnectionRole, TVViewState, PhoneViewState } from "../../engine/types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type ServerMessage =
  | { type: "state_sync"; state: TVViewState | PhoneViewState }
  | { type: "state_update"; state: TVViewState | PhoneViewState; events: GameEvent[] }
  | { type: "error"; message: string };

const BASE_URL = import.meta.env.DEV
  ? "ws://localhost:8787"
  : "wss://wilds.ayellapragada.workers.dev";

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10000;

export function createConnection(
  roomCode: string,
  options: { role: ConnectionRole; token?: string } = { role: "tv" },
  callbacks: {
    onMessage: (msg: ServerMessage) => void;
    onStatusChange: (status: ConnectionStatus) => void;
  }
) {
  const params = new URLSearchParams({ role: options.role });
  if (options.token) params.set("token", options.token);
  const url = `${BASE_URL}/parties/wilds/${roomCode}?${params}`;

  let socket: WebSocket | null = null;
  let retries = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let intentionallyClosed = false;

  function connect() {
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      retries = 0;
      callbacks.onStatusChange("connected");
    });

    socket.addEventListener("message", (event) => {
      callbacks.onMessage(JSON.parse(event.data));
    });

    socket.addEventListener("close", () => {
      if (intentionallyClosed) return;
      attemptReconnect();
    });

    socket.addEventListener("error", () => {
      // close event will fire after error, which triggers reconnect
    });
  }

  function attemptReconnect() {
    if (retries >= MAX_RETRIES) {
      callbacks.onStatusChange("disconnected");
      return;
    }
    callbacks.onStatusChange("reconnecting");
    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retries), MAX_DELAY_MS);
    retries++;
    retryTimeout = setTimeout(connect, delay);
  }

  callbacks.onStatusChange("connecting");
  connect();

  return {
    send(action: Action) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(action));
      }
    },

    close() {
      intentionallyClosed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      socket?.close();
    },
  };
}
