import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Badge, Button, SectionLabel } from '../components/ui';
import { ItemRow } from '../components/ItemRow';
import { PurchasedRow } from '../components/PurchasedRow';
import { itemsApi, listsApi } from '../api/endpoints';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { colors, radius, spacing } from '../theme';
import type { Item, ListDetail } from '../types';

const PRESETS = [3, 7, 14, 30];

export function ListDetailScreen({ route, navigation }: any) {
  const listId: string = route.params.id;
  const { socket } = useSocket();

  const [list, setList] = useState<ListDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState(14);
  const [shareEmail, setShareEmail] = useState('');
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = await listsApi.detail(listId);
      setList(detail);
      navigation.setOptions({ title: detail.name });
    } catch {
      Alert.alert('No se pudo cargar la lista');
    }
  }, [listId, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('list:join', { listId });
    return () => {
      socket.emit('list:leave', { listId });
    };
  }, [socket, listId]);

  const onEvent = useCallback(
    (payload: { listId?: string }) => {
      if (!payload?.listId || payload.listId === listId) void load();
    },
    [listId, load],
  );

  useSocketEvent('item:created', onEvent);
  useSocketEvent('item:updated', onEvent);
  useSocketEvent('item:purchased', onEvent);
  useSocketEvent('item:restored', onEvent);
  useSocketEvent('item:removed', onEvent);
  useSocketEvent('item:reactivated', onEvent);
  useSocketEvent('item:overdue', onEvent);
  useSocketEvent('list:updated', onEvent);

  const guard = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (error) {
      Alert.alert('Ups', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addItem = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      isRecurring,
      ...(isRecurring ? { recurrenceDays } : {}),
    };
    setName('');
    void guard(() => itemsApi.create(listId, payload));
  };

  if (!list) {
    return (
      <View style={styles.center} testID="detail-loading">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      testID="list-detail-screen"
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
    >
      {/* ── Alta de producto ─────────────────────────────────────────── */}
      <View style={styles.addCard} testID="add-item-form">
        <TextInput
          testID="item-name-input"
          style={styles.addInput}
          placeholder="Agregar producto…"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />

        <View style={styles.recurRow}>
          <Text style={styles.recurLabel}>Repetir automaticamente</Text>
          <Switch
            testID="item-recurring-switch"
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ true: colors.brand }}
          />
        </View>

        {isRecurring && (
          <View style={styles.presetRow} testID="recurrence-options">
            {PRESETS.map((days) => (
              <Pressable
                key={days}
                testID={`recurrence-preset-${days}`}
                onPress={() => setRecurrenceDays(days)}
                style={[styles.preset, recurrenceDays === days && styles.presetActive]}
              >
                <Text
                  style={[styles.presetText, recurrenceDays === days && styles.presetTextActive]}
                >
                  {days} d
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Button
          title="Agregar"
          onPress={addItem}
          disabled={!name.trim() || busy}
          testID="add-item-button"
          style={{ marginTop: spacing.md }}
        />
      </View>

      {/* ── Cabecera de la lista ─────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          <Badge tone="muted" text={`${list.pending.length} por comprar`} />
          {list.pending.filter((item) => item.isOverdue).length > 0 && (
            <Badge
              tone="danger"
              testID="overdue-summary"
              text={`${list.pending.filter((item) => item.isOverdue).length} vencidos`}
            />
          )}
          {list.isShared && <Badge tone="success" text={`${list.memberCount} personas`} />}
        </View>
        <Pressable onPress={() => setShowShare((value) => !value)} testID="share-button">
          <Text style={styles.linkAction}>Compartir</Text>
        </Pressable>
      </View>

      {showShare && (
        <View style={styles.shareCard} testID="share-form">
          <TextInput
            testID="share-email-input"
            style={styles.addInput}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={shareEmail}
            onChangeText={setShareEmail}
          />
          <Button
            title="Compartir lista"
            testID="share-submit"
            onPress={() =>
              guard(async () => {
                await listsApi.share(listId, shareEmail.trim().toLowerCase());
                setShareEmail('');
                setShowShare(false);
              })
            }
            style={{ marginTop: spacing.sm }}
          />
          <View style={styles.notifyRow}>
            <Text style={styles.recurLabel}>Avisarme de los cambios</Text>
            <Switch
              testID="notify-switch"
              value={list.notifyOnChange}
              onValueChange={(value) => guard(() => listsApi.setMyNotifications(listId, value))}
              trackColor={{ true: colors.brand }}
            />
          </View>
        </View>
      )}

      {/* ── Pendientes ───────────────────────────────────────────────── */}
      <SectionLabel>Por comprar ({list.pending.length})</SectionLabel>
      <View testID="pending-list">
        {list.pending.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            disabled={busy}
            onPurchase={(target: Item) => guard(() => itemsApi.purchase(target.id))}
            onLongPress={(target: Item) =>
              Alert.alert(target.name, '¿Que quieres hacer?', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Eliminar',
                  style: 'destructive',
                  onPress: () => guard(() => itemsApi.remove(target.id)),
                },
                ...(target.isRecurring
                  ? [
                      {
                        text: 'Adelantar 14 dias',
                        onPress: () => guard(() => itemsApi.advanceClock(target.id, 14)),
                      },
                    ]
                  : []),
              ])
            }
          />
        ))}
        {list.pending.length === 0 && (
          <Text style={styles.emptyText} testID="pending-empty">
            No queda nada pendiente en esta lista.
          </Text>
        )}
      </View>

      {/* ── Comprados ────────────────────────────────────────────────── */}
      {list.purchased.length > 0 && (
        <>
          <SectionLabel>Comprados ({list.purchased.length})</SectionLabel>
          <View testID="purchased-list">
            {list.purchased.map((item) => (
              <PurchasedRow
                key={item.id}
                item={item}
                disabled={busy}
                onRestore={(target) => guard(() => itemsApi.restore(target.id))}
                onClose={(target) => guard(() => itemsApi.close(target.id))}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  addCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  addInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  recurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  recurLabel: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  presetRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  preset: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  presetActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  presetText: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  presetTextActive: { color: '#fff' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  linkAction: { color: colors.brand, fontWeight: '700' },
  shareCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  emptyText: {
    color: colors.inkSoft,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
});
