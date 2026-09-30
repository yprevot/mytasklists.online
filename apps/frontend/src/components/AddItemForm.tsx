import { useState, type FormEvent } from 'react';
import { itemsApi } from '../api/endpoints';
import { ApiError } from '../api/client';

interface Props {
  listId: string;
  disabled?: boolean;
  onError: (message: string) => void;
}

const PRESET_DAYS = [3, 7, 14, 21, 30];

/**
 * Alta de producto. El interruptor "Repetir automaticamente" es lo que
 * convierte el producto en recurrente: al comprarlo se reprogramara solo.
 */
export function AddItemForm({ listId, disabled, onError }: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pza');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState('14');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      await itemsApi.create(listId, {
        name: trimmed,
        quantity: Number(quantity) || 1,
        unit: unit.trim() || 'pza',
        isRecurring,
        ...(isRecurring ? { recurrenceDays: Number(recurrenceDays) || 14 } : {}),
      });
      setName('');
      setQuantity('1');
    } catch (error) {
      onError(error instanceof ApiError ? error.message : 'No se pudo agregar el producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card border-0 shadow-sm mb-4" onSubmit={submit} data-testid="add-item-form">
      <div className="card-body">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md">
            <label className="visually-hidden" htmlFor="item-name">
              Producto
            </label>
            <input
              id="item-name"
              className="form-control form-control-lg"
              placeholder="Agregar producto…  p. ej. Pan de caja"
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
              className={`btn w-100 ${expanded ? 'btn-secondary' : 'btn-outline-secondary'}`}
              onClick={() => setExpanded((value) => !value)}
              data-testid="toggle-item-options"
              aria-expanded={expanded}
            >
              <i className="bi bi-sliders me-1" aria-hidden="true" />
              Opciones
            </button>
          </div>
          <div className="col-6 col-md-auto">
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={disabled || saving || !name.trim()}
              data-testid="add-item-button"
            >
              {saving ? 'Agregando…' : 'Agregar'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="row g-3 mt-1 pt-3 border-top" data-testid="item-options">
            <div className="col-6 col-md-3">
              <label className="form-label small" htmlFor="item-quantity">
                Cantidad
              </label>
              <input
                id="item-quantity"
                type="number"
                min="0.01"
                step="0.01"
                className="form-control"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                data-testid="item-quantity-input"
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small" htmlFor="item-unit">
                Unidad
              </label>
              <input
                id="item-unit"
                className="form-control"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                data-testid="item-unit-input"
              />
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
                  Repetir automaticamente
                </label>
              </div>
            </div>

            {isRecurring && (
              <div className="col-12" data-testid="recurrence-options">
                <label className="form-label small" htmlFor="item-recurrence-days">
                  Volver a agregarlo cada
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
                  <span className="text-muted small">dias desde que se marque como comprado</span>
                  <div className="ms-auto btn-group btn-group-sm" role="group">
                    {PRESET_DAYS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={`btn ${
                          Number(recurrenceDays) === days ? 'btn-primary' : 'btn-outline-primary'
                        }`}
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
          </div>
        )}
      </div>
    </form>
  );
}
