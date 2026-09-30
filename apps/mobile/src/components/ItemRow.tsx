import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from './ui';
import { colors, radius, spacing } from '../theme';
import type { Item } from '../types';

interface Props {
  item: Item;
  onPurchase: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
}

/**
 * Producto pendiente. El borde izquierdo cambia de color segun su estado:
 * gris (una sola vez), azul (recurrente al dia) y rojo (recurrente vencido).
 */
export function ItemRow({ item, onPurchase, onLongPress, disabled }: Props) {
  const borderColor = item.isOverdue
    ? colors.danger
    : item.isRecurring
      ? colors.accent
      : colors.line;

  return (
    <Pressable
      testID="pending-item"
      accessibilityLabel={`Marcar ${item.name} como comprado`}
      onPress={() => !disabled && onPurchase(item)}
      onLongPress={() => onLongPress?.(item)}
      style={[
        styles.row,
        { borderLeftColor: borderColor },
        item.isOverdue && { backgroundColor: colors.dangerSoft },
      ]}
    >
      <View style={styles.checkbox} testID="item-checkbox" />

      <View style={{ flex: 1 }}>
        <Text style={styles.name} testID="item-name" numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {item.quantity} {item.unit}
          </Text>
          {item.isRecurring && (
            <Badge
              testID="item-recurrence-badge"
              tone={item.isOverdue ? 'danger' : 'info'}
              text={`cada ${item.recurrenceDays} d`}
            />
          )}
          {item.isOverdue ? (
            <Badge testID="item-overdue-badge" tone="danger" text={`vencido ${item.daysOverdue} d`} />
          ) : item.isRecurring && item.daysUntilDue !== null ? (
            <Text style={styles.meta}>vence en {item.daysUntilDue} d</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3, flexWrap: 'wrap' },
  meta: { fontSize: 12, color: colors.inkSoft },
});
