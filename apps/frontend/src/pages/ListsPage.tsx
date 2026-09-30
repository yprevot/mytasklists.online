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

const COLORS = ['#0d6efd', '#198754', '#fd7e14', '#d63384', '#6f42c1', '#20c997'];
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
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">{t('lists.title')}</h1>
          <p className="text-muted small mb-0">
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
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          {t('lists.newList')}
        </button>
      </div>

      {showForm && (
        <form className="card border-0 shadow-sm mb-4" onSubmit={create} data-testid="new-list-form">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-6">
                <label className="form-label small" htmlFor="list-name">
                  {t('lists.name')}
                </label>
                <input
                  id="list-name"
                  className="form-control"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('lists.namePlaceholder')}
                  data-testid="new-list-name"
                  autoFocus
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small">{t('lists.icon')}</label>
                <div className="btn-group w-100" role="group" aria-label={t('lists.iconGroup')}>
                  {ICONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`btn btn-sm ${icon === option ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setIcon(option)}
                      aria-pressed={icon === option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small">{t('lists.color')}</label>
                <div className="d-flex gap-1">
                  {COLORS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className="btn btn-sm rounded-circle border"
                      style={{
                        backgroundColor: option,
                        width: 28,
                        height: 28,
                        outline: color === option ? '2px solid #212529' : 'none',
                      }}
                      onClick={() => setColor(option)}
                      aria-label={t('lists.colorOption', { color: option })}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={creating || !name.trim()}
                data-testid="new-list-submit"
              >
                {creating ? t('lists.creating') : t('lists.create')}
              </button>
              <button className="btn btn-link" type="button" onClick={() => setShowForm(false)}>
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
        <div className="card border-0 shadow-sm">
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
        </div>
      ) : (
        <div className="row g-3" data-testid="list-grid">
          {lists.map((list) => (
            <div className="col-12 col-md-6 col-lg-4" key={list.id}>
              <Link
                to={`/lists/${list.id}`}
                className="text-decoration-none text-body"
                data-testid="list-card-link"
                data-list-name={list.name}
              >
                <div className="card lc-list-card shadow-sm" style={{ borderLeftColor: list.color }}>
                  <div className="card-body">
                    <div className="d-flex align-items-start gap-2 mb-2">
                      <span style={{ fontSize: '1.5rem' }} aria-hidden="true">
                        {list.icon}
                      </span>
                      <div className="flex-grow-1 min-w-0">
                        <h2 className="h6 mb-0 text-truncate" data-testid="list-card-name">
                          {list.name}
                        </h2>
                        {list.description && (
                          <p className="text-muted small mb-0 text-truncate">{list.description}</p>
                        )}
                      </div>
                      {list.isShared && (
                        <span className="badge text-bg-light border" data-testid="list-shared-badge">
                          <i className="bi bi-people me-1" aria-hidden="true" />
                          {list.memberCount}
                        </span>
                      )}
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      <span className="badge text-bg-primary" data-testid="list-pending-count">
                        {t('lists.pending', { count: list.pendingCount })}
                      </span>
                      {list.purchasedCount > 0 && (
                        <span className="badge text-bg-success">
                          {t('lists.purchased', { count: list.purchasedCount })}
                        </span>
                      )}
                      {list.recurringCount > 0 && (
                        <span className="badge text-bg-info">
                          <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                          {list.recurringCount}
                        </span>
                      )}
                      {list.overdueCount > 0 && (
                        <span className="badge text-bg-danger" data-testid="list-overdue-count">
                          {t('lists.overdue', { count: list.overdueCount })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
