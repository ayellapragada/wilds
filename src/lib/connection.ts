import type { GameState, Action, GameEvent } from "../../engine/types";

export type ServerMessage =
  | { type: "state_sync"; state: GameState }
  | { type: "state_update"; state: GameState; events: GameEvent[] }
  | { type: "error"; message: string };

const WS_HOST = "localhost:8787";

export function createConnection(roomCode: string) {
  const url = `ws://${WS_HOST}/parties/wilds/${roomCode}`;
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
