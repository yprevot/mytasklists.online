import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Field, ListTile, PlusGlyph } from '../components/ui';
import { listsApi } from '../api/endpoints';
import { useSocketEvent } from '../context/SocketContext';
import { colors, radius, shadow, spacing } from '../theme';
import type { ListSummary } from '../types';

export function ListsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    try {
      setLists(await listsApi.all());
    } catch {
      setLists([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  useSocketEvent('item:created', load);
  useSocketEvent('item:purchased', load);
  useSocketEvent('item:removed', load);
  useSocketEvent('item:reactivated', load);
  useSocketEvent('list:updated', load);
  useSocketEvent('list:member-added', load);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await listsApi.create(name.trim());
      setName('');
      setShowForm(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  if (lists === null) {
    return (
      <View style={styles.center} testID="lists-loading">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID="lists-screen">
      <FlatList
        data={lists}
        keyExtractor={(list) => list.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          showForm ? (
            <View style={styles.form} testID="new-list-form">
              <Field
                label={t('lists.listName')}
                testID="new-list-name"
                value={name}
                onChangeText={setName}
                placeholder={t('lists.namePlaceholder')}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={t('lists.create')}
                  onPress={create}
                  loading={creating}
                  testID="new-list-submit"
                  style={{ flex: 1 }}
                />
                <Button
                  title={t('common.cancel')}
                  variant="ghost"
                  onPress={() => setShowForm(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty} testID="lists-empty">
            <View style={styles.emptyIcon}>
              <View style={styles.emptyCheck} />
            </View>
            <Text style={styles.emptyTitle}>{t('lists.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>
              {t('lists.emptyText')}
            </Text>
          </View>
        }
        renderItem={({ item: list }) => (
          <Pressable
            testID="list-card"
            accessibilityLabel={list.name}
            onPress={() => navigation.navigate('ListDetail', { id: list.id, name: list.name })}
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: '#f8faf7' }]}
          >
            <ListTile icon={list.icon} color={list.color} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="list-card-name" numberOfLines={1}>
                {list.name}
              </Text>
              <View style={styles.badges}>
                <Badge tone="muted" text={t('lists.pending', { count: list.pendingCount })} />
                {list.recurringCount > 0 && <Badge tone="info" text={t('lists.recurring', { count: list.recurringCount })} />}
                {list.overdueCount > 0 && (
                  <Badge tone="danger" text={t('lists.overdue', { count: list.overdueCount })} />
                )}
                {list.isShared && <Badge tone="success" text={t('lists.people', { count: list.memberCount })} />}
              </View>
            </View>
          </Pressable>
        )}
      />

      {!showForm && (
        <Pressable style={styles.fab} onPress={() => setShowForm(true)} testID="new-list-button">
          <PlusGlyph size={22} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  name: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.25 },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: 6, flexWrap: 'wrap' },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyCheck: {
    width: 14,
    height: 26,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: colors.brand,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateY: -3 }],
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: -0.25 },
  emptyBody: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: spacing.xl },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.pop,
  },
});
