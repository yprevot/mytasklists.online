import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { VerifyEmailBanner } from './VerifyEmailBanner';

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export function Layout() {
  const { user, logout } = useAuth();
  const { connected, notifications } = useSocket();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  // El detalle de una lista cuelga de "Mis listas": que la pestaña siga marcada
  const listsActive = pathname.startsWith('/lists/');

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-vh-100 d-flex flex-column">
      <header className="lc-topbar">
        <div className="container lc-shell lc-topbar-inner">
          <Brand to="/" />

          {/* Escritorio: pestañas en la barra. Telefono: barra inferior (ver app.css) */}
          <nav className="lc-nav" aria-label={t('layout.mainNav')}>
            <ul>
              <li>
                <NavLink to="/" end className={listsActive ? 'active' : undefined} data-testid="nav-lists">
                  <i className="bi bi-card-checklist" aria-hidden="true" />
                  {t('layout.lists')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/settings" data-testid="nav-settings">
                  <i className="bi bi-person-circle" aria-hidden="true" />
                  {t('layout.account')}
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="d-flex align-items-center gap-2 gap-md-3">
            <span
              className="lc-live"
              data-testid="connection-status"
              data-connected={connected ? 'true' : 'false'}
              title={connected ? t('layout.liveOnTitle') : t('layout.liveOffTitle')}
            >
              <span
                className="lc-badge-dot"
                style={{ backgroundColor: connected ? 'var(--bs-success)' : 'var(--lc-bought)' }}
              />
              <span className="d-none d-md-inline">{connected ? t('layout.liveOn') : t('layout.liveOff')}</span>
            </span>

            <LanguageSwitcher className="d-none d-sm-inline-flex" />

            <span className="lc-bell" data-testid="notification-bell">
              <i className="bi bi-bell" aria-hidden="true" />
              {notifications.length > 0 && (
                <span
                  className="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger"
                  data-testid="notification-count"
                >
                  {notifications.length}
                </span>
              )}
            </span>

            {user && (
              <div className="dropdown">
                <button
                  className="btn btn-link p-0 border-0 d-flex align-items-center gap-2 text-decoration-none"
                  style={{ minHeight: '2.25rem' }}
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  aria-label={user.fullName}
                  data-testid="user-menu"
                >
                  <span className="lc-avatar">{initials(user.fullName)}</span>
                  <span className="d-none d-lg-inline text-body small fw-semibold">{user.fullName}</span>
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <span className="dropdown-item-text small text-muted">{user.email}</span>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/settings">
                      {t('layout.account')}
                    </Link>
                  </li>
                  <li>
                    <button
                      className="dropdown-item text-danger"
                      onClick={handleLogout}
                      data-testid="logout-button"
                    >
                      {t('layout.logout')}
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container lc-shell lc-page flex-grow-1 py-4 py-md-5">
        <VerifyEmailBanner />
        <Outlet />
      </main>

      <footer className="lc-footer py-3 mt-auto">
        <div className="container lc-shell d-flex flex-wrap justify-content-between gap-2">
          <span>{t('layout.footer')}</span>
          <a href="/" data-testid="footer-landing">
            {t('layout.download')}
          </a>
        </div>
      </footer>
    </div>
  );
}
