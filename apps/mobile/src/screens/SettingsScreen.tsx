import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { usePush } from '../context/PushContext';
import { useSocket } from '../context/SocketContext';
import { colors, spacing } from '../theme';

export function SettingsScreen() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { pushToken, permission } = usePush();

  if (!user) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg }}
      testID="settings-screen"
    >
      <Card>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.meta}>{user.email}</Text>
        <Text style={styles.meta}>{user.whatsapp ?? 'Sin WhatsApp registrado'}</Text>

        <View style={styles.divider} />

        <Row label="Metodo de registro" value={user.provider} />
        <Row label="Conexion en vivo" value={connected ? 'activa' : 'sin conexion'} />
        <Row
          label="Notificaciones push"
          value={
            permission === 'granted' ? (pushToken ? 'registradas' : 'permitidas') : permission
          }
        />
      </Card>

      <Button
        title="Cerrar sesion"
        variant="danger"
        onPress={logout}
        testID="logout-button"
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { color: colors.inkSoft, fontSize: 13 },
  rowValue: { color: colors.ink, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
});
