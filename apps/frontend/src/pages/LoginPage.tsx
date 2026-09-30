import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { SocialButtons } from '../components/SocialButtons';

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={location.state?.from ?? '/'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
      <div className="card border-0 shadow-sm lc-auth-card" data-testid="login-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <div style={{ fontSize: '2.5rem' }} aria-hidden="true">
              🛒
            </div>
            <h1 className="h4 mt-2 mb-1">Inicia sesion</h1>
            <p className="text-muted small mb-0">
              Tus listas de compras compartidas, siempre sincronizadas.
            </p>
          </div>

          <form onSubmit={submit} noValidate data-testid="login-form">
            <div className="mb-3">
              <label className="form-label" htmlFor="login-email">
                Correo electronico
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
                Contrasena
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
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div className="d-flex align-items-center gap-2 my-3">
            <hr className="flex-grow-1" />
            <span className="text-muted small">o</span>
            <hr className="flex-grow-1" />
          </div>

          <SocialButtons disabled={submitting} />

          <p className="text-center small text-muted mt-4 mb-0">
            ¿Aun no tienes cuenta?{' '}
            <Link to="/register" data-testid="go-register">
              Registrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
