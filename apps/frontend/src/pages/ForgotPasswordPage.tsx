import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '../components/AuthShell';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';

/** Pide el enlace para restablecer la contraseña. La respuesta es siempre la misma */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError(t('forgot.invalidEmail'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('forgot.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div data-testid="forgot-card">
        <div>
          <div className="lc-auth-head">
            <h1>{t('forgot.title')}</h1>
            <p>{t('forgot.subtitle')}</p>
          </div>

          {sent ? (
            <div className="alert alert-success small" role="status" data-testid="forgot-sent">
              {sent} {t('forgot.spamHint')}
            </div>
          ) : (
            <form onSubmit={submit} noValidate data-testid="forgot-form">
              <div className="mb-3">
                <label className="form-label" htmlFor="forgot-email">
                  {t('common.email')}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  data-testid="forgot-email"
                />
              </div>
              {error && (
                <div className="alert alert-danger py-2 small" role="alert" data-testid="forgot-error">
                  {error}
                </div>
              )}
              <button className="btn btn-primary btn-lg w-100" type="submit" disabled={submitting} data-testid="forgot-submit">
                {submitting ? t('common.sending') : t('forgot.submit')}
              </button>
            </form>
          )}

          <p className="text-center text-muted mt-4 mb-0">
            <Link to="/login" className="fw-semibold" data-testid="go-login">
              {t('forgot.backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
