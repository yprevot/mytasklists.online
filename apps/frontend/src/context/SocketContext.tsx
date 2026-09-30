import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import type { AppNotification } from '../types';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  notifications: AppNotification[];
  clearNotifications: () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  notifications: [],
  clearNotifications: () => undefined,
});

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

/**
 * Mantiene la conexion WebSocket viva mientras haya sesion.
 * Los avisos que llegan por el canal `notification` se muestran como pop-up.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const { show } = useToast();
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
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
      transports: ['websocket', 'polling'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('notification', (notification: AppNotification) => {
      setNotifications((current) => [notification, ...current].slice(0, 50));
      show({
        title: notification.title,
        body: notification.body,
        variant:
          notification.type === 'item.overdue'
            ? 'warning'
            : notification.type === 'item.purchased'
              ? 'success'
              : 'primary',
      });
    });

    socketRef.current = socket;
    force((value) => value + 1);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, user, show]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketRef.current,
      connected,
      notifications,
      clearNotifications: () => setNotifications([]),
    }),
    [connected, notifications, socketRef.current],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}

/** Suscripcion tipada a un evento del socket con limpieza automatica */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void): void {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
