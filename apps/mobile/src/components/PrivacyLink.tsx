import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../api/client';
import { colors, spacing } from '../theme';

/** La política vive en la landing, en el mismo dominio que la API */
const SITE_URL = API_URL.replace(/\/api$/, '');

type LinkProps = { style?: StyleProp<ViewStyle> };

/** Abre una página legal de la landing, en el idioma de la app, sin salir de ella */
function LegalLink({ page, testID, style }: LinkProps & { page: 'privacy' | 'terms'; testID: string }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => void WebBrowser.openBrowserAsync(`${SITE_URL}${t(`legal.${page}Path`)}`)}
      accessibilityRole="link"
      testID={testID}
      style={style}
    >
      <Text style={styles.text}>{t(`legal.${page}`)}</Text>
    </Pressable>
  );
}

export const PrivacyLink = ({ style }: LinkProps) => <LegalLink page="privacy" testID="privacy-link" style={style} />;
export const TermsLink = ({ style }: LinkProps) => <LegalLink page="terms" testID="terms-link" style={style} />;

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
    color: colors.inkSoft,
    fontSize: 13,
    textDecorationLine: 'underline',
    paddingVertical: spacing.sm,
  },
});
