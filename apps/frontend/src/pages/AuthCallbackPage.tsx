import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelado: 'Cancelaste el inicio de sesion con Google.',
  google_fallido: 'No pudimos validar tu cuenta de Google. Intentalo de nuevo.',
  apple_cancelado: 'Cancelaste el inicio de sesion con Apple.',
  apple_fallido: 'No pudimos validar tu cuenta de Apple. Intentalo de nuevo.',
};

/** Recibe los tokens que el backend deja en el fragmento (#) tras el flujo OAuth */
export function AuthCallbackPage() {
  const { adoptTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const failure = params.get('error');
    if (failure) {
      setError(ERROR_MESSAGES[failure] ?? 'No pudimos completar el inicio de sesion.');
      return;
    }

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (!accessToken || !refreshToken) {
      setError('La respuesta del proveedor venia incompleta.');
      return;
    }

    // Limpia el fragmento para que los tokens no queden en el historial
    window.history.replaceState(null, '', `${window.location.pathname}`);
    adoptTokens(accessToken, refreshToken)
      .then(() => navigate('/', { replace: true }))
      .catch(() => setError('No pudimos validar la sesion recibida.'));
  }, [adoptTokens, navigate]);

  if (error) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
        <div className="card border-0 shadow-sm lc-auth-card">
          <div className="card-body p-4 text-center">
            <i className="bi bi-x-octagon text-danger fs-1" aria-hidden="true" />
            <h1 className="h5 mt-3">No se pudo iniciar sesion</h1>
            <p className="text-muted small" data-testid="oauth-error">
              {error}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/login', { replace: true })}>
              Volver al inicio de sesion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Spinner label="Validando tu cuenta…" />;
}
