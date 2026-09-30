import { useEffect, useState, type FormEvent } from 'react';
import { usersApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function SettingsPage() {
  const { user, setUser, adoptSession } = useAuth();
  const { show } = useToast();
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setWhatsapp(user.whatsapp ?? '');
    setNotificationsEnabled(user.notificationsEnabled);
  }, [user]);

  if (!user) return null;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await usersApi.updateProfile({
        fullName: fullName.trim(),
        whatsapp: whatsapp.trim(),
        notificationsEnabled,
      });
      setUser(updated);
      show({ title: 'Perfil actualizado', body: 'Tus datos quedaron guardados', variant: 'success' });
    } catch (err) {
      show({
        title: 'No se pudo guardar',
        body: err instanceof ApiError ? err.message : 'Intentalo de nuevo',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setChanging(true);
    try {
      // El backend cierra las demas sesiones y devuelve un par nuevo para esta
      const session = await usersApi.changePassword(currentPassword, newPassword);
      adoptSession({ ...session, user: { ...session.user, hasPassword: true } });
      setCurrentPassword('');
      setNewPassword('');
      show({
        title: 'Contrasena actualizada',
        body: 'Cerramos tus sesiones en otros dispositivos',
        variant: 'success',
      });
    } catch (err) {
      show({
        title: 'No se pudo cambiar',
        body: err instanceof ApiError ? err.message : 'Intentalo de nuevo',
        variant: 'danger',
      });
    } finally {
      setChanging(false);
    }
  };

  return (
    <div data-testid="settings-page">
      <h1 className="h3 mb-4">Mi cuenta</h1>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <form className="card border-0 shadow-sm" onSubmit={saveProfile} data-testid="profile-form">
            <div className="card-body">
              <h2 className="h6 mb-3">Datos personales</h2>

              <div className="mb-3">
                <label className="form-label" htmlFor="profile-name">
                  Nombre completo
                </label>
                <input
                  id="profile-name"
                  className="form-control"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  data-testid="profile-fullname"
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="profile-email">
                  Correo electronico
                </label>
                <input id="profile-email" className="form-control" value={user.email} disabled />
                <div className="form-text">
                  Cuenta creada con <strong className="text-capitalize">{user.provider}</strong>
                  {' · '}
                  {user.emailVerified ? (
                    <span className="text-success" data-testid="email-verified">
                      correo confirmado
                    </span>
                  ) : (
                    <span className="text-warning-emphasis" data-testid="email-unverified">
                      correo sin confirmar
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="profile-whatsapp">
                  Numero de WhatsApp
                </label>
                <input
                  id="profile-whatsapp"
                  className="form-control"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="+5215512345678"
                  data-testid="profile-whatsapp"
                />
              </div>

              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="profile-notifications"
                  checked={notificationsEnabled}
                  onChange={(event) => setNotificationsEnabled(event.target.checked)}
                  data-testid="profile-notifications"
                />
                <label className="form-check-label" htmlFor="profile-notifications">
                  Recibir avisos cuando alguien modifique una lista compartida
                </label>
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving} data-testid="profile-save">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>

        <div className="col-12 col-lg-5">
          <form className="card border-0 shadow-sm" onSubmit={changePassword} data-testid="password-form">
            <div className="card-body">
              <h2 className="h6 mb-3">Contrasena</h2>

              {(user.hasPassword ?? user.provider === 'local') && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="current-password">
                    Contrasena actual
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    className="form-control"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    data-testid="current-password"
                  />
                </div>
              )}

              <div className="mb-3">
                <label className="form-label" htmlFor="new-password">
                  Nueva contrasena
                </label>
                <input
                  id="new-password"
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  data-testid="new-password"
                />
                <div className="form-text">Minimo 8 caracteres.</div>
              </div>

              <button
                className="btn btn-outline-primary"
                type="submit"
                disabled={changing || newPassword.length < 8}
                data-testid="password-save"
              >
                {changing ? 'Actualizando…' : 'Cambiar contrasena'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
