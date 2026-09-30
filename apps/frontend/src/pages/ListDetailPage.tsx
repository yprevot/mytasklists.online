import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { itemsApi, listsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket, useSocketEvent } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import { AddItemForm } from '../components/AddItemForm';
import { PendingItem } from '../components/PendingItem';
import { PurchasedItem } from '../components/PurchasedItem';
import { ShareModal } from '../components/ShareModal';
import type { Item, ListDetail } from '../types';

export function ListDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { show } = useToast();
  const { t } = useTranslation();

  const [list, setList] = useState<ListDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const reloadTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await listsApi.detail(id);
      setList(detail);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('detail.loadFailed'));
      setList(null);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Al entrar a la pantalla nos unimos a la sala de la lista
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('list:join', { listId: id });
    return () => {
      socket.emit('list:leave', { listId: id });
    };
  }, [socket, id]);

  /** Recarga agrupada: varios eventos seguidos provocan una sola peticion */
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      void load();
    }, 120);
  }, [load]);

  const onListEvent = useCallback(
    (payload: { listId?: string }) => {
      if (!payload?.listId || payload.listId === id) scheduleReload();
    },
    [id, scheduleReload],
  );

  useSocketEvent('item:created', onListEvent);
  useSocketEvent('item:updated', onListEvent);
  useSocketEvent('item:purchased', onListEvent);
  useSocketEvent('item:restored', onListEvent);
  useSocketEvent('item:removed', onListEvent);
  useSocketEvent('item:reactivated', onListEvent);
  useSocketEvent('item:overdue', onListEvent);
  useSocketEvent('list:updated', onListEvent);
  useSocketEvent('list:member-added', onListEvent);
  useSocketEvent('list:member-removed', onListEvent);
  useSocketEvent('list:deleted', (payload) => {
    if (payload?.listId === id) {
      show({ title: t('detail.deletedTitle'), body: t('detail.deletedBody'), variant: 'warning' });
      navigate('/', { replace: true });
    }
  });

  const notify = (message: string, ok = true) =>
    show({ title: ok ? t('common.done') : t('common.oops'), body: message, variant: ok ? 'success' : 'danger' });

  const guard = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : failure, false);
    } finally {
      setBusy(false);
    }
  };

  // ── Acciones sobre los productos ────────────────────────────────────
  const purchase = (item: Item) =>
    guard(async () => {
      const updated = await itemsApi.purchase(item.id);
      if (updated.isRecurring && updated.nextActivationAt) {
        show({
          title: t('detail.purchasedTitle'),
          body: t('detail.purchasedBody', { name: updated.name, count: updated.recurrenceDays ?? 0 }),
          variant: 'success',
        });
      }
    }, t('detail.failures.purchase'));

  const restore = (item: Item) =>
    guard(() => itemsApi.restore(item.id), t('detail.failures.restore'));

  const close = (item: Item) =>
    guard(() => itemsApi.close(item.id), t('detail.failures.close'));

  const remove = (item: Item) =>
    guard(() => itemsApi.remove(item.id), t('detail.failures.remove'));

  const clearPurchased = () =>
    guard(() => itemsApi.clearPurchased(id), t('detail.failures.clear'));

  const advanceClock = (item: Item, days: number) =>
    guard(async () => {
      const result = await itemsApi.advanceClock(item.id, days);
      show({
        title: t('detail.clockTitle', { count: days }),
        body: t('detail.clockBody', { reactivated: result.reactivated, overdue: result.overdue }),
        variant: 'info',
      });
    }, t('detail.failures.clock'));

  const toggleNotifications = () =>
    guard(async () => {
      if (!list) return;
      await listsApi.setMyNotifications(id, !list.notifyOnChange);
    }, t('detail.failures.notify'));

  const deleteList = () =>
    guard(async () => {
      if (!window.confirm(t('detail.confirmDelete'))) return;
      await listsApi.remove(id);
      navigate('/', { replace: true });
    }, t('detail.failures.deleteList'));

  const overdueCount = useMemo(
    () => (list?.pending ?? []).filter((item) => item.isOverdue).length,
    [list],
  );

  if (error) {
    return (
      <div className="alert alert-danger" role="alert" data-testid="list-error">
        {error}
        <div className="mt-2">
          <Link className="btn btn-sm btn-outline-danger" to="/">
            {t('detail.backToLists')}
          </Link>
        </div>
      </div>
    );
  }

  if (!list || !user) return <Spinner label={t('detail.loading')} />;

  return (
    <div data-testid="list-detail-page" data-list-id={list.id}>
      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-start gap-3 min-w-0">
          <Link to="/" className="btn btn-light btn-sm mt-1" aria-label={t('common.back')} data-testid="back-to-lists">
            <i className="bi bi-arrow-left" aria-hidden="true" />
          </Link>
          <span style={{ fontSize: '2rem' }} aria-hidden="true">
            {list.icon}
          </span>
          <div className="min-w-0">
            <h1 className="h3 mb-1 text-truncate" data-testid="list-title">
              {list.name}
            </h1>
            <div className="d-flex flex-wrap align-items-center gap-2 small text-muted">
              <span data-testid="list-counters">
                {t('detail.counters', { pending: list.pending.length, purchased: list.purchased.length })}
              </span>
              {overdueCount > 0 && (
                <span className="badge text-bg-danger" data-testid="list-overdue-summary">
                  {t('lists.overdue', { count: overdueCount })}
                </span>
              )}
              {list.isShared && (
                <span className="badge text-bg-light border" data-testid="list-members-badge">
                  <i className="bi bi-people me-1" aria-hidden="true" />
                  {t('detail.members', { count: list.memberCount })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="form-check form-switch mb-0" title={t('detail.notifyTitle')}>
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="notify-switch"
              checked={list.notifyOnChange}
              onChange={toggleNotifications}
              disabled={busy}
              data-testid="notify-switch"
            />
            <label className="form-check-label small" htmlFor="notify-switch">
              {t('detail.notify')}
            </label>
          </div>

          <button
            className="btn btn-outline-primary"
            onClick={() => setShowShare(true)}
            data-testid="share-button"
          >
            <i className="bi bi-person-plus me-1" aria-hidden="true" />
            {t('detail.share')}
          </button>

          {list.ownerId === user.id && (
            <button
              className="btn btn-outline-danger"
              onClick={deleteList}
              disabled={busy}
              data-testid="delete-list-button"
              aria-label={t('detail.deleteList')}
            >
              <i className="bi bi-trash" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Alta de productos ──────────────────────────────────────── */}
      <AddItemForm listId={list.id} disabled={busy} onError={(message) => notify(message, false)} />

      {/* ── Pendientes ─────────────────────────────────────────────── */}
      <section className="mb-4" data-testid="pending-section">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="lc-divider-label mb-0">{t('detail.pendingHeading', { count: list.pending.length })}</h2>
        </div>

        {list.pending.length === 0 ? (
          <div className="card border-0 shadow-sm">
            <EmptyState
              icon="bi-check2-circle"
              title={t('detail.allDoneTitle')}
              description={t('detail.allDoneText')}
              testId="pending-empty"
            />
          </div>
        ) : (
          <ul className="list-unstyled mb-0" data-testid="pending-list">
            {list.pending.map((item) => (
              <PendingItem
                key={item.id}
                item={item}
                disabled={busy}
                onPurchase={purchase}
                onDelete={remove}
                onAdvanceClock={advanceClock}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Comprados ──────────────────────────────────────────────── */}
      {list.purchased.length > 0 && (
        <section data-testid="purchased-section">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="lc-divider-label mb-0">{t('detail.purchasedHeading', { count: list.purchased.length })}</h2>
            <button
              className="btn btn-sm btn-link text-secondary"
              onClick={clearPurchased}
              disabled={busy}
              data-testid="clear-purchased"
            >
              {t('detail.clear')}
            </button>
          </div>
          <ul className="list-unstyled mb-0" data-testid="purchased-list">
            {list.purchased.map((item) => (
              <PurchasedItem
                key={item.id}
                item={item}
                disabled={busy}
                onRestore={restore}
                onClose={close}
              />
            ))}
          </ul>
        </section>
      )}

      {showShare && (
        <ShareModal
          list={list}
          currentUserId={user.id}
          onClose={() => setShowShare(false)}
          onChanged={load}
          onNotice={notify}
        />
      )}
    </div>
  );
}
