import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { usersApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function SettingsPage() {
  const { user, setUser, adoptSession } = useAuth();
  const { show } = useToast();
  const { t } = useTranslation();
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
      show({ title: t('settings.saved'), body: t('settings.savedBody'), variant: 'success' });
    } catch (err) {
      show({
        title: t('settings.saveFailed'),
        body: err instanceof ApiError ? err.message : t('common.tryAgain'),
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
        title: t('settings.passwordChanged'),
        body: t('settings.passwordChangedBody'),
        variant: 'success',
      });
    } catch (err) {
      show({
        title: t('settings.changeFailed'),
        body: err instanceof ApiError ? err.message : t('common.tryAgain'),
        variant: 'danger',
      });
    } finally {
      setChanging(false);
    }
  };

  return (
    <div data-testid="settings-page">
      <h1 className="lc-page-title mb-4">{t('settings.title')}</h1>

      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <form className="card border-0 shadow-sm" onSubmit={saveProfile} data-testid="profile-form">
            <div className="card-body">
              <h2 className="h5 mb-3">{t('settings.personal')}</h2>

              <div className="mb-3">
                <label className="form-label" htmlFor="profile-name">
                  {t('common.fullName')}
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
                  {t('common.email')}
                </label>
                <input id="profile-email" className="form-control" value={user.email} disabled />
                <div className="form-text">
                  {t('settings.createdWith')} <strong>{t(`providers.${user.provider}`)}</strong>
                  {' · '}
                  {user.emailVerified ? (
                    <span className="text-success" data-testid="email-verified">
                      {t('settings.emailVerified')}
                    </span>
                  ) : (
                    <span className="text-warning-emphasis" data-testid="email-unverified">
                      {t('settings.emailUnverified')}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="profile-whatsapp">
                  {t('common.whatsapp')}
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
                  {t('settings.notifications')}
                </label>
              </div>

              <button className="btn btn-primary" type="submit" disabled={saving} data-testid="profile-save">
                {saving ? t('common.saving') : t('settings.save')}
              </button>
            </div>
          </form>
        </div>

        <div className="col-12 col-lg-5">
          <form className="card border-0 shadow-sm" onSubmit={changePassword} data-testid="password-form">
            <div className="card-body">
              <h2 className="h5 mb-3">{t('settings.passwordTitle')}</h2>

              {(user.hasPassword ?? user.provider === 'local') && (
                <div className="mb-3">
                  <label className="form-label" htmlFor="current-password">
                    {t('settings.currentPassword')}
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
                  {t('settings.newPassword')}
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
                <div className="form-text">{t('common.minPassword')}</div>
              </div>

              <button
                className="btn btn-outline-primary"
                type="submit"
                disabled={changing || newPassword.length < 8}
                data-testid="password-save"
              >
                {changing ? t('settings.changing') : t('settings.changePassword')}
              </button>
            </div>
          </form>

          <div className="card border-0 shadow-sm mt-4" data-testid="language-card">
            <div className="card-body">
              <h2 className="h5 mb-3">{t('settings.languageTitle')}</h2>
              <LanguageSwitcher />
              <div className="form-text mt-2">{t('settings.languageHint')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
