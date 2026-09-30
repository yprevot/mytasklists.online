import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Spinner } from '../components/Spinner';
import { MfaCodeForm } from '../components/MfaCodeForm';

const PROVIDER_ERRORS = ['google_cancelado', 'google_fallido', 'apple_cancelado', 'apple_fallido'] as const;
type ProviderError = (typeof PROVIDER_ERRORS)[number];
const isProviderError = (value: string): value is ProviderError =>
  PROVIDER_ERRORS.includes(value as ProviderError);

/**
 * Vuelta de Google/Apple. El backend ya dejó el refresh token en una cookie
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
      <AuthShell>
        <div className="lc-auth-head">
          <h1>{t('login.mfaTitle')}</h1>
        </div>
        <MfaCodeForm
          onSubmit={async (code) => {
            await verifyMfa(mfaToken, code);
            navigate('/', { replace: true });
          }}
          onCancel={() => navigate('/login', { replace: true })}
        />
      </AuthShell>
    );
  }

  if (error) {
    return (
      <AuthShell>
        <div className="lc-auth-head">
          <h1>{t('callback.errorTitle')}</h1>
          <p data-testid="oauth-error">{error}</p>
        </div>
        <button className="btn btn-primary btn-lg w-100" onClick={() => navigate('/login', { replace: true })}>
          {t('callback.backToLogin')}
        </button>
      </AuthShell>
    );
  }

  return <Spinner label={t('callback.validating')} />;
}
