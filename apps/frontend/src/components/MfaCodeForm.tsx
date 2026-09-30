import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';

interface Props {
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
}

/** Segundo paso del login cuando la cuenta tiene verificacion en dos pasos */
export function MfaCodeForm({ onSubmit, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(code.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo verificar el codigo');
      if (err instanceof ApiError && err.status === 401 && /vuelve/i.test(err.message)) onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate data-testid="mfa-form">
      <p className="text-muted small">
        Escribe el codigo de 6 digitos de tu app autenticadora. Si perdiste el telefono, usa uno de tus
        codigos de recuperacion.
      </p>
      <div className="mb-3">
        <label className="form-label" htmlFor="mfa-code">
          Codigo de verificacion
        </label>
        <input
          id="mfa-code"
          className="form-control text-center fs-5"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={20}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          data-testid="mfa-code"
        />
      </div>
      {error && (
        <div className="alert alert-danger py-2 small" role="alert" data-testid="mfa-error">
          {error}
        </div>
      )}
      <button className="btn btn-primary w-100" type="submit" disabled={submitting} data-testid="mfa-submit">
        {submitting ? 'Verificando…' : 'Verificar'}
      </button>
      <button type="button" className="btn btn-link w-100 mt-2" onClick={onCancel}>
        Volver
      </button>
    </form>
  );
}
