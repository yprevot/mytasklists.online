import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { AuthShell } from '../components/AuthShell';

/** Destino del enlace del correo de verificacion (#token=…) */
export function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // El token es de un solo uso: evita el doble efecto de StrictMode
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setState('error');
      setMessage(t('verifyEmail.invalidLink'));
      return;
    }
    authApi
      .verifyEmail(token)
      .then(async (result) => {
        setMessage(t('verifyEmail.confirmed', { email: result.email }));
        setState('ok');
        if (user) await refreshUser().catch(() => undefined);
      })
      .catch((err) => {
        setMessage(err instanceof ApiError ? err.message : t('verifyEmail.failed'));
        setState('error');
      });
  }, [user, refreshUser, t]);

  if (state === 'loading') return <Spinner label={t('verifyEmail.loading')} />;

  return (
    <AuthShell>
      <div data-testid="verify-card">
        <div className="lc-auth-head">
          <h1>{state === 'ok' ? t('verifyEmail.okTitle') : t('verifyEmail.errorTitle')}</h1>
          <p data-testid={state === 'ok' ? 'verify-ok' : 'verify-error'}>{message}</p>
        </div>
        <Link className="btn btn-primary btn-lg w-100" to={user ? '/' : '/login'}>
          {user ? t('common.goToLists') : t('common.signIn')}
        </Link>
      </div>
    </AuthShell>
  );
}
