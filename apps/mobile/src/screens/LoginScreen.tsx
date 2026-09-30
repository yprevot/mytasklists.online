import React, { useCallback, useState } from 'react';
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
import { GoogleSignInButton, googleConfigured } from '../components/GoogleSignInButton';
import { useAuth, type LoginStep } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

export function LoginScreen({ navigation }: any) {
  const { login, verifyMfa, loginWithApple, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const afterStep = (step: LoginStep) => {
    if (step.status === 'mfa') setMfaToken(step.mfaToken);
  };

  const run = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesion');
      if (err instanceof ApiError && err.status === 401 && /vuelve/i.test(err.message)) {
        setMfaToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const submit = () => run(async () => afterStep(await login(email.trim().toLowerCase(), password)));

  const submitCode = () => {
    if (!mfaToken) return;
    void run(() => verifyMfa(mfaToken, code.trim()));
  };

  const googleSignIn = useCallback(
    (idToken: string) => void run(async () => afterStep(await loginWithGoogle(idToken))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loginWithGoogle],
  );

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
      await run(async () =>
        afterStep(await loginWithApple(credential.identityToken!, fullName || undefined)),
      );
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
        <Text style={styles.title}>{mfaToken ? 'Verificacion en dos pasos' : 'Inicia sesion'}</Text>
        <Text style={styles.subtitle}>Tus listas compartidas, siempre sincronizadas.</Text>

        {mfaToken ? (
          <View testID="mfa-step">
            <Field
              label="Codigo de tu app autenticadora (o de recuperacion)"
              testID="mfa-code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoFocus
              placeholder="123456"
            />
            {error ? (
              <Text style={styles.error} testID="login-error">
                {error}
              </Text>
            ) : null}
            <Button title="Verificar" onPress={submitCode} loading={loading} testID="mfa-submit" />
            <Pressable onPress={() => setMfaToken(null)}>
              <Text style={styles.link}>Volver</Text>
            </Pressable>
          </View>
        ) : (
          <>
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

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} testID="go-forgot-password">
              <Text style={styles.link}>¿Olvidaste tu contrasena?</Text>
            </Pressable>

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

            {googleConfigured ? (
              <GoogleSignInButton onIdToken={googleSignIn} onError={setError} />
            ) : (
              <Button
                title="Continuar con Google"
                variant="ghost"
                onPress={() => navigation.navigate('SocialHelp', { provider: 'Google' })}
                testID="google-login"
                style={{ marginBottom: spacing.md }}
              />
            )}

            <Pressable onPress={() => navigation.navigate('Register')} testID="go-register">
              <Text style={styles.link}>¿Aun no tienes cuenta? Registrate</Text>
            </Pressable>
          </>
        )}
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
