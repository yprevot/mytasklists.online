import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { MfaCodeForm } from '../components/MfaCodeForm';

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelado: 'Cancelaste el inicio de sesion con Google.',
  google_fallido: 'No pudimos validar tu cuenta de Google. Intentalo de nuevo.',
  apple_cancelado: 'Cancelaste el inicio de sesion con Apple.',
  apple_fallido: 'No pudimos validar tu cuenta de Apple. Intentalo de nuevo.',
};

/**
 * Vuelta de Google/Apple. El backend ya dejo el refresh token en una cookie
 * httpOnly; en el fragmento (#) solo llega el estado o el reto de 2FA.
 */
export function AuthCallbackPage() {
  const { restoreSession, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    // Limpia el fragmento para que no quede en el historial
    window.history.replaceState(null, '', window.location.pathname);

    const failure = params.get('error');
    if (failure) {
      setError(ERROR_MESSAGES[failure] ?? 'No pudimos completar el inicio de sesion.');
      return;
    }
    const challenge = params.get('mfaToken');
    if (challenge) {
      setMfaToken(challenge);
      return;
    }
    if (params.get('status') !== 'ok') {
      setError('La respuesta del proveedor venia incompleta.');
      return;
    }
    restoreSession()
      .then((ok) => {
        if (ok) navigate('/', { replace: true });
        else setError('No pudimos validar la sesion recibida.');
      })
      .catch(() => setError('No pudimos validar la sesion recibida.'));
  }, [restoreSession, navigate]);

  if (mfaToken) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100 p-3">
        <div className="card border-0 shadow-sm lc-auth-card">
          <div className="card-body p-4">
            <h1 className="h5 text-center mb-3">Verificacion en dos pasos</h1>
            <MfaCodeForm
              onSubmit={async (code) => {
                await verifyMfa(mfaToken, code);
                navigate('/', { replace: true });
              }}
              onCancel={() => navigate('/login', { replace: true })}
            />
          </div>
        </div>
      </div>
    );
  }

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
