import React, { useCallback, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider, useSocketEvent } from './src/context/SocketContext';
import { PushProvider } from './src/context/PushContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { InAppToast, type ToastPayload } from './src/components/InAppToast';

/**
 * Muestra los avisos en vivo mientras la app esta abierta.
 * Con la app cerrada o en segundo plano el mismo aviso llega como push de
 * iOS/Android desde el backend.
 */
function LiveNotifications() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useSocketEvent<{ id: string; title: string; body: string; type: string }>(
    'notification',
    useCallback((notification) => {
      setToast({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        tone:
          notification.type === 'item.overdue'
            ? 'warning'
            : notification.type === 'item.purchased'
              ? 'success'
              : 'info',
      });
    }, []),
  );

  return <InAppToast toast={toast} onHide={() => setToast(null)} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <SocketProvider>
          <PushProvider>
            <RootNavigator />
            <LiveNotifications />
          </PushProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
