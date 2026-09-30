import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
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
    <div className="d-flex justify-content-center align-items-center min-vh-100 p-3 position-relative">
      <LanguageSwitcher className="position-absolute top-0 end-0 m-3" />
      <div className="card border-0 shadow-sm lc-auth-card" data-testid="register-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div style={{ fontSize: '2.5rem' }} aria-hidden="true">
              🛒
            </div>
            <h1 className="h4 mt-2 mb-1">{t('register.title')}</h1>
            <p className="text-muted small mb-0">
              {t('register.subtitle')}
            </p>
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
              className="btn btn-primary w-100"
              type="submit"
              disabled={submitting}
              data-testid="register-submit"
            >
              {submitting ? t('register.submitting') : t('register.submit')}
            </button>
          </form>

          <div className="d-flex align-items-center gap-2 my-3">
            <hr className="flex-grow-1" />
            <span className="text-muted small">{t('common.or')}</span>
            <hr className="flex-grow-1" />
          </div>

          <SocialButtons disabled={submitting} />

          <p className="text-center small text-muted mt-4 mb-0">
            {t('register.haveAccount')}{' '}
            <Link to="/login" data-testid="go-login">
              {t('register.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
