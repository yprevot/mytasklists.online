import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from '../i18n';

/** Selector ES / EN. La eleccion se guarda y gana sobre el idioma del navegador */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();

  return (
    <div
      className={`btn-group btn-group-sm ${className}`}
      role="group"
      aria-label={t('language.label')}
      data-testid="language-switcher"
    >
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="button"
          className={`btn ${i18n.language === language ? 'btn-primary' : 'btn-outline-secondary'}`}
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
