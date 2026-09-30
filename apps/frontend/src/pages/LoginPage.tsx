import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { SocialButtons } from '../components/SocialButtons';
import { MfaCodeForm } from '../components/MfaCodeForm';

export function LoginPage() {
  const { login, verifyMfa, user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);

  if (!loading && user) return <Navigate to={location.state?.from ?? '/'} replace />;

  const goHome = () => navigate(location.state?.from ?? '/', { replace: true });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const step = await login(email.trim().toLowerCase(), password);
      if (step.status === 'mfa') {
        setMfaToken(step.mfaToken);
        return;
      }
      goHome();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 p-3 position-relative">
      <LanguageSwitcher className="position-absolute top-0 end-0 m-3" />
      <div className="card border-0 shadow-sm lc-auth-card" data-testid="login-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div style={{ fontSize: '2.5rem' }} aria-hidden="true">
              🛒
            </div>
            <h1 className="h4 mt-2 mb-1">{mfaToken ? t('login.mfaTitle') : t('login.title')}</h1>
            <p className="text-muted small mb-0">
              {t('login.subtitle')}
            </p>
          </div>

          {mfaToken ? (
            <MfaCodeForm
              onSubmit={async (code) => {
                await verifyMfa(mfaToken, code);
                goHome();
              }}
              onCancel={() => {
                setMfaToken(null);
                setPassword('');
              }}
            />
          ) : (
            <>
              <form onSubmit={submit} noValidate data-testid="login-form">
                <div className="mb-3">
                  <label className="form-label" htmlFor="login-email">
                    {t('common.email')}
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    data-testid="login-email"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="login-password">
                    {t('common.password')}
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    data-testid="login-password"
                  />
                </div>

                {error && (
                  <div className="alert alert-danger py-2 small" role="alert" data-testid="login-error">
                    {error}
                  </div>
                )}

                <button
                  className="btn btn-primary w-100"
                  type="submit"
                  disabled={submitting}
                  data-testid="login-submit"
                >
                  {submitting ? t('login.submitting') : t('login.submit')}
                </button>

                <div className="text-center mt-3">
                  <Link to="/forgot-password" className="small" data-testid="go-forgot-password">
                    {t('login.forgot')}
                  </Link>
                </div>
              </form>

              <div className="d-flex align-items-center gap-2 my-3">
                <hr className="flex-grow-1" />
                <span className="text-muted small">{t('common.or')}</span>
                <hr className="flex-grow-1" />
              </div>

              <SocialButtons disabled={submitting} />

              <p className="text-center small text-muted mt-4 mb-0">
                {t('login.noAccount')}{' '}
                <Link to="/register" data-testid="go-register">
                  {t('login.register')}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
