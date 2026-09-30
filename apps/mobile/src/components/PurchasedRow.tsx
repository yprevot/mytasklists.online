import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from './ui';
import { colors, radius, spacing } from '../theme';
import type { Item } from '../types';

interface Props {
  item: Item;
  onRestore: (item: Item) => void;
  onClose: (item: Item) => void;
  disabled?: boolean;
}

/** Producto comprado: se muestra tachado y se quita con la "x" */
export function PurchasedRow({ item, onRestore, onClose, disabled }: Props) {
  return (
    <View style={styles.row} testID="purchased-item">
      <Pressable
        style={styles.checkbox}
        onPress={() => !disabled && onRestore(item)}
        accessibilityLabel={`Regresar ${item.name} a pendientes`}
        testID="purchased-checkbox"
      >
        <Text style={styles.checkMark}>✓</Text>
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={styles.name} testID="purchased-name" numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          {item.purchasedByName ? <Text style={styles.meta}>{item.purchasedByName}</Text> : null}
          {item.isRecurring && item.daysUntilReactivation !== null && (
            <Badge
              testID="purchased-return-badge"
              tone="info"
              text={`vuelve en ${item.daysUntilReactivation} d`}
            />
          )}
        </View>
      </View>

      <Pressable
        onPress={() => !disabled && onClose(item)}
        accessibilityLabel={`Quitar ${item.name} de la lista`}
        testID="purchased-close"
        hitSlop={10}
      >
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '900' },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  meta: { fontSize: 12, color: colors.muted },
  close: { fontSize: 16, color: colors.muted, fontWeight: '700', paddingHorizontal: 4 },
});
