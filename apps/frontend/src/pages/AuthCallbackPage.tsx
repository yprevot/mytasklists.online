import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { MfaCodeForm } from '../components/MfaCodeForm';

const PROVIDER_ERRORS = ['google_cancelado', 'google_fallido', 'apple_cancelado', 'apple_fallido'] as const;
type ProviderError = (typeof PROVIDER_ERRORS)[number];
const isProviderError = (value: string): value is ProviderError =>
  PROVIDER_ERRORS.includes(value as ProviderError);

/**
 * Vuelta de Google/Apple. El backend ya dejo el refresh token en una cookie
 * httpOnly; en el fragmento (#) solo llega el estado o el reto de 2FA.
 */
export function AuthCallbackPage() {
  const { restoreSession, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Limpia el fragmento para que no quede en el historial
    window.history.replaceState(null, '', window.location.pathname);

    const failure = params.get('error');
    if (failure) {
      setError(isProviderError(failure) ? t(`callback.errors.${failure}`) : t('callback.generic'));
      return;
    }
    const challenge = params.get('mfaToken');
    if (challenge) {
      setMfaToken(challenge);
      return;
    }
    if (params.get('status') !== 'ok') {
      setError(t('callback.incomplete'));
      return;
    }
    restoreSession()
      .then((ok) => {
        if (ok) navigate('/', { replace: true });
        else setError(t('callback.sessionFailed'));
      })
      .catch(() => setError(t('callback.sessionFailed')));
  }, [restoreSession, navigate, t]);

  if (mfaToken) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
        <div className="card border-0 shadow-sm lc-auth-card">
          <div className="card-body p-4">
            <h1 className="h5 text-center mb-3">{t('login.mfaTitle')}</h1>
            <MfaCodeForm
              onSubmit={async (code) => {
                await verifyMfa(mfaToken, code);
                navigate('/', { replace: true });
              }}
              onCancel={() => navigate('/login', { replace: true })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
        <div className="card border-0 shadow-sm lc-auth-card">
          <div className="card-body p-4 text-center">
            <i className="bi bi-x-octagon text-danger fs-1" aria-hidden="true" />
            <h1 className="h5 mt-3">{t('callback.errorTitle')}</h1>
            <p className="text-muted small" data-testid="oauth-error">
              {error}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/login', { replace: true })}>
              {t('callback.backToLogin')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Spinner label={t('callback.validating')} />;
}
