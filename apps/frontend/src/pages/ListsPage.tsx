import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useSocketEvent } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';
import type { ListSummary } from '../types';

const COLORS = ['#1d5b45', '#c8371f', '#d99a00', '#2f6f9f', '#7a3e7e', '#4b5a52'];
const ICONS = ['🛒', '🥑', '🧴', '🔨', '🎉', '🐶'];

export function ListsPage() {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(ICONS[0]);
  const { show } = useToast();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    try {
      setLists(await listsApi.all());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('lists.loadFailed'));
      setLists([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Cualquier cambio en una lista compartida refresca el resumen
  useSocketEvent('item:created', load);
  useSocketEvent('item:purchased', load);
  useSocketEvent('item:removed', load);
  useSocketEvent('item:reactivated', load);
  useSocketEvent('list:updated', load);
  useSocketEvent('list:deleted', load);
  useSocketEvent('list:member-added', load);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await listsApi.create({ name: name.trim(), color, icon });
      setName('');
      setShowForm(false);
      show({ title: t('lists.created'), body: t('lists.createdBody', { name: name.trim() }), variant: 'success' });
      await load();
    } catch (err) {
      show({
        title: t('lists.createFailed'),
        body: err instanceof ApiError ? err.message : t('common.tryAgain'),
        variant: 'danger',
      });
    } finally {
      setCreating(false);
    }
  };

  if (lists === null) return <Spinner label={t('lists.loading')} />;

  return (
    <div data-testid="lists-page">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 className="lc-page-title mb-2">{t('lists.title')}</h1>
          <p className="text-muted mb-0">
            {lists.length === 0
              ? t('lists.none')
              : `${t('lists.count', { count: lists.length })} · ${t('lists.shared', {
                  count: lists.filter((list) => list.isShared).length,
                })}`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm((value) => !value)}
          data-testid="new-list-button"
        >
          <i className="bi bi-plus-lg" aria-hidden="true" />
          {t('lists.newList')}
        </button>
      </div>

      {showForm && (
        <form className="card mb-4 lc-rise" onSubmit={create} data-testid="new-list-form">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-12">
                <label className="form-label" htmlFor="list-name">
                  {t('lists.name')}
                </label>
                <input
                  id="list-name"
                  className="form-control form-control-lg"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('lists.namePlaceholder')}
                  data-testid="new-list-name"
                  autoFocus
                />
              </div>
              <div className="col-12 col-md-6">
                <span className="form-label d-block" id="list-icon-label">
                  {t('lists.icon')}
                </span>
                <div className="d-flex flex-wrap gap-1" role="group" aria-labelledby="list-icon-label">
                  {ICONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="lc-glyph"
                      onClick={() => setIcon(option)}
                      aria-pressed={icon === option}
                      aria-label={option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-12 col-md-6">
                <span className="form-label d-block" id="list-color-label">
                  {t('lists.color')}
                </span>
                <div
                  className="d-flex flex-wrap gap-2 align-items-center"
                  role="group"
                  aria-labelledby="list-color-label"
                  style={{ minHeight: '2.5rem' }}
                >
                  {COLORS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="lc-swatch"
                      style={{ backgroundColor: option }}
                      onClick={() => setColor(option)}
                      aria-pressed={color === option}
                      aria-label={t('lists.colorOption', { color: option })}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="d-flex gap-2 mt-4">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={creating || !name.trim()}
                data-testid="new-list-submit"
              >
                {creating ? t('lists.creating') : t('lists.create')}
              </button>
              <button className="btn btn-link text-secondary" type="button" onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div className="alert alert-danger" role="alert" data-testid="lists-error">
          {error}
        </div>
      )}

      {lists.length === 0 ? (
        <EmptyState
          icon="bi-card-checklist"
          title={t('lists.emptyTitle')}
          description={t('lists.emptyText')}
          testId="lists-empty"
          action={
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              {t('lists.newList')}
            </button>
          }
        />
      ) : (
        <div className="row g-3 lc-stagger" data-testid="list-grid">
          {lists.map((list) => (
            <div className="col-12 col-md-6 col-lg-4" key={list.id}>
              <Link
                to={`/lists/${list.id}`}
                className="lc-list-card"
                style={{ ['--lc-list' as string]: list.color }}
                data-testid="list-card-link"
                data-list-name={list.name}
              >
                <div className="d-flex align-items-start gap-3">
                  <span className="lc-list-tile" aria-hidden="true">
                    {list.icon}
                  </span>
                  <div className="flex-grow-1 min-w-0 pt-1">
                    <h2 className="lc-list-name mb-0 text-truncate" data-testid="list-card-name">
                      {list.name}
                    </h2>
                    {list.description && <p className="text-muted small mb-0 text-truncate">{list.description}</p>}
                  </div>
                  {list.isShared && (
                    <span
                      className="lc-chip"
                      data-testid="list-shared-badge"
                      title={t('detail.members', { count: list.memberCount })}
                    >
                      <i className="bi bi-people" aria-hidden="true" />
                      {list.memberCount}
                    </span>
                  )}
                </div>

                <div className="lc-list-stats">
                  <span className="lc-chip lc-chip--done" data-testid="list-pending-count">
                    {t('lists.pending', { count: list.pendingCount })}
                  </span>
                  {list.purchasedCount > 0 && (
                    <span className="lc-chip">{t('lists.purchased', { count: list.purchasedCount })}</span>
                  )}
                  {list.recurringCount > 0 && (
                    <span className="lc-chip lc-chip--tag">
                      <i className="bi bi-arrow-repeat" aria-hidden="true" />
                      {list.recurringCount}
                    </span>
                  )}
                  {list.overdueCount > 0 && (
                    <span className="lc-chip lc-chip--late" data-testid="list-overdue-count">
                      {t('lists.overdue', { count: list.overdueCount })}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
