import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, CheckGlyph, CrossGlyph } from './ui';
import { colors, spacing } from '../theme';
import type { Item } from '../types';

interface Props {
  item: Item;
  onRestore: (item: Item) => void;
  onClose: (item: Item) => void;
  disabled?: boolean;
  first?: boolean;
}

/** Producto comprado: se muestra tachado y se quita con la "x" */
export function PurchasedRow({ item, onRestore, onClose, disabled, first }: Props) {
  const { t } = useTranslation();
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
        <Text style={styles.name} testID="purchased-name" numberOfLines={1}>
          {item.name}
        </Text>
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
});
