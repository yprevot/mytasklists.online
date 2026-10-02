import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors, spacing } from '../theme';

export function ItemPhotoPicker({ uri, onChange }: { uri: string | null; onChange: (uri: string | null) => void }) {
  const { i18n } = useTranslation(); const en = i18n.language.startsWith('en');
  const pick = async (camera: boolean) => {
    try {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { Alert.alert(en ? 'Camera permission required' : 'Se requiere permiso de cámara'); return; }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert(en ? 'Photo library permission required' : 'Se requiere permiso para acceder a tus fotos'); return; }
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.82, allowsEditing: true, exif: false, cameraType: ImagePicker.CameraType.back })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, allowsEditing: true, exif: false });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > 1600) {
        context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
      }
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
      onChange(image.uri);
    }
    } catch { Alert.alert(en ? 'Could not open the photo' : 'No se pudo abrir la foto', en ? 'Try another image.' : 'Inténtalo con otra imagen.'); }
  };
  return <View style={{ gap: spacing.sm }}>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Pressable accessibilityRole="button" onPress={() => pick(true)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8 }}><Text style={{ color: colors.brand, fontWeight: '600' }}>{en ? 'Take photo' : 'Tomar foto'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => pick(false)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 8 }}><Text style={{ color: colors.brand, fontWeight: '600' }}>{en ? 'Choose photo' : 'Elegir foto'}</Text></Pressable>
    </View>
    {uri && <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}><Image source={{ uri }} style={{ width: 76, height: 76, borderRadius: 8 }} /><Pressable onPress={() => onChange(null)} accessibilityRole="button"><Text style={{ color: colors.danger, fontWeight: '600' }}>{en ? 'Remove photo' : 'Quitar foto'}</Text></Pressable></View>}
  </View>;
}
