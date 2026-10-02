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
import { SOCKET_URL, tokens, api } from '../api/client';
import { useAuth } from './AuthContext';

interface Value {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<Value>({ socket: null, connected: false });

/** Conexión en vivo con el backend mientras haya sesión iniciada */
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
      // Función: cada reconexión usa el access token vigente (rota cada 15 min)
      auth: (callback) => callback({ token: tokens.access ?? accessToken }),
      reconnection: true,
    });
    socket.on('connect', () => setConnected(true));
    let disposed = false;
    let recovering = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 5000;
    const recover = async () => {
      if (disposed || recovering) return;
      recovering = true;
      try {
        // The HTTP client rotates expired credentials and clears revoked sessions.
        await api.get('/auth/me');
        retryDelay = 5000;
        if (!disposed) socket.connect();
      } catch {
        if (!disposed && tokens.refresh) {
          retryTimer = setTimeout(() => { retryTimer = null; void recover(); }, retryDelay);
          retryDelay = Math.min(30000, retryDelay * 2);
        }
      } finally { recovering = false; }
    };
    socket.on('disconnect', reason => {
      setConnected(false);
      if (reason === 'io server disconnect') void recover();
    });
    socket.on('connect_error', error => {
      setConnected(false);
      if (/token|sesión|session/i.test(error.message)) { socket.disconnect(); void recover(); }
    });

    socketRef.current = socket;
    force((value) => value + 1);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
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
