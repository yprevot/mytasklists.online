import { useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';
import type { ActivityRow } from '../types';

const ACTION_LABEL: Record<string, { text: string; variant: string }> = {
  'list.created': { text: 'Lista creada', variant: 'primary' },
  'list.updated': { text: 'Lista editada', variant: 'secondary' },
  'list.deleted': { text: 'Lista eliminada', variant: 'danger' },
  'list.shared': { text: 'Lista compartida', variant: 'info' },
  'list.left': { text: 'Salio de la lista', variant: 'secondary' },
  'list.member_removed': { text: 'Integrante retirado', variant: 'warning' },
  'list.cleared_purchased': { text: 'Comprados vaciados', variant: 'secondary' },
  'item.created': { text: 'Producto agregado', variant: 'primary' },
  'item.updated': { text: 'Producto editado', variant: 'secondary' },
  'item.purchased': { text: 'Producto comprado', variant: 'success' },
  'item.restored': { text: 'Compra deshecha', variant: 'warning' },
  'item.archived': { text: 'Producto cerrado', variant: 'secondary' },
  'item.removed': { text: 'Producto eliminado', variant: 'danger' },
  'item.reactivated': { text: 'Recurrencia reactivada', variant: 'info' },
};

export function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);

  useEffect(() => {
    const load = () => adminApi.activity(60).then(setRows).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div data-testid="activity-page">
      <h1 className="h4 mb-3">Bitacora</h1>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <ul className="list-group list-group-flush" data-testid="activity-list">
            {rows.map((row) => {
              const meta = ACTION_LABEL[row.action] ?? { text: row.action, variant: 'light' };
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
                    {new Date(row.createdAt).toLocaleString('es-MX')}
                  </span>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="list-group-item text-center text-muted py-4 px-0">
                Todavia no hay actividad registrada
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
