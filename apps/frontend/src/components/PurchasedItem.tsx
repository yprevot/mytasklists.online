import UNITS from '../../../../packages/ui-data/units.json';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Item } from '../types';
import { API_URL } from '../api/client';

interface Props {
  item: Item;
  disabled?: boolean;
  onRestore: (item: Item) => void;
  onClose: (item: Item) => void;
  onEdit: (item: Item) => void;
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
export function PurchasedItem({ item, disabled, onRestore, onClose, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const knownUnit=UNITS.find(u=>u.value===item.unit);
  const unitLabel=knownUnit?(i18n.language.startsWith('en')?knownUnit.en:knownUnit.es):item.unit;
  return (
    <li
      className="lc-item lc-item--comprado"
      data-testid="purchased-item"
      data-item-id={item.id}
      data-item-name={item.name}
      data-recurring={item.isRecurring ? 'true' : 'false'}
    >
      <input
        type="checkbox"
        className="lc-check"
        checked
        onChange={() => onRestore(item)}
        disabled={disabled}
        aria-label={t('item.restore', { name: item.name })}
        data-testid="purchased-checkbox"
      />

      <div className="flex-grow-1 min-w-0">
        {item.imageUrl && <img src={`${API_URL}${item.imageUrl}`} alt="" loading="lazy" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="lc-item-name text-truncate" data-testid="purchased-name">
            {item.name}
          </span>
          {(Number(item.quantity)!==1||item.unit!=='pza')&&<span className="lc-hint" data-testid="purchased-quantity">{Number(item.quantity)} {unitLabel}</span>}
          <span className="lc-hint" data-testid="purchased-meta">
            {item.purchasedByName ? `${item.purchasedByName} · ` : ''}
            {relativeDate(item.purchasedAt, t)}
          </span>
          {item.isRecurring && item.daysUntilReactivation !== null && (
            <span className="lc-chip lc-chip--tag" data-testid="purchased-return-badge">
              <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
              {t('item.returnsIn', { count: item.daysUntilReactivation })}
            </span>
          )}
        </div>
      </div>

      <button className="lc-icon-btn" type="button" onClick={() => onEdit(item)} disabled={disabled} aria-label={`${t('item.edit')}: ${item.name}`} data-testid="item-edit"><i className="bi bi-pencil" aria-hidden="true" /></button>
      <button
        className="lc-icon-btn"
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
