import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../api/client';
import { colors, spacing } from '../theme';

/** La política vive en la landing, en el mismo dominio que la API */
const SITE_URL = API_URL.replace(/\/api$/, '');

/** Abre la política de privacidad, en el idioma de la app, sin salir de ella */
export function PrivacyLink({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}${t('legal.privacyPath')}`)}
      accessibilityRole="link"
      testID="privacy-link"
      style={style}
    >
      <Text style={styles.text}>{t('legal.privacy')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
    color: colors.inkSoft,
    fontSize: 13,
    textDecorationLine: 'underline',
    paddingVertical: spacing.sm,
  },
});
