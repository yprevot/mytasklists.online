import UNITS from '../../../../packages/ui-data/units.json';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL, ApiError } from '../api/client';
import { itemsApi } from '../api/endpoints';
import type { Item } from '../types';
import { prepareItemImage } from '../utils/item-image';

export function EditItemModal({ item, onClose, onSaved, onError }: { item: Item; onClose: () => void; onSaved: () => void; onError: (message: string) => void }) {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? '');
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(UNITS.some((u) => u.value === item.unit) ? item.unit : 'custom');
  const [customUnit, setCustomUnit] = useState(UNITS.some((u) => u.value === item.unit) ? '' : item.unit);
  const [recurring, setRecurring] = useState(item.isRecurring);
  const [days, setDays] = useState(String(item.recurrenceDays ?? 14));
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const savingRef = useRef(saving); savingRef.current = saving;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLInputElement>('#edit-item-name')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])') ?? []);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  const imageUrl = item.imageUrl ? `${API_URL}${item.imageUrl}` : null;
  useEffect(() => { if (!file) { setPreviewUrl(null); return; } const url = URL.createObjectURL(file); setPreviewUrl(url); return () => URL.revokeObjectURL(url); }, [file]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(quantity.replace(',', '.'));
    const selectedUnit = unit === 'custom' ? customUnit.trim() : unit;
    if (!name.trim() || !Number.isFinite(amount) || amount < 0.01 || amount > 99999 || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7 || (recurring && (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 365)) || !selectedUnit || selectedUnit.length > 20) {
      onError(en ? 'Enter a valid name, quantity and unit.' : 'Escribe un nombre, cantidad y unidad válidos.'); return;
    }
    setSaving(true);
    try {
      await itemsApi.update(item.id, { name: name.trim(), note: note.trim() || null, quantity: amount, unit: selectedUnit, isRecurring: recurring, ...(recurring ? { recurrenceDays: Number(days) || 14 } : {}) });
      if (file) {
        const body = new FormData(); body.append('file', await prepareItemImage(file));
        await itemsApi.uploadImage(item.id, body);
      } else if (removeImage && item.imageUrl) await itemsApi.removeImage(item.id);
      onSaved(); onClose();
    } catch (error) { onError(error instanceof ApiError ? error.message : (error as Error).message); }
    finally { setSaving(false); }
  };

  return <div ref={dialogRef} style={{ background: 'rgba(0, 0, 0, 0.4)' }} className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="edit-item-title" onMouseDown={(e) => { if (!saving && e.target === e.currentTarget) onClose(); }}>
    <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable"><form className="modal-content" onSubmit={save}>
      <div className="modal-header"><h2 className="modal-title fs-5" id="edit-item-title">{en ? 'Edit item' : 'Editar elemento'}</h2><button type="button" className="btn-close" onClick={onClose} disabled={saving} aria-label={t('common.close')} /></div>
      <div className="modal-body d-grid gap-3">
        <div><label className="form-label" htmlFor="edit-item-name">{en ? 'Name' : 'Nombre'}</label><input id="edit-item-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></div>
        <div><label className="form-label" htmlFor="edit-item-note">{en ? 'Note' : 'Nota'}</label><textarea id="edit-item-note" className="form-control" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} /></div>
        <div className="row g-2"><div className="col-5"><label className="form-label" htmlFor="edit-item-quantity">{en ? 'Quantity' : 'Cantidad'}</label><input id="edit-item-quantity" className="form-control" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div><div className="col"><label className="form-label" htmlFor="edit-item-unit">{en ? 'Unit' : 'Unidad'}</label><select id="edit-item-unit" className="form-select" value={unit} onChange={(e) => setUnit(e.target.value)}>{UNITS.map((u) => <option key={u.value} value={u.value}>{en ? u.en : u.es}</option>)}<option value="custom">{en ? 'Custom…' : 'Personalizado…'}</option></select></div></div>
        {unit === 'custom' && <div><label className="form-label" htmlFor="edit-custom-unit">{en ? 'Unit name' : 'Nombre de la unidad'}</label><input id="edit-custom-unit" className="form-control" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} maxLength={20} required /></div>}
        <div className="form-check form-switch"><input className="form-check-input" id="edit-item-recurring" type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /><label className="form-check-label" htmlFor="edit-item-recurring">{t('addItem.repeat')}</label></div>
        {recurring && <div><label className="form-label" htmlFor="edit-item-days">{en ? 'Repeat every (days)' : 'Repetir cada (días)'}</label><input id="edit-item-days" className="form-control" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} /></div>}
        <div><label className="form-label" htmlFor="edit-item-image">{en ? 'Item photo' : 'Imagen del elemento'}</label><input ref={fileRef} id="edit-item-image" className="form-control" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false); }} />{(file || (imageUrl && !removeImage)) && <div className="d-flex align-items-center gap-3 mt-2"><img src={previewUrl ?? imageUrl!} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} /><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setFile(null); setRemoveImage(true); if (fileRef.current) fileRef.current.value = ''; }}>{en ? 'Remove image' : 'Quitar imagen'}</button></div>}</div>
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</button><button className="btn btn-primary" disabled={saving}>{saving ? t('common.loading') : (en ? 'Save changes' : 'Guardar cambios')}</button></div>
    </form></div>
  </div>;
}
