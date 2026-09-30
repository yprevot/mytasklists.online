import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';

/** Pide el enlace para restablecer la contrasena. La respuesta es siempre la misma */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Escribe un correo electronico valido');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos enviar el correo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
      <div className="card border-0 shadow-sm lc-auth-card" data-testid="forgot-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <i className="bi bi-key fs-1 text-primary" aria-hidden="true" />
            <h1 className="h4 mt-2 mb-1">Recupera tu cuenta</h1>
            <p className="text-muted small mb-0">
              Te enviaremos un enlace para elegir una contrasena nueva.
            </p>
          </div>

          {sent ? (
            <div className="alert alert-success small" role="status" data-testid="forgot-sent">
              {sent} Revisa tambien la carpeta de spam.
            </div>
          ) : (
            <form onSubmit={submit} noValidate data-testid="forgot-form">
              <div className="mb-3">
                <label className="form-label" htmlFor="forgot-email">
                  Correo electronico
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
              <button className="btn btn-primary w-100" type="submit" disabled={submitting} data-testid="forgot-submit">
                {submitting ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>
          )}

          <p className="text-center small text-muted mt-4 mb-0">
            <Link to="/login" data-testid="go-login">
              Volver a iniciar sesion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
