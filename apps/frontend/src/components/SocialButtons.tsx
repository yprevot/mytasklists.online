import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/** Botones de "Continuar con Google / Apple" que arrancan el flujo OAuth del backend */
export function SocialButtons({ disabled = false }: { disabled?: boolean }) {
  const { providers } = useAuth();
  const { t } = useTranslation();

  if (!providers.google && !providers.apple) {
    return (
      <p className="text-muted small text-center mb-0" data-testid="social-disabled">
        {t('social.disabled')}
      </p>
    );
  }

  return (
    <div className="d-grid gap-2" data-testid="social-buttons">
      {providers.google && (
        <a
          className={`btn btn-outline-dark d-flex align-items-center justify-content-center gap-2 ${
            disabled ? 'disabled' : ''
          }`}
          href={`${API_URL}/auth/google`}
          data-testid="google-login"
        >
          <i className="bi bi-google" aria-hidden="true" />
          {t('social.google')}
        </a>
      )}
      {providers.apple && (
        <a
          className={`btn btn-dark d-flex align-items-center justify-content-center gap-2 ${
            disabled ? 'disabled' : ''
          }`}
          href={`${API_URL}/auth/apple`}
          data-testid="apple-login"
        >
          <i className="bi bi-apple" aria-hidden="true" />
          {t('social.apple')}
        </a>
      )}
    </div>
  );
}
