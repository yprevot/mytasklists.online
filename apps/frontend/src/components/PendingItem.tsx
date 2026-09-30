import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '../types';

interface Props {
  item: Item;
  disabled?: boolean;
  onPurchase: (item: Item) => void;
  onDelete: (item: Item) => void;
  onAdvanceClock: (item: Item, days: number) => void;
}

const formatQuantity = (item: Item): string =>
  `${Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)} ${item.unit}`;

/**
 * Fila de un producto pendiente.
 *
 * El color del borde indica su estado:
 *  · gris  → producto de una sola vez
 *  · azul  → recurrente dentro de su plazo
 *  · rojo  → recurrente vencido (paso su plazo sin comprarse)
 */
export function PendingItem({ item, disabled, onPurchase, onDelete, onAdvanceClock }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const stateClass = item.isOverdue
    ? 'lc-item--vencido'
    : item.isRecurring
      ? 'lc-item--recurrente'
      : 'lc-item--unico';

  const handlePurchase = () => {
    if (disabled || busy) return;
    setBusy(true);
    onPurchase(item);
    window.setTimeout(() => setBusy(false), 600);
  };

  return (
    <li
      className={`lc-item ${stateClass}`}
      data-testid="pending-item"
      data-item-id={item.id}
      data-item-name={item.name}
      data-recurring={item.isRecurring ? 'true' : 'false'}
      data-overdue={item.isOverdue ? 'true' : 'false'}
    >
      <input
        type="checkbox"
        className="lc-check"
        checked={false}
        onChange={handlePurchase}
        disabled={disabled || busy}
        aria-label={t('item.markPurchased', { name: item.name })}
        data-testid="item-checkbox"
      />

      <div className="flex-grow-1 min-w-0">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="lc-item-name text-truncate" data-testid="item-name">
            {item.name}
          </span>
          <span className="lc-chip" data-testid="item-quantity">
            {formatQuantity(item)}
          </span>

          {item.isRecurring && (
            <span
              className={`lc-chip ${item.isOverdue ? 'lc-chip--late-soft' : 'lc-chip--tag'}`}
              data-testid="item-recurrence-badge"
            >
              <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
              {t('item.every', { count: item.recurrenceDays ?? 0 })}
            </span>
          )}

          {item.isOverdue && (
            <span className="lc-chip lc-chip--late" data-testid="item-overdue-badge">
              <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
              {t('item.overdue', { count: item.daysOverdue })}
            </span>
          )}

          {item.isRecurring && !item.isOverdue && item.daysUntilDue !== null && (
            <span className="lc-hint" data-testid="item-due-hint">
              {t('item.dueIn', { count: item.daysUntilDue })}
            </span>
          )}

          {item.cycleCount > 0 && (
            <span className="lc-hint" data-testid="item-cycle">
              {t('item.cycle', { count: item.cycleCount + 1 })}
            </span>
          )}
        </div>
        {item.note && <div className="lc-hint mt-1">{item.note}</div>}
      </div>

      <div className="d-flex align-items-center gap-1 flex-shrink-0">
        {item.isRecurring && (
          <div className="dropdown">
            <button
              className="lc-icon-btn"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              aria-label={t('item.clockMenu', { name: item.name })}
              data-testid="item-clock-menu"
            >
              <i className="bi bi-clock-history" aria-hidden="true" />
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <h6 className="dropdown-header">{t('item.simulate')}</h6>
              </li>
              {[1, 7, 14, 30].map((days) => (
                <li key={days}>
                  <button
                    className="dropdown-item"
                    type="button"
                    onClick={() => onAdvanceClock(item, days)}
                    data-testid={`advance-${days}`}
                  >
                    {t('item.advance', { count: days })}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          className="lc-icon-btn lc-icon-btn--danger"
          type="button"
          onClick={() => onDelete(item)}
          disabled={disabled}
          aria-label={t('item.delete', { name: item.name })}
          data-testid="item-delete"
        >
          <i className="bi bi-trash" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
