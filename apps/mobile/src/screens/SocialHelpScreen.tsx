import React from 'react';
import { Linking, ScrollView, StyleSheet, Text } from 'react-native';
import { Button, Card } from '../components/ui';
import { API_URL } from '../api/client';
import { colors, spacing } from '../theme';

/**
 * Google exige un client id nativo por plataforma. Mientras no se configure en
 * el proyecto de EAS, ofrecemos el flujo web del backend, que devuelve al mismo
 * usuario y funciona en las dos tiendas.
 */
export function SocialHelpScreen({ route, navigation }: any) {
  const provider = route?.params?.provider ?? 'Google';
  const url = `${API_URL}/auth/${provider.toLowerCase()}`;

  return (
    <ScrollView contentContainerStyle={styles.container} testID="social-help-screen">
      <Card>
        <Text style={styles.title}>Continuar con {provider}</Text>
        <Text style={styles.body}>
          Abriremos el inicio de sesion de {provider} en el navegador. Al terminar regresa a la app e
          inicia sesion con el correo de esa cuenta.
        </Text>
        <Button
          title={`Abrir ${provider}`}
          onPress={() => Linking.openURL(url)}
          testID="open-provider"
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Volver"
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
