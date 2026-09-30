import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Almacén de los tokens: Keychain en iOS y Keystore en Android (cifrados por el
 * sistema). La build web solo existe para las pruebas y usa AsyncStorage.
 */
const isWeb = Platform.OS === 'web';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (isWeb) return AsyncStorage.getItem(key);
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;
    // Migración: las versiones anteriores guardaban los tokens sin cifrar
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await SecureStore.setItemAsync(key, legacy);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  async set(key: string, value: string): Promise<void> {
    if (isWeb) return AsyncStorage.setItem(key, value);
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (isWeb) return AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  },
};
