import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ServerEventName, ServerEvents } from '@lista/contracts';
import { SOCKET_URL, tokens } from '../api/client';
import { useAuth } from './AuthContext';

interface Value {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<Value>({ socket: null, connected: false });

/** Conexion en vivo con el backend mientras haya sesion iniciada */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    if (!accessToken || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      force((value) => value + 1);
      return;
    }

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      // Funcion: cada reconexion usa el access token vigente (rota cada 15 min)
      auth: (callback) => callback({ token: tokens.access ?? accessToken }),
      reconnection: true,
    });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socketRef.current = socket;
    force((value) => value + 1);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, user]);

  const value = useMemo(() => ({ socket: socketRef.current, connected }), [connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = (): Value => useContext(SocketContext);

/** El nombre del evento y la forma de su payload salen del contrato compartido */
export function useSocketEvent<E extends ServerEventName>(
  event: E,
  handler: (payload: ServerEvents[E]) => void,
): void {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: ServerEvents[E]) => ref.current(payload);
    socket.on(event as string, listener);
    return () => {
      socket.off(event as string, listener);
    };
  }, [socket, event]);
}
