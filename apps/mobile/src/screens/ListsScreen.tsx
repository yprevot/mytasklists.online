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
import { Badge, Button, Field } from '../components/ui';
import { listsApi } from '../api/endpoints';
import { useSocketEvent } from '../context/SocketContext';
import { colors, radius, spacing } from '../theme';
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
            <Text style={{ fontSize: 40 }}>🛒</Text>
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
            style={[styles.card, { borderLeftColor: list.color }]}
          >
            <Text style={styles.icon}>{list.icon}</Text>
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
          <Text style={styles.fabText}>+</Text>
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
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 5,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  icon: { fontSize: 24 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: 6, flexWrap: 'wrap' },
  form: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  emptyBody: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: spacing.xl },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b1220',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
});
