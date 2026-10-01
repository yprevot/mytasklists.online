import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ADMIN_MFA_REQUIRED_EVENT } from '../api/client';

interface NavEntry {
  to: string;
  key: 'overview' | 'users' | 'lists' | 'activity' | 'security';
  /** No depende del idioma: las pruebas e2e lo usan en los dos */
  testId: string;
  icon: string;
  end?: boolean;
}

const NAV: NavEntry[] = [
  { to: '/', key: 'overview', testId: 'resumen', icon: 'bi-speedometer2', end: true },
  { to: '/users', key: 'users', testId: 'usuarios', icon: 'bi-people' },
  { to: '/lists', key: 'lists', testId: 'listas', icon: 'bi-card-checklist' },
  { to: '/activity', key: 'activity', testId: 'bitacora', icon: 'bi-clock-history' },
  { to: '/security', key: 'security', testId: 'seguridad', icon: 'bi-shield-lock' },
];

export function Layout() {
  const { user, logout } = useAdminAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Sin 2FA la API corta el panel: se lleva a la persona a activarla
  useEffect(() => {
    const toSecurity = () => navigate('/security', { replace: true, state: { mfaRequired: true } });
    window.addEventListener(ADMIN_MFA_REQUIRED_EVENT, toSecurity);
    return () => window.removeEventListener(ADMIN_MFA_REQUIRED_EVENT, toSecurity);
  }, [navigate]);

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar" data-testid="sidebar">
        <div className="dash-brand">
          <BrandMark size={34} />
          <div className="min-w-0">
            <div className="dash-brand-name">MyTaskLists</div>
            <div className="dash-brand-role">{t('auth.title')}</div>
          </div>
        </div>

        <nav className="dash-nav" aria-label={t('auth.title')}>
          {NAV.map((entry) => (
            <NavLink key={entry.to} to={entry.to} end={entry.end} data-testid={`nav-${entry.testId}`}>
              <i className={`bi ${entry.icon}`} aria-hidden="true" />
              {t(`nav.${entry.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="dash-foot">
          <div className="dash-user" data-testid="sidebar-user">
            <span className="dash-user-name">{user?.fullName}</span>
            <span className="dash-user-email text-truncate">{user?.email}</span>
          </div>
          <div className="dash-foot-actions">
            <LanguageSwitcher />
            <button className="dash-logout" onClick={logout} aria-label={t('nav.logout')} data-testid="logout-button">
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span className="dash-logout-text">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}
