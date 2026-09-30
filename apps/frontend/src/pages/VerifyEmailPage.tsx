import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';

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
    <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
      <div className="card border-0 shadow-sm lc-auth-card" data-testid="verify-card">
        <div className="card-body p-4 text-center">
          <i
            className={`bi ${state === 'ok' ? 'bi-patch-check text-success' : 'bi-x-octagon text-danger'} fs-1`}
            aria-hidden="true"
          />
          <h1 className="h5 mt-3">{state === 'ok' ? t('verifyEmail.okTitle') : t('verifyEmail.errorTitle')}</h1>
          <p className="text-muted small" data-testid={state === 'ok' ? 'verify-ok' : 'verify-error'}>
            {message}
          </p>
          <Link className="btn btn-primary" to={user ? '/' : '/login'}>
            {user ? t('common.goToLists') : t('common.signIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}
