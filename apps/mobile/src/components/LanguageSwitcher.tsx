import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '../i18n';
import { colors, radius, spacing } from '../theme';

/** Selector ES / EN. La eleccion se guarda y gana sobre el idioma del telefono */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t('language.label')} testID="language-switcher">
      {LANGUAGES.map((language) => {
        const active = i18n.language === language;
        return (
          <Pressable
            key={language}
            onPress={() => setLanguage(language)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(`language.${language}`)}
            testID={`language-${language}`}
            style={[styles.option, active && styles.optionActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>{language.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  option: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  optionActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  text: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  textActive: { color: '#fff' },
});
