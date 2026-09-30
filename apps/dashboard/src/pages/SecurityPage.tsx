import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { adminApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAdminAuth } from '../context/AdminAuthContext';

type Setup = { secret: string; otpauthUrl: string; qr: string };

/** Verificacion en dos pasos (TOTP) de la cuenta de administracion */
export function SecurityPage() {
  const { user, reloadUser } = useAdminAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCode('');
    setError(null);
  }, [user?.mfaEnabled]);

  if (!user) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la accion');
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      const data = await adminApi.mfaSetup();
      // El QR se genera en el navegador: el secreto nunca sale hacia un servicio externo
      const qr = await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 220 });
      setSetup({ ...data, qr });
    });

  const enable = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await adminApi.mfaEnable(code.trim());
      setRecoveryCodes(result.recoveryCodes);
      setSetup(null);
      await reloadUser();
    });
  };

  const disable = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi.mfaDisable(code.trim());
      setRecoveryCodes(null);
      await reloadUser();
    });
  };

  return (
    <div data-testid="security-page">
      <h1 className="h4 mb-3">Seguridad</h1>

      <div className="card border-0 shadow-sm" style={{ maxWidth: 640 }}>
        <div className="card-body">
          <h2 className="h6 d-flex align-items-center gap-2">
            Verificacion en dos pasos
            <span
              className={`badge ${user.mfaEnabled ? 'text-bg-success' : 'text-bg-secondary'}`}
              data-testid="mfa-status"
            >
              {user.mfaEnabled ? 'activa' : 'inactiva'}
            </span>
          </h2>
          <p className="text-muted small">
            Ademas de la contrasena, el panel pedira un codigo de tu app autenticadora (Google
            Authenticator, 1Password, Authy…).
          </p>

          {recoveryCodes && (
            <div className="alert alert-warning small" data-testid="recovery-codes">
              <strong>Guarda estos codigos de recuperacion.</strong> Cada uno sirve una sola vez si pierdes
              el telefono y no se volveran a mostrar.
              <div className="row row-cols-2 g-1 mt-2 font-monospace">
                {recoveryCodes.map((entry) => (
                  <div key={entry} className="col">
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          {!user.mfaEnabled && !setup && (
            <button className="btn btn-primary" onClick={start} disabled={busy} data-testid="mfa-start">
              Activar verificacion en dos pasos
            </button>
          )}

          {!user.mfaEnabled && setup && (
            <form onSubmit={enable} data-testid="mfa-setup-form">
              <div className="d-flex flex-wrap gap-3 align-items-center mb-3">
                <img src={setup.qr} alt="Codigo QR para la app autenticadora" width={220} height={220} />
                <div className="small">
                  <p className="mb-1">1. Escanea el QR con tu app autenticadora.</p>
                  <p className="mb-1">O escribe esta clave a mano:</p>
                  <code className="d-block text-break" data-testid="mfa-secret">
                    {setup.secret}
                  </code>
                  <p className="mt-2 mb-0">2. Escribe el codigo de 6 digitos que muestra.</p>
                </div>
              </div>
              <div className="input-group" style={{ maxWidth: 320 }}>
                <input
                  className="form-control"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  data-testid="mfa-setup-code"
                />
                <button className="btn btn-primary" disabled={busy || !code.trim()} data-testid="mfa-enable">
                  Activar
                </button>
              </div>
            </form>
          )}

          {user.mfaEnabled && (
            <form onSubmit={disable} data-testid="mfa-disable-form">
              <label className="form-label small" htmlFor="mfa-disable-code">
                Para desactivarla escribe un codigo actual o de recuperacion
              </label>
              <div className="input-group" style={{ maxWidth: 320 }}>
                <input
                  id="mfa-disable-code"
                  className="form-control"
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  data-testid="mfa-disable-code"
                />
                <button
                  className="btn btn-outline-danger"
                  disabled={busy || !code.trim()}
                  data-testid="mfa-disable"
                >
                  Desactivar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
