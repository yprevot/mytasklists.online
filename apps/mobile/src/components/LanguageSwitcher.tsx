import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '../i18n';
import { colors, radius, spacing } from '../theme';

/** Selector ES / EN. La elección se guarda y gana sobre el idioma del teléfono */
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
  row: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: '#e3e8e4',
  },
  option: {
    minWidth: 44,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  optionActive: {
    backgroundColor: colors.surface,
    shadowColor: '#15201a',
    shadowOpacity: 0.16,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, letterSpacing: 0.3 },
  textActive: { color: colors.ink },
});
