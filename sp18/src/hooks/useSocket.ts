import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../../shared/types";
import { useEffect, useState } from "react";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socket) {
    socket = io({
      transports: ["websocket"],
    }) as TypedSocket;
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function useSocket() {
  const [socketState, setSocketState] = useState<TypedSocket | null>(null);

  useEffect(() => {
    const s = getSocket();
    setSocketState(s);
    return () => {};
  }, []);

  return { socket: socketState };
}
