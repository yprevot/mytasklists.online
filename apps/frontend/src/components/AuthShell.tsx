import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Marco de las pantallas sin sesion: panel de marca a la izquierda (solo en
 * pantallas anchas) y el formulario a la derecha. En el telefono queda solo el
 * formulario, con la marca arriba.
 */
export function AuthShell({ children, switcher = true }: { children: ReactNode; switcher?: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="lc-auth">
      <aside className="lc-auth-side" aria-hidden="true">
        <Brand />
        <div>
          <p className="lc-auth-pitch">{t('brand.pitch')}</p>
          <p className="lc-auth-sub">{t('brand.pitchText')}</p>
        </div>
        <div className="lc-sample">
          <div className="lc-sample-row">
            <span className="lc-check" />
            <span className="flex-grow-1">{t('brand.sampleBread')}</span>
            <span className="lc-chip lc-chip--tag">
              <i className="bi bi-arrow-repeat" />
              {t('brand.sampleEvery')}
            </span>
          </div>
          <div className="lc-sample-row lc-sample-row--late">
            <span className="lc-check" />
            <span className="flex-grow-1">{t('brand.sampleMilk')}</span>
            <span className="lc-chip lc-chip--late">{t('brand.sampleLate')}</span>
          </div>
          <div className="lc-sample-row">
            <span className="lc-check" />
            <span className="flex-grow-1">{t('brand.sampleBatteries')}</span>
          </div>
        </div>
      </aside>

      <main className="lc-auth-main">
        {switcher && <LanguageSwitcher className="lc-auth-lang" />}
        <div className="lc-auth-card lc-rise">
          <Brand className="lc-auth-mobile-brand" />
          {children}
        </div>
      </main>
    </div>
  );
}
