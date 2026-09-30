import type { Item } from '../types';

interface Props {
  item: Item;
  disabled?: boolean;
  onRestore: (item: Item) => void;
  onClose: (item: Item) => void;
}

const relativeDate = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  return `hace ${diffDays} dias`;
};

/**
 * Fila de la lista de abajo (productos ya comprados).
 * Se muestran tachados y se quitan manualmente con la "x".
 */
export function PurchasedItem({ item, disabled, onRestore, onClose }: Props) {
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
        aria-label={`Regresar ${item.name} a pendientes`}
        data-testid="purchased-checkbox"
      />

      <div className="flex-grow-1 min-w-0">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="lc-item-name text-truncate" data-testid="purchased-name">
            {item.name}
          </span>
          <span className="text-muted small" data-testid="purchased-meta">
            {item.purchasedByName ? `${item.purchasedByName} · ` : ''}
            {relativeDate(item.purchasedAt)}
          </span>
          {item.isRecurring && item.daysUntilReactivation !== null && (
            <span className="badge text-bg-info" data-testid="purchased-return-badge">
              <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
              vuelve en {item.daysUntilReactivation} d
            </span>
          )}
        </div>
      </div>

      <button
        className="btn btn-sm btn-link text-secondary lc-close-btn"
        type="button"
        onClick={() => onClose(item)}
        disabled={disabled}
        aria-label={`Quitar ${item.name} de la lista de comprados`}
        title="Quitar de la lista"
        data-testid="purchased-close"
      >
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>
    </li>
  );
}
