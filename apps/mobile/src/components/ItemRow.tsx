import UNITS from '../../../../packages/ui-data/units.json';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui';
import { colors, spacing } from '../theme';
import type { Item } from '../types';

interface Props {
  item: Item;
  onPurchase: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
  /** Primera fila de la hoja: sin filete arriba */
  first?: boolean;
}

/**
 * Producto pendiente. El estado se lee en el aro del check y en la etiqueta:
 * gris (una sola vez), etiqueta amarilla (recurrente al día) y rojo (vencido).
 */
export function ItemRow({ item, onPurchase, onLongPress, disabled, first }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <Pressable
      testID="pending-item"
      accessibilityLabel={t('item.markPurchased', { name: item.name })}
      onPress={() => !disabled && onPurchase(item)}
      onLongPress={() => onLongPress?.(item)}
      style={({ pressed }) => [
        styles.row,
        !first && styles.divided,
        item.isOverdue && { backgroundColor: colors.dangerSoft },
        pressed && { backgroundColor: item.isOverdue ? '#fbe3dd' : '#f8faf7' },
      ]}
    >
      <View
        style={[styles.checkbox, item.isOverdue && { borderColor: colors.danger }]}
        testID="item-checkbox"
      />

      <View style={{ flex: 1 }}>
        <Text
          style={[styles.name, item.isOverdue && { color: colors.dangerInk }]}
          testID="item-name"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {item.quantity} {UNITS.find(u=>u.value===item.unit)?.[i18n.language.startsWith('en')?'en':'es'] || item.unit}
          </Text>
          {item.isRecurring && (
            <Badge
              testID="item-recurrence-badge"
              tone={item.isOverdue ? 'muted' : 'info'}
              text={t('item.every', { count: item.recurrenceDays ?? 0 })}
            />
          )}
          {item.isOverdue ? (
            <Badge testID="item-overdue-badge" tone="danger" text={t('item.overdue', { count: item.daysOverdue })} />
          ) : item.isRecurring && item.daysUntilDue !== null ? (
            <Text style={styles.meta}>{t('item.dueIn', { count: item.daysUntilDue })}</Text>
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
    minHeight: 64,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink, letterSpacing: -0.15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: colors.inkSoft },
});
