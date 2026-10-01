import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { SocialButtons } from '../components/SocialButtons';

interface FieldErrors {
  fullName?: string;
  email?: string;
  whatsapp?: string;
  password?: string;
}

export function RegisterPage() {
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ fullName: '', email: '', whatsapp: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const update = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const validate = (): boolean => {
    const errors: FieldErrors = {};
    if (form.fullName.trim().length < 3) errors.fullName = t('register.errors.fullName');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      errors.email = t('register.errors.email');
    if (!/^\+?[0-9]{8,20}$/.test(form.whatsapp.trim()))
      errors.whatsapp = t('register.errors.whatsapp');
    if (form.password.length < 8) errors.password = t('common.passwordTooShort');
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        whatsapp: form.whatsapp.trim(),
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('register.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div data-testid="register-card">
        <div>
          <div className="lc-auth-head">
            <h1>{t('register.title')}</h1>
            <p>{t('register.subtitle')}</p>
          </div>

          <form onSubmit={submit} noValidate data-testid="register-form">
            <div className="mb-3">
              <label className="form-label" htmlFor="register-name">
                {t('common.fullName')}
              </label>
              <input
                id="register-name"
                className={`form-control ${fieldErrors.fullName ? 'is-invalid' : ''}`}
                value={form.fullName}
                onChange={update('fullName')}
                autoComplete="name"
                data-testid="register-fullname"
              />
              {fieldErrors.fullName && (
                <div className="invalid-feedback" data-testid="error-fullname">
                  {fieldErrors.fullName}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="register-email">
                {t('common.email')}
              </label>
              <input
                id="register-email"
                type="email"
                className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                value={form.email}
                onChange={update('email')}
                autoComplete="email"
                data-testid="register-email"
              />
              {fieldErrors.email && (
                <div className="invalid-feedback" data-testid="error-email">
                  {fieldErrors.email}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="register-whatsapp">
                {t('common.whatsapp')}
              </label>
              <input
                id="register-whatsapp"
                className={`form-control ${fieldErrors.whatsapp ? 'is-invalid' : ''}`}
                placeholder="+5215512345678"
                value={form.whatsapp}
                onChange={update('whatsapp')}
                autoComplete="tel"
                data-testid="register-whatsapp"
              />
              {fieldErrors.whatsapp && (
                <div className="invalid-feedback" data-testid="error-whatsapp">
                  {fieldErrors.whatsapp}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="register-password">
                {t('common.password')}
              </label>
              <input
                id="register-password"
                type="password"
                className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
                value={form.password}
                onChange={update('password')}
                autoComplete="new-password"
                data-testid="register-password"
              />
              {fieldErrors.password && (
                <div className="invalid-feedback" data-testid="error-password">
                  {fieldErrors.password}
                </div>
              )}
            </div>

            {error && (
              <div className="alert alert-danger py-2 small" role="alert" data-testid="register-error">
                {error}
              </div>
            )}

            <button
              className="btn btn-primary btn-lg w-100"
              type="submit"
              disabled={submitting}
              data-testid="register-submit"
            >
              {submitting ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          <div className="lc-divider">{t('common.or')}</div>

          <SocialButtons disabled={submitting} />

          <p className="text-center text-muted mt-4 mb-0">
            {t('register.haveAccount')}{' '}
            <Link to="/login" className="fw-semibold" data-testid="go-login">
              {t('register.login')}
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
