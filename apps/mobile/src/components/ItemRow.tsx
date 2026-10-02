import UNITS from '../../../../packages/ui-data/units.json';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui';
import { colors, spacing } from '../theme';
import type { Item } from '../types';
import { API_URL } from '../api/client';

interface Props {
  item: Item;
  onPurchase: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  disabled?: boolean;
  /** Primera fila de la hoja: sin filete arriba */
  first?: boolean;
  onEdit: (item: Item) => void;
}

/**
 * Producto pendiente. El estado se lee en el aro del check y en la etiqueta:
 * gris (una sola vez), etiqueta amarilla (recurrente al día) y rojo (vencido).
 */
export function ItemRow({ item, onPurchase, onLongPress, disabled, first, onEdit }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <View testID="pending-item" style={[
        styles.row,
        !first && styles.divided,
        item.isOverdue && { backgroundColor: colors.dangerSoft },
      ]}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={t('item.markPurchased', { name: item.name })} accessibilityState={{ checked: false }} onPress={() => !disabled && onPurchase(item)} onLongPress={() => onLongPress?.(item)} disabled={disabled} style={({ pressed }) => [styles.checkboxWrap, pressed && { opacity: .65 }]}>
      <View
        style={[styles.checkbox, item.isOverdue && { borderColor: colors.danger }]}
        testID="item-checkbox"
      />
      </Pressable>

      <Pressable style={{ flex: 1 }} onPress={() => !disabled && onPurchase(item)} onLongPress={() => onLongPress?.(item)} disabled={disabled} accessibilityLabel={t('item.markPurchased', { name: item.name })}>
        {item.imageUrl && <Image source={{ uri: item.imageUrl.startsWith('http') ? item.imageUrl : `${API_URL}${item.imageUrl}` }} style={{ width: 56, height: 56, borderRadius: 8, marginBottom: 5 }} />}
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
        {item.note ? <Text style={styles.meta} numberOfLines={2}>{item.note}</Text> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t('item.edit')}: ${item.name}`} onPress={() => onEdit(item)} disabled={disabled} style={styles.edit}><Text style={{ color: colors.brand, fontWeight: '700' }}>{t('item.edit')}</Text></Pressable>
    </View>
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
  checkboxWrap: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  edit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink, letterSpacing: -0.15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 13, color: colors.inkSoft },
});
