import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Field } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { colors, spacing } from '../theme';

export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (form.fullName.trim().length < 3) next.fullName = 'Escribe tu nombre completo';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = 'Correo no valido';
    if (!/^\+?[0-9]{8,20}$/.test(form.whatsapp.trim()))
      next.whatsapp = 'Numero de WhatsApp no valido';
    if (form.password.length < 8) next.password = 'Minimo 8 caracteres';
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
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
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
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Necesitas una cuenta para crear y compartir listas.</Text>

        <Field
          label="Nombre completo"
          testID="register-fullname"
          value={form.fullName}
          onChangeText={update('fullName')}
          error={errors.fullName}
          placeholder="Ana Lopez Garcia"
        />
        <Field
          label="Correo electronico"
          testID="register-email"
          value={form.email}
          onChangeText={update('email')}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="ana@example.com"
        />
        <Field
          label="Numero de WhatsApp"
          testID="register-whatsapp"
          value={form.whatsapp}
          onChangeText={update('whatsapp')}
          error={errors.whatsapp}
          keyboardType="phone-pad"
          placeholder="+5215512345678"
        />
        <Field
          label="Contrasena"
          testID="register-password"
          value={form.password}
          onChangeText={update('password')}
          error={errors.password}
          secureTextEntry
          placeholder="Minimo 8 caracteres"
        />

        {error ? (
          <Text style={styles.error} testID="register-error">
            {error}
          </Text>
        ) : null}

        <Button title="Crear cuenta" onPress={submit} loading={loading} testID="register-submit" />

        <Pressable onPress={() => navigation.goBack()} testID="go-login">
          <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesion</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.inkSoft, marginBottom: spacing.xl },
  error: { color: colors.danger, marginBottom: spacing.md, fontSize: 13 },
  link: { textAlign: 'center', color: colors.brand, marginTop: spacing.lg, fontWeight: '600' },
});
