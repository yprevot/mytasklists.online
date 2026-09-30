import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Button, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

export function LoginScreen({ navigation }: any) {
  const { login, loginWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  const appleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple no devolvio el token');
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      await loginWithApple(credential.identityToken, fullName || undefined);
    } catch (err) {
      const message = (err as Error).message ?? '';
      if (!message.includes('ERR_REQUEST_CANCELED')) {
        setError('No se pudo iniciar sesion con Apple');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={styles.container} testID="login-screen">
        <Text style={styles.logo}>🛒</Text>
        <Text style={styles.title}>Inicia sesion</Text>
        <Text style={styles.subtitle}>Tus listas compartidas, siempre sincronizadas.</Text>

        <Field
          label="Correo electronico"
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="tu@correo.com"
        />

        <Field
          label="Contrasena"
          testID="login-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="••••••••"
        />

        {error ? (
          <Text style={styles.error} testID="login-error">
            {error}
          </Text>
        ) : null}

        <Button title="Entrar" onPress={submit} loading={loading} testID="login-submit" />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.divider} />
        </View>

        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={999}
            style={{ height: 48, marginBottom: spacing.md }}
            onPress={appleSignIn}
          />
        ) : null}

        <Button
          title="Continuar con Google"
          variant="ghost"
          onPress={() => navigation.navigate('SocialHelp', { provider: 'Google' })}
          testID="google-login"
          style={{ marginBottom: spacing.md }}
        />

        <Pressable onPress={() => navigation.navigate('Register')} testID="go-register">
          <Text style={styles.link}>¿Aun no tienes cuenta? Registrate</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingTop: spacing.xxl * 2, flexGrow: 1, justifyContent: 'center' },
  logo: { fontSize: 44, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.ink, marginTop: spacing.sm },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.inkSoft,
    marginBottom: spacing.xl,
  },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, fontSize: 12 },
  link: { textAlign: 'center', color: colors.brand, marginTop: spacing.lg, fontWeight: '600' },
});
