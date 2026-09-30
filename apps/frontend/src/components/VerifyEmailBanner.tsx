import { useState } from 'react';
import { authApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Recordatorio para confirmar el correo, con reenvio del enlace */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  const resend = async () => {
    setState('sending');
    setError(null);
    try {
      await authApi.resendVerification();
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reenviar');
      setState('idle');
    }
  };

  return (
    <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 small" data-testid="verify-banner">
      <i className="bi bi-envelope-exclamation" aria-hidden="true" />
      <span className="flex-grow-1">
        Confirma tu correo <strong>{user.email}</strong> con el enlace que te enviamos.
        {error ? ` ${error}` : ''}
      </span>
      {state === 'sent' ? (
        <span className="text-success" data-testid="verify-resent">
          Enlace reenviado
        </span>
      ) : (
        <button
          className="btn btn-sm btn-outline-dark"
          onClick={resend}
          disabled={state === 'sending'}
          data-testid="verify-resend"
        >
          {state === 'sending' ? 'Enviando…' : 'Reenviar enlace'}
        </button>
      )}
    </div>
  );
}
