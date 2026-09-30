import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALE_TAGS, currentLanguage } from '../i18n';
import type { es } from '../i18n/es';
import { adminApi } from '../api/endpoints';
import type { ActivityRow } from '../types';

/** Etiqueta (clave del catálogo) y color de cada acción de la bitácora */
const ACTIONS: Record<string, { key: keyof typeof es.activity.actions; variant: string }> = {
  'list.created': { key: 'list_created', variant: 'primary' },
  'list.updated': { key: 'list_updated', variant: 'secondary' },
  'list.deleted': { key: 'list_deleted', variant: 'danger' },
  'list.shared': { key: 'list_shared', variant: 'info' },
  'list.left': { key: 'list_left', variant: 'secondary' },
  'list.member_removed': { key: 'list_member_removed', variant: 'warning' },
  'list.cleared_purchased': { key: 'list_cleared_purchased', variant: 'secondary' },
  'item.created': { key: 'item_created', variant: 'primary' },
  'item.updated': { key: 'item_updated', variant: 'secondary' },
  'item.purchased': { key: 'item_purchased', variant: 'success' },
  'item.restored': { key: 'item_restored', variant: 'warning' },
  'item.archived': { key: 'item_archived', variant: 'secondary' },
  'item.removed': { key: 'item_removed', variant: 'danger' },
  'item.reactivated': { key: 'item_reactivated', variant: 'info' },
};

export function ActivityPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ActivityRow[]>([]);

  useEffect(() => {
    const load = () => adminApi.activity(60).then(setRows).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div data-testid="activity-page">
      <h1 className="lc-page-title mb-4">{t('activity.title')}</h1>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <ul className="list-group list-group-flush" data-testid="activity-list">
            {rows.map((row) => {
              // Una acción nueva que el panel todavía no conoce se muestra tal cual
              const action = ACTIONS[row.action];
              const meta = action
                ? { text: t(`activity.actions.${action.key}`), variant: action.variant }
                : { text: row.action, variant: 'light' };
              return (
                <li
                  key={row.id}
                  className="list-group-item d-flex flex-wrap align-items-center gap-2 px-0"
                  data-testid="activity-row"
                  data-action={row.action}
                >
                  <span className={`badge text-bg-${meta.variant}`}>{meta.text}</span>
                  <span className="fw-semibold">{row.summary ?? '—'}</span>
                  <span className="text-muted small">
                    {row.userName}
                    {row.listName ? ` · ${row.listName}` : ''}
                  </span>
                  <span className="ms-auto text-muted small">
                    {new Date(row.createdAt).toLocaleString(LOCALE_TAGS[currentLanguage()])}
                  </span>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="list-group-item text-center text-muted py-4 px-0">
                {t('activity.empty')}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
