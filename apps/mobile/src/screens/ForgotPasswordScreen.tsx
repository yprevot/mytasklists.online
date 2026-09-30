import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Field } from '../components/ui';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

/**
 * Pide el enlace de recuperacion. El enlace del correo abre la app web, donde se
 * elige la contrasena nueva; despues se entra con ella desde aqui.
 */
export function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError(t('forgot.invalidEmail'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await authApi.forgotPassword(email.trim().toLowerCase());
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('forgot.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="forgot-screen">
      <Card>
        <Text style={styles.title}>{t('forgot.title')}</Text>
        {message ? (
          <Text style={styles.body} testID="forgot-sent">
            {message} {t('forgot.spamHint')}
          </Text>
        ) : (
          <>
            <Text style={[styles.body, { marginBottom: spacing.lg }]}>
              {t('forgot.subtitle')}
            </Text>
            <Field
              label={t('common.email')}
              testID="forgot-email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              error={error ?? undefined}
            />
            <Button title={t('forgot.submit')} onPress={submit} loading={loading} testID="forgot-submit" />
          </>
        )}
        <Button
          title={t('common.back')}
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.md }}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
});
