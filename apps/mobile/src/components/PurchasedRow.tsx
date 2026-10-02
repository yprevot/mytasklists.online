import UNITS from '../../../../packages/ui-data/units.json';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, CheckGlyph, CrossGlyph } from './ui';
import { colors, spacing } from '../theme';
import type { Item } from '../types';
import { API_URL } from '../api/client';

interface Props {
  item: Item;
  onRestore: (item: Item) => void;
  onClose: (item: Item) => void;
  disabled?: boolean;
  first?: boolean;
  onEdit: (item: Item) => void;
}

/** Producto comprado: se muestra tachado y se quita con la "x" */
export function PurchasedRow({ item, onRestore, onClose, disabled, first, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const knownUnit=UNITS.find(u=>u.value===item.unit);
  const unitLabel=knownUnit?(i18n.language.startsWith('en')?knownUnit.en:knownUnit.es):item.unit;
  return (
    <View style={[styles.row, !first && styles.divided]} testID="purchased-item">
      <Pressable
        style={styles.checkbox}
        onPress={() => !disabled && onRestore(item)}
        accessibilityLabel={t('item.restore', { name: item.name })}
        testID="purchased-checkbox"
        hitSlop={8}
      >
        <CheckGlyph size={15} />
      </Pressable>

      <View style={{ flex: 1 }}>
        {item.imageUrl && <Image source={{ uri: item.imageUrl.startsWith('http') ? item.imageUrl : `${API_URL}${item.imageUrl}` }} style={{ width: 56, height: 56, borderRadius: 8, marginBottom: 5 }} />}
        <Text style={styles.name} testID="purchased-name" numberOfLines={1}>
          {item.name}
        </Text>
        {(Number(item.quantity)!==1||item.unit!=='pza')&&<Text style={styles.meta} testID="purchased-quantity">{Number(item.quantity)} {unitLabel}</Text>}
        <View style={styles.metaRow}>
          {item.purchasedByName ? <Text style={styles.meta}>{item.purchasedByName}</Text> : null}
          {item.isRecurring && item.daysUntilReactivation !== null && (
            <Badge
              testID="purchased-return-badge"
              tone="info"
              text={t('item.returnsIn', { count: item.daysUntilReactivation })}
            />
          )}
        </View>
      </View>

      <Pressable onPress={() => onEdit(item)} accessibilityRole="button" accessibilityLabel={`${t('item.edit')}: ${item.name}`} disabled={disabled} style={styles.edit}><Text style={{ color: colors.brand, fontWeight: '700' }}>{t('item.edit')}</Text></Pressable>

      <Pressable
        onPress={() => !disabled && onClose(item)}
        accessibilityLabel={t('item.close', { name: item.name })}
        testID="purchased-close"
        hitSlop={12}
        style={styles.close}
      >
        <CrossGlyph size={14} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    backgroundColor: '#fafbf9',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  meta: { fontSize: 13, color: colors.muted },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  edit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
