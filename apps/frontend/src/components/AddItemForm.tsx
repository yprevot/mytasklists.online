import UNITS from '../../../../packages/ui-data/units.json';
import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { itemsApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { prepareItemImage } from '../utils/item-image';

interface Props {
  listId: string;
  disabled?: boolean;
  onError: (message: string) => void;
}

const PRESET_DAYS = [3, 7, 14, 21, 30];

/**
 * Alta de producto. El interruptor "Repetir automáticamente" es lo que
 * convierte el producto en recurrente: al comprarlo se reprogramará solo.
 */
export function AddItemForm({ listId, disabled, onError }: Props) {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith("en");
  const [customUnit,setCustomUnit] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<string>('pza');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState('14');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    const amount = Number(quantity.replace(',', '.'));
    const selectedUnit = unit === 'custom' ? customUnit.trim() : unit;
    if (!Number.isFinite(amount) || amount < 0.01 || amount > 99999 || Math.abs(Math.round(amount*100)-amount*100)>1e-7 || !selectedUnit || selectedUnit.length>20) {
      onError(en?'Enter a valid quantity (up to 2 decimals) and unit.':'Escribe una cantidad válida (hasta 2 decimales) y una unidad.');return;
    }
    setSaving(true);
    try {
      const created = await itemsApi.create(listId, {
        name: trimmed,
        quantity: amount,
        unit: selectedUnit,
        isRecurring,
        ...(isRecurring ? { recurrenceDays: Number(recurrenceDays) || 14 } : {}),
      });
      const selectedImage = image;
      setName('');
      setImage(null);
      if (fileRef.current) fileRef.current.value = '';
      setQuantity('1');setUnit('pza');setCustomUnit('');
      if (selectedImage) {
        try {
          const body = new FormData();
          body.append('file', await prepareItemImage(selectedImage));
          await itemsApi.uploadImage(created.id, body);
        } catch (error) {
          onError(en ? 'Item added, but its image could not be uploaded.' : 'El elemento se agregó, pero no se pudo subir su imagen.');
        }
      }
    } catch (error) {
      onError(error instanceof ApiError ? error.message : (error as Error).message || t('addItem.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="lc-add mb-4" onSubmit={submit} data-testid="add-item-form">
      <div>
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md">
            <label className="visually-hidden" htmlFor="item-name">
              {t('addItem.label')}
            </label>
            <input
              id="item-name"
              className="form-control form-control-lg"
              placeholder={t('addItem.placeholder')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={disabled || saving}
              data-testid="item-name-input"
              autoComplete="off"
            />
          </div>
          <div className="col-6 col-md-auto">
            <button
              type="button"
              className={`btn btn-lg w-100 ${expanded ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setExpanded((value) => !value)}
              data-testid="toggle-item-options"
              aria-expanded={expanded}
            >
              <i className="bi bi-sliders me-1" aria-hidden="true" />
              {t('addItem.options')}
            </button>
          </div>
          <div className="col-6 col-md-auto">
            <button
              type="submit"
              className="btn btn-primary btn-lg w-100"
              disabled={disabled || saving || !name.trim()}
              data-testid="add-item-button"
            >
              {saving ? t('addItem.adding') : t('addItem.add')}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="row g-3 lc-add-options mx-0" data-testid="item-options">
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="item-quantity">
                {t('addItem.quantity')}
              </label>
              <input
                id="item-quantity"
                type="text"
                inputMode="decimal"
                className="form-control"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                data-testid="item-quantity-input"
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label" htmlFor="item-unit">
                {t('addItem.unit')}
              </label>
              <select id="item-unit" className="form-select" value={unit} onChange={e=>setUnit(e.target.value)} data-testid="item-unit-input">
                {UNITS.map(u=><option key={u.value} value={u.value}>{en?u.en:u.es}</option>)}
                <option value="custom">{en?'Custom…':'Personalizado…'}</option>
              </select>
              {unit==='custom' && <><label className="form-label mt-2" htmlFor="custom-unit">{en?'Unit name':'Nombre de la unidad'}</label>
                <input id="custom-unit" className="form-control" required maxLength={20} value={customUnit} onChange={e=>setCustomUnit(e.target.value)} autoFocus data-testid="item-custom-unit"/></>}

            </div>
            <div className="col-12 col-md-6">
              <div className="form-check form-switch mt-md-4">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="item-recurring"
                  checked={isRecurring}
                  onChange={(event) => setIsRecurring(event.target.checked)}
                  data-testid="item-recurring-switch"
                />
                <label className="form-check-label" htmlFor="item-recurring">
                  {t('addItem.repeat')}
                </label>
              </div>
            </div>

            {isRecurring && (
              <div className="col-12" data-testid="recurrence-options">
                <label className="form-label" htmlFor="item-recurrence-days">
                  {t('addItem.every')}
                </label>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <input
                    id="item-recurrence-days"
                    type="number"
                    min="1"
                    max="365"
                    className="form-control"
                    style={{ maxWidth: '120px' }}
                    value={recurrenceDays}
                    onChange={(event) => setRecurrenceDays(event.target.value)}
                    data-testid="item-recurrence-input"
                  />
                  <span className="text-muted small">{t('addItem.everyHint')}</span>
                  <div className="ms-md-auto d-flex flex-wrap gap-1" role="group">
                    {PRESET_DAYS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        className="lc-preset"
                        aria-pressed={Number(recurrenceDays) === days}
                        onClick={() => setRecurrenceDays(String(days))}
                        data-testid={`recurrence-preset-${days}`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="col-12">
              <label className="form-label" htmlFor="item-image">{en ? 'Photo (optional)' : 'Imagen (opcional)'}</label>
              <input ref={fileRef} id="item-image" className="form-control" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
