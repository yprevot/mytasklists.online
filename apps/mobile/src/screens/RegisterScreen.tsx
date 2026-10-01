import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { PrivacyLink } from '../components/PrivacyLink';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const { t } = useTranslation();
  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 3) next.fullName = t('register.errors.fullName');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = t('register.errors.email');
    if (!/^\+?[0-9]{8,20}$/.test(form.whatsapp.trim()))
      next.whatsapp = t('register.errors.whatsapp');
    if (form.password.length < 8) next.password = t('register.errors.password');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.trim(),
        password: form.password,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('register.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <ScrollView contentContainerStyle={styles.container} testID="register-screen">
        <Text style={styles.title}>{t('register.title')}</Text>
        <Text style={styles.subtitle}>{t('register.subtitle')}</Text>

        <Field
          label={t('register.fullName')}
          testID="register-fullname"
          value={form.fullName}
          onChangeText={update('fullName')}
          error={errors.fullName}
          placeholder={t('register.namePlaceholder')}
        />
        <Field
          label={t('common.email')}
          testID="register-email"
          value={form.email}
          onChangeText={update('email')}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder={t('register.emailPlaceholder')}
        />
        <Field
          label={t('register.whatsapp')}
          testID="register-whatsapp"
          value={form.whatsapp}
          onChangeText={update('whatsapp')}
          error={errors.whatsapp}
          keyboardType="phone-pad"
          placeholder={t('register.whatsappPlaceholder')}
        />
        <Field
          label={t('common.password')}
          testID="register-password"
          value={form.password}
          onChangeText={update('password')}
          error={errors.password}
          secureTextEntry
          placeholder={t('register.passwordPlaceholder')}
        />

        {error ? (
          <Text style={styles.error} testID="register-error">
            {error}
          </Text>
        ) : null}

        <Button title={t('register.submit')} onPress={submit} loading={loading} testID="register-submit" />

        <Pressable onPress={() => navigation.goBack()} testID="go-login">
          <Text style={styles.link}>{t('register.login')}</Text>
        </Pressable>

        <PrivacyLink style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.7 },
  subtitle: { fontSize: 15, color: colors.inkSoft, marginTop: 4, marginBottom: spacing.xl },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: 13 },
  link: { textAlign: 'center', color: colors.brand, marginTop: spacing.lg, fontWeight: '700', fontSize: 15, paddingVertical: 6 },
});
