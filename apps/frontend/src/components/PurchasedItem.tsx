import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Item } from '../types';

interface Props {
  item: Item;
  disabled?: boolean;
  onRestore: (item: Item) => void;
  onClose: (item: Item) => void;
}

const relativeDate = (iso: string | null, t: TFunction): string => {
  if (!iso) return '';
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays <= 0) return t('item.today');
  if (diffDays === 1) return t('item.yesterday');
  return t('item.daysAgo', { count: diffDays });
};

/**
 * Fila de la lista de abajo (productos ya comprados).
 * Se muestran tachados y se quitan manualmente con la "x".
 */
export function PurchasedItem({ item, disabled, onRestore, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <li
      className="lc-item lc-item--comprado d-flex align-items-center gap-3 px-3 py-2 mb-2"
      data-testid="purchased-item"
      data-item-id={item.id}
      data-item-name={item.name}
      data-recurring={item.isRecurring ? 'true' : 'false'}
    >
      <input
        type="checkbox"
        className="form-check-input lc-check m-0"
        checked
        onChange={() => onRestore(item)}
        disabled={disabled}
        aria-label={t('item.restore', { name: item.name })}
        data-testid="purchased-checkbox"
      />

      <div className="flex-grow-1 min-w-0">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="lc-item-name text-truncate" data-testid="purchased-name">
            {item.name}
          </span>
          <span className="text-muted small" data-testid="purchased-meta">
            {item.purchasedByName ? `${item.purchasedByName} · ` : ''}
            {relativeDate(item.purchasedAt, t)}
          </span>
          {item.isRecurring && item.daysUntilReactivation !== null && (
            <span className="badge text-bg-info" data-testid="purchased-return-badge">
              <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
              {t('item.returnsIn', { count: item.daysUntilReactivation })}
            </span>
          )}
        </div>
      </div>

      <button
        className="btn btn-sm btn-link text-secondary lc-close-btn"
        type="button"
        onClick={() => onClose(item)}
        disabled={disabled}
        aria-label={t('item.closeLabel', { name: item.name })}
        title={t('item.closeTitle')}
        data-testid="purchased-close"
      >
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
    </li>
  );
}
