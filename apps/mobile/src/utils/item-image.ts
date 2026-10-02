import { Platform } from 'react-native';

/** Expo fetch needs File bytes on native; browsers need an actual Blob. */
export async function itemImageForm(uri: string): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    form.append('file', await response.blob(), 'item.jpg');
  } else {
    const { File } = await import('expo-file-system');
    form.append('file', new File(uri));
  }
  return form;
}
