import React, { useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { APP_VERSION, onUpdateRequired, type UpdateRequired } from '../api/client';
import { compatApi } from '../api/endpoints';
import { Button, Card } from './ui';
import { colors, spacing } from '../theme';

/**
 * Cuando la API responde 426 esta version de la app ya no es compatible: en vez
 * de dejar pantallas a medio fallar, se bloquea la app y se manda a la tienda.
 * Se pregunta al abrir, y cualquier peticion posterior tambien puede dispararlo.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const [required, setRequired] = useState<UpdateRequired | null>(null);

  useEffect(() => {
    const unsubscribe = onUpdateRequired(setRequired);
    // Sin red se sigue: la primera peticion que llegue hara la misma comprobacion
    compatApi.check().catch(() => undefined);
    return unsubscribe;
  }, []);

  if (!required) return <>{children}</>;

  return (
    <View style={styles.container} testID="update-required-screen">
      <Card>
        <Text style={styles.title}>Actualiza la app</Text>
        <Text style={styles.body}>{required.message}</Text>
        <Text style={styles.versions} testID="update-required-versions">
          Tienes la version {APP_VERSION}
          {required.minVersion ? ` y se necesita la ${required.minVersion} o posterior.` : '.'}
        </Text>
        {required.storeUrl ? (
          <Button
            title="Ir a la tienda"
            onPress={() => Linking.openURL(required.storeUrl!)}
            testID="open-store"
            style={{ marginTop: spacing.lg }}
          />
        ) : (
          <Text style={styles.versions}>Busca ListaDeCompras en la tienda de tu telefono.</Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  versions: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: spacing.md },
});
