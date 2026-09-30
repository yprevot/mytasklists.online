import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login, user, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 p-3">
      <div className="card border-0 shadow-sm" style={{ maxWidth: 420, width: '100%' }} data-testid="login-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div style={{ fontSize: '2.2rem' }} aria-hidden="true">
              📊
            </div>
            <h1 className="h5 mt-2 mb-1">Panel de administracion</h1>
            <p className="text-muted small mb-0">Acceso exclusivo para cuentas con rol admin.</p>
          </div>

          <form onSubmit={submit} data-testid="login-form">
            <div className="mb-3">
              <label className="form-label" htmlFor="email">
                Correo electronico
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
                Contrasena
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
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
