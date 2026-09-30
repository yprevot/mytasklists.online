import React, { useCallback, useState } from 'react';
import './src/i18n';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider, useSocketEvent } from './src/context/SocketContext';
import { PushProvider } from './src/context/PushContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { InAppToast, type ToastPayload } from './src/components/InAppToast';
import { UpdateGate } from './src/components/UpdateGate';
import type { AppNotification } from './src/types';

/**
 * Muestra los avisos en vivo mientras la app está abierta.
 * Con la app cerrada o en segundo plano el mismo aviso llega como push de
 * iOS/Android desde el backend.
 */
function LiveNotifications() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useSocketEvent(
    'notification',
    useCallback((notification: AppNotification) => {
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
      <StatusBar style="dark" />
      <UpdateGate>
        <AuthProvider>
          <SocketProvider>
            <PushProvider>
              <RootNavigator />
              <LiveNotifications />
            </PushProvider>
          </SocketProvider>
        </AuthProvider>
      </UpdateGate>
    </SafeAreaProvider>
  );
}
