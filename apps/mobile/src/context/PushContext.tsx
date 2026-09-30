import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { devicesApi } from '../api/endpoints';
import { useAuth } from './AuthContext';

interface Value {
  pushToken: string | null;
  permission: 'granted' | 'denied' | 'undetermined';
}

const PushContext = createContext<Value>({ pushToken: null, permission: 'undetermined' });

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registra el dispositivo para recibir notificaciones push de iOS/Android.
 * En la web (usada por las pruebas automatizadas) no hace nada.
 */
export function PushProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<Value['permission']>('undetermined');

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    let cancelled = false;

    const register = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('listas', {
            name: 'Listas compartidas',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2563eb',
          });
        }

        if (!Device.isDevice) return;

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (cancelled) return;
        setPermission(status as Value['permission']);
        if (status !== 'granted') return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (cancelled) return;

        setPushToken(token);
        await devicesApi.register(
          token,
          Platform.OS === 'ios' ? 'ios' : 'android',
          Device.deviceName ?? undefined,
        );
      } catch {
        /* si falla el registro la app sigue funcionando sin push */
      }
    };

    void register();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <PushContext.Provider value={{ pushToken, permission }}>{children}</PushContext.Provider>
  );
}

export const usePush = (): Value => useContext(PushContext);
