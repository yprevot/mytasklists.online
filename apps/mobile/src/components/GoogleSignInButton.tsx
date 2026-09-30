import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Button } from './ui';

// Cierra la ventana del navegador al volver del flujo (necesario en web)
WebBrowser.maybeCompleteAuthSession();

const extra = (Constants.expoConfig?.extra ?? {}) as {
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  googleWebClientId?: string;
};

const clientIds = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || extra.googleIosClientId || undefined,
  androidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || extra.googleAndroidClientId || undefined,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || extra.googleWebClientId || undefined,
};

/** Hay client id de Google para la plataforma en la que corre la app */
export const googleConfigured = Boolean(
  Platform.select({
    ios: clientIds.iosClientId,
    android: clientIds.androidClientId,
    default: clientIds.webClientId,
  }),
);

interface Props {
  onIdToken: (idToken: string) => void;
  onError: (message: string) => void;
}

/**
 * Inicio de sesión nativo con Google: el SDK devuelve un id_token que el
 * backend verifica en POST /auth/google/token. Requiere un development build
 * (no funciona en Expo Go) y los client id de iOS/Android en app.json.
 * Solo se monta cuando `googleConfigured` es true: el hook exige el client id.
 */
export function GoogleSignInButton({ onIdToken, onError }: Props) {
  const { t } = useTranslation();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(clientIds);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      if (idToken) onIdToken(idToken);
      else onError(t('google.noToken'));
    } else if (response?.type === 'error') {
      onError(t('google.failed'));
    }
  }, [response, onIdToken, onError, t]);

  return (
    <Button
      title={t('login.google')}
      variant="ghost"
      disabled={!request}
      onPress={() => void promptAsync()}
      testID="google-login"
      style={{ marginBottom: 16 }}
    />
  );
}
