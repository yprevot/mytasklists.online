import { Picker } from '@react-native-picker/picker';
import UNITS from '../../../../packages/ui-data/units.json';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from './ui';
import { ItemPhotoPicker } from './ItemPhotoPicker';
import { itemsApi } from '../api/endpoints';
import { API_URL } from '../api/client';
import { colors, radius, spacing } from '../theme';
import type { Item } from '../types';
import { itemImageForm } from '../utils/item-image';

export function EditItemModal({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const { i18n } = useTranslation(); const en = i18n.language.startsWith('en');
  const [name, setName] = useState(item?.name ?? ''); const [note, setNote] = useState(item?.note ?? ''); const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const known = UNITS.some((u) => u.value === item?.unit); const [unit, setUnit] = useState(known ? item?.unit ?? 'pza' : 'custom');
  const [customUnit, setCustomUnit] = useState(known ? '' : item?.unit ?? ''); const [recurring, setRecurring] = useState(item?.isRecurring ?? false);
  const [days, setDays] = useState(String(item?.recurrenceDays ?? 14)); const [photo, setPhoto] = useState<string | null>(null); const [clearPhoto, setClearPhoto] = useState(false); const [saving, setSaving] = useState(false);
  const closePhoto = (uri: string | null) => { setPhoto(uri); setClearPhoto(uri === null); };
  const save = async () => {
    if (!item || saving) return; const amount = Number(quantity.replace(',', '.')); const selected = unit === 'custom' ? customUnit.trim() : unit;
    if (!name.trim() || !Number.isFinite(amount) || amount < 0.01 || amount > 99999 || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-7 || (recurring && (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 365)) || !selected || selected.length > 20) { Alert.alert(en ? 'Check the item details' : 'Revisa los datos del elemento'); return; }
    setSaving(true);
    try {
      await itemsApi.update(item.id, { name: name.trim(), note: note.trim() || null, quantity: amount, unit: selected, isRecurring: recurring, ...(recurring ? { recurrenceDays: Number(days) || 14 } : {}) });
      if (photo) await itemsApi.uploadImage(item.id, await itemImageForm(photo));
      else if (clearPhoto && item.imageUrl) await itemsApi.removeImage(item.id);
      onSaved(); onClose();
    } catch (error) { Alert.alert(en ? 'Could not save item' : 'No se pudo guardar el elemento', (error as Error).message); } finally { setSaving(false); }
  };
  return <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}><View style={styles.scrim}><View style={styles.card}><ScrollView keyboardShouldPersistTaps="handled"><Text style={styles.title}>{en ? 'Edit item' : 'Editar elemento'}</Text>
    <Text style={styles.label}>{en ? 'Name' : 'Nombre'}</Text><TextInput style={styles.input} accessibilityLabel={en ? 'Name' : 'Nombre'} testID="edit-item-name" value={name} onChangeText={setName} maxLength={120} />
    <Text style={styles.label}>{en ? 'Note' : 'Nota'}</Text><TextInput style={[styles.input, { minHeight: 76 }]} accessibilityLabel={en ? 'Note' : 'Nota'} value={note} onChangeText={setNote} multiline maxLength={300} />
    <Text style={styles.label}>{en ? 'Quantity' : 'Cantidad'}</Text><TextInput style={styles.input} accessibilityLabel={en ? 'Quantity' : 'Cantidad'} testID="edit-item-quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
    <Text style={styles.label}>{en ? 'Unit' : 'Unidad'}</Text><Picker accessibilityLabel={en ? 'Unit' : 'Unidad'} testID="edit-item-unit" selectedValue={unit} onValueChange={setUnit} style={{ color: colors.ink }}>{UNITS.map((u) => <Picker.Item key={u.value} label={en ? u.en : u.es} value={u.value} />)}<Picker.Item label={en ? 'Custom…' : 'Personalizado…'} value="custom" /></Picker>
    {unit === 'custom' && <TextInput accessibilityLabel={en ? 'Unit name' : 'Nombre de unidad'} style={styles.input} testID="edit-custom-unit" value={customUnit} onChangeText={setCustomUnit} maxLength={20} />}
    <View style={styles.switchRow}><Text style={styles.label}>{en ? 'Repeat automatically' : 'Repetir automáticamente'}</Text><Switch value={recurring} onValueChange={setRecurring} trackColor={{ true: colors.brand }} /></View>
    {recurring && <><Text style={styles.label}>{en ? 'Repeat every (days)' : 'Repetir cada (días)'}</Text><TextInput style={styles.input} accessibilityLabel={en ? 'Repeat every (days)' : 'Repetir cada (días)'} value={days} onChangeText={setDays} keyboardType="number-pad" /></>}
    <Text style={styles.label}>{en ? 'Item photo' : 'Foto del elemento'}</Text><ItemPhotoPicker uri={photo ?? (!clearPhoto && item?.imageUrl ? `${API_URL}${item.imageUrl}` : null)} onChange={closePhoto} />
    <View style={styles.actions}><Button title={en ? 'Cancel' : 'Cancelar'} variant="ghost" onPress={onClose} disabled={saving} /><Button title={saving ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save' : 'Guardar')} onPress={save} disabled={saving} /></View>
  </ScrollView></View></View></Modal>;
}
const styles = StyleSheet.create({ scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, card: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg }, title: { fontSize: 21, fontWeight: '700', color: colors.ink, marginBottom: spacing.md }, label: { color: colors.ink, fontWeight: '600', marginTop: spacing.sm }, input: { minHeight: 48, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.lg } });
