import React, { useEffect, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { APP_VERSION, onUpdateRequired, type UpdateRequired } from '../api/client';
import { compatApi } from '../api/endpoints';
import { Button, Card } from './ui';
import { colors, spacing } from '../theme';

/**
 * Cuando la API responde 426 esta versión de la app ya no es compatible: en vez
 * de dejar pantallas a medio fallar, se bloquea la app y se manda a la tienda.
 * Se pregunta al abrir, y cualquier petición posterior también puede dispararlo.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [required, setRequired] = useState<UpdateRequired | null>(null);

  useEffect(() => {
    const unsubscribe = onUpdateRequired(setRequired);
    // Sin red se sigue: la primera petición que llegue hará la misma comprobación
    compatApi.check().catch(() => undefined);
    return unsubscribe;
  }, []);

  if (!required) return <>{children}</>;

  return (
    <View style={styles.container} testID="update-required-screen">
      <Card>
        <Text style={styles.title}>{t('update.title')}</Text>
        <Text style={styles.body}>{required.message}</Text>
        <Text style={styles.versions} testID="update-required-versions">
          {t('update.current', { version: APP_VERSION })}
          {required.minVersion ? t('update.needed', { version: required.minVersion }) : '.'}
        </Text>
        {required.storeUrl ? (
          <Button
            title={t('update.store')}
            onPress={() => Linking.openURL(required.storeUrl!)}
            testID="open-store"
            style={{ marginTop: spacing.lg }}
          />
        ) : (
          <Text style={styles.versions}>{t('update.searchStore')}</Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, marginBottom: spacing.sm, letterSpacing: -0.4 },
  body: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  versions: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: spacing.md },
});
