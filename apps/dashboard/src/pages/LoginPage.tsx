import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login, verifyMfa, user, loading } = useAdminAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const run = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.failed'));
      // Reto caducado o agotado: vuelta al primer paso
      if (err instanceof ApiError && err.status === 401 && /vuelve|again/i.test(err.message)) {
        setMfaToken(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitCredentials = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const step = await login(email.trim().toLowerCase(), password);
      if (step.status === 'mfa') setMfaToken(step.mfaToken);
    });
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (!mfaToken) return;
    void run(() => verifyMfa(mfaToken, code.trim()));
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 p-3 position-relative">
      <LanguageSwitcher className="position-absolute top-0 end-0 m-3" />
      <div className="card border-0 shadow-sm" style={{ maxWidth: 420, width: '100%' }} data-testid="login-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div style={{ fontSize: '2.2rem' }} aria-hidden="true">
              📊
            </div>
            <h1 className="h5 mt-2 mb-1">{t('auth.title')}</h1>
            <p className="text-muted small mb-0">{t('auth.subtitle')}</p>
          </div>

          {mfaToken ? (
            <form onSubmit={submitCode} data-testid="mfa-form">
              <div className="mb-3">
                <label className="form-label" htmlFor="mfa-code">
                  {t('auth.code')}
                </label>
                <input
                  id="mfa-code"
                  className="form-control text-center fs-5"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  data-testid="mfa-code"
                />
                <div className="form-text">
                  {t('auth.codeHint')}
                </div>
              </div>
              {error && (
                <div className="alert alert-danger py-2 small" role="alert" data-testid="login-error">
                  {error}
                </div>
              )}
              <button className="btn btn-primary w-100" disabled={submitting} data-testid="mfa-submit">
                {submitting ? t('common.verifying') : t('common.verify')}
              </button>
              <button type="button" className="btn btn-link w-100 mt-2" onClick={() => setMfaToken(null)}>
                {t('common.back')}
              </button>
            </form>
          ) : (
            <form onSubmit={submitCredentials} data-testid="login-form">
              <div className="mb-3">
                <label className="form-label" htmlFor="email">
                  {t('common.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  data-testid="login-email"
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="password">
                  {t('common.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  data-testid="login-password"
                />
              </div>

              {error && (
                <div className="alert alert-danger py-2 small" role="alert" data-testid="login-error">
                  {error}
                </div>
              )}

              <button className="btn btn-primary w-100" disabled={submitting} data-testid="login-submit">
                {submitting ? t('auth.submitting') : t('auth.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
