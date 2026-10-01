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
import type { ServerEventName, ServerEvents } from '@lista/contracts';
import { useAuth } from './AuthContext';
import { tokenStore } from '../api/client';
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
 * Mantiene la conexión WebSocket viva mientras haya sesión.
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
      // Función: cada reconexión usa el access token vigente, no el del primer connect
      auth: (callback) => callback({ token: tokenStore.access ?? accessToken }),
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

/**
 * Suscripción tipada a un evento del socket con limpieza automática. El nombre del
 * evento y la forma de su payload salen del contrato compartido.
 */
export function useSocketEvent<E extends ServerEventName>(
  event: E,
  handler: (payload: ServerEvents[E]) => void,
): void {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: ServerEvents[E]) => handlerRef.current(payload);
    socket.on(event as string, listener);
    return () => {
      socket.off(event as string, listener);
    };
  }, [socket, event]);
}
