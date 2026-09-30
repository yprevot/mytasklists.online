import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '../i18n';

/** Selector ES / EN. La elección se guarda y gana sobre el idioma del navegador */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();

  return (
    <div
      className={`lc-lang ${className}`}
      role="group"
      aria-label={t('language.label')}
      data-testid="language-switcher"
    >
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          onClick={() => setLanguage(language)}
          aria-pressed={i18n.language === language}
          title={t(`language.${language}`)}
          lang={language}
          data-testid={`language-${language}`}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
