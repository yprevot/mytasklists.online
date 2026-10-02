import { Platform } from 'react-native';

/** Native fetch accepts a URI attachment; browsers need an actual Blob. */
export async function itemImageForm(uri: string): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    form.append('file', await response.blob(), 'item.jpg');
  } else {
    form.append('file', { uri, name: 'item.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  return form;
}
