import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

/**
 * Borrado de la cuenta desde la app, como exigen App Store (5.1.1(v)) y Google Play.
 * Pide la contraseña si la cuenta tiene una y el código de 2FA si está activa. En iOS,
 * si la cuenta entró con Apple, pide a Apple un código nuevo para que el servidor
 * revoque Sign in with Apple.
 */
export function DeleteAccountScreen({ navigation }: any) {
  const { user, forgetSession } = useAuth();
  const { t } = useTranslation();
  const [hasPassword, setHasPassword] = useState(user?.provider === 'local');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    usersApi
      .me()
      .then((profile) => setHasPassword(profile.hasPassword ?? profile.provider === 'local'))
      .catch(() => undefined);
  }, []);

  if (!user) return null;

  const usesApple = user.provider === 'apple' && Platform.OS === 'ios';

  /** Código de un solo uso de Apple; si la persona cancela, se borra sin revocar */
  const appleCode = async (): Promise<string | undefined> => {
    if (!usesApple || !(await AppleAuthentication.isAvailableAsync())) return undefined;
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      return credential.authorizationCode ?? undefined;
    } catch {
      return undefined;
    }
  };

  const remove = async () => {
    setError(null);
    setLoading(true);
    try {
      await usersApi.deleteAccount({
        password: hasPassword ? password : undefined,
        mfaCode: user.mfaEnabled ? code.trim() : undefined,
        appleAuthorizationCode: await appleCode(),
      });
      Alert.alert(t('deleteAccount.doneTitle'), t('deleteAccount.doneText'));
      await forgetSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('deleteAccount.failed'));
      setLoading(false);
    }
  };

  const confirm = () =>
    Alert.alert(t('deleteAccount.confirmTitle'), t('deleteAccount.confirmText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('deleteAccount.submit'), style: 'destructive', onPress: () => void remove() },
    ]);

  const ready = (!hasPassword || password.length > 0) && (!user.mfaEnabled || code.trim().length > 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={styles.container} testID="delete-account-screen">
        <Card>
          <Text style={styles.title}>{t('deleteAccount.heading')}</Text>
          <Text style={styles.body}>{t('deleteAccount.what')}</Text>
          <Text style={styles.body}>{t('deleteAccount.shared')}</Text>
          {usesApple ? <Text style={styles.body}>{t('deleteAccount.apple')}</Text> : null}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          {hasPassword ? (
            <Field
              label={t('deleteAccount.password')}
              testID="delete-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
            />
          ) : null}
          {user.mfaEnabled ? (
            <Field
              label={t('deleteAccount.code')}
              testID="delete-code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
            />
          ) : null}

          {error ? (
            <Text style={styles.error} testID="delete-error">
              {error}
            </Text>
          ) : null}

          <Button
            title={t('deleteAccount.submit')}
            variant="danger"
            onPress={confirm}
            loading={loading}
            disabled={!ready}
            testID="delete-account-submit"
          />
          <Button
            title={t('common.cancel')}
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm, letterSpacing: -0.4 },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: 13 },
});
