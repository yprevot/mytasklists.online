import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Lee el token del fragmento (#token=…): asi no queda en los logs del proxy */
const readToken = (): string | null =>
  new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');

export function ResetPasswordPage() {
  const { user, logout } = useAuth();
  const [token] = useState(readToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (password.length < 8) return setError('La contrasena debe tener al menos 8 caracteres');
    if (password !== confirm) return setError('Las contrasenas no coinciden');
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      // El backend cerro todas las sesiones, tambien la de esta pestana
      if (user) await logout();
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contrasena');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
      <div className="card border-0 shadow-sm lc-auth-card" data-testid="reset-card">
        <div className="card-body p-4 p-md-5">
          <div className="text-center mb-4">
            <i className="bi bi-shield-lock fs-1 text-primary" aria-hidden="true" />
            <h1 className="h4 mt-2 mb-1">Elige una contrasena nueva</h1>
          </div>

          {!token ? (
            <div className="alert alert-warning small" data-testid="reset-invalid">
              El enlace no es valido. Pide uno nuevo desde "¿Olvidaste tu contrasena?".
            </div>
          ) : done ? (
            <div className="alert alert-success small" role="status" data-testid="reset-done">
              Listo: tu contrasena cambio y cerramos todas las sesiones abiertas. Ya puedes entrar con la
              nueva.
            </div>
          ) : (
            <form onSubmit={submit} noValidate data-testid="reset-form">
              <div className="mb-3">
                <label className="form-label" htmlFor="reset-password">
                  Nueva contrasena
                </label>
                <input
                  id="reset-password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  data-testid="reset-password"
                />
                <div className="form-text">Minimo 8 caracteres.</div>
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="reset-confirm">
                  Repite la contrasena
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  className="form-control"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  data-testid="reset-confirm"
                />
              </div>
              {error && (
                <div className="alert alert-danger py-2 small" role="alert" data-testid="reset-error">
                  {error}
                </div>
              )}
              <button className="btn btn-primary w-100" type="submit" disabled={submitting} data-testid="reset-submit">
                {submitting ? 'Guardando…' : 'Guardar contrasena'}
              </button>
            </form>
          )}

          <p className="text-center small text-muted mt-4 mb-0">
            <Link to="/login" data-testid="go-login">
              Ir a iniciar sesion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
