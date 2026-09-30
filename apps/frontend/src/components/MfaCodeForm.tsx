import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../api/client';

interface Props {
  onSubmit: (code: string) => Promise<void>;
  onCancel: () => void;
}

/** Segundo paso del login cuando la cuenta tiene verificacion en dos pasos */
export function MfaCodeForm({ onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
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
      setError(err instanceof ApiError ? err.message : t('mfa.failed'));
      if (err instanceof ApiError && err.status === 401 && /vuelve|again/i.test(err.message)) onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate data-testid="mfa-form">
      <p className="text-muted small">
        {t('mfa.hint')}
      </p>
      <div className="mb-3">
        <label className="form-label" htmlFor="mfa-code">
          {t('mfa.code')}
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
        {submitting ? t('mfa.verifying') : t('mfa.verify')}
      </button>
      <button type="button" className="btn btn-link w-100 mt-2" onClick={onCancel}>
        {t('common.back')}
      </button>
    </form>
  );
}
