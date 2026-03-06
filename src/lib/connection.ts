import type { Action, GameEvent, ConnectionRole, TVViewState, PhoneViewState } from "../../engine/types";

export type ServerMessage =
  | { type: "state_sync"; state: TVViewState | PhoneViewState }
  | { type: "state_update"; state: TVViewState | PhoneViewState; events: GameEvent[] }
  | { type: "error"; message: string };

const BASE_URL = import.meta.env.DEV
  ? "ws://localhost:8787"
  : "wss://wilds.ayellapragada.workers.dev";

export function createConnection(
  roomCode: string,
  options: { role: ConnectionRole; token?: string } = { role: "tv" }
) {
  const params = new URLSearchParams({ role: options.role });
  if (options.token) params.set("token", options.token);
  const url = `${BASE_URL}/parties/wilds/${roomCode}?${params}`;
  const socket = new WebSocket(url);

  return {
    socket,

    send(action: Action) {
      socket.send(JSON.stringify(action));
    },

    onMessage(callback: (msg: ServerMessage) => void) {
      socket.addEventListener("message", (event) => {
        callback(JSON.parse(event.data));
      });
    },

    close() {
      socket.close();
    },
  };
}
