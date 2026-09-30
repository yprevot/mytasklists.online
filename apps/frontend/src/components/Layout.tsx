import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-vh-100 d-flex flex-column">
      <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top">
        <div className="container lc-shell">
          <Link className="navbar-brand fw-bold d-flex align-items-center gap-2" to="/">
            <span aria-hidden="true">🛒</span>
            <span>ListaDeCompras</span>
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNav"
            aria-controls="mainNav"
            aria-expanded="false"
            aria-label={t('layout.openMenu')}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className="collapse navbar-collapse" id="mainNav">
            <ul className="navbar-nav me-auto">
              <li className="nav-item">
                <NavLink className="nav-link" to="/" end data-testid="nav-lists">
                  {t('layout.lists')}
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/settings" data-testid="nav-settings">
                  {t('layout.account')}
                </NavLink>
              </li>
            </ul>

            <div className="d-flex align-items-center gap-3">
              <span
                className={`lc-connection d-flex align-items-center gap-1 ${
                  connected ? 'text-success' : 'text-secondary'
                }`}
                data-testid="connection-status"
                data-connected={connected ? 'true' : 'false'}
                title={connected ? t('layout.liveOnTitle') : t('layout.liveOffTitle')}
              >
                <span
                  className="lc-badge-dot"
                  style={{ backgroundColor: connected ? 'var(--bs-success)' : 'var(--bs-secondary)' }}
                />
                {connected ? t('layout.liveOn') : t('layout.liveOff')}
              </span>

              <LanguageSwitcher />

              <span className="position-relative" data-testid="notification-bell">
                <i className="bi bi-bell fs-5 text-secondary" aria-hidden="true" />
                {notifications.length > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
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
                    type="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    data-testid="user-menu"
                  >
                    <span className="lc-avatar">{initials(user.fullName)}</span>
                    <span className="d-none d-lg-inline text-body small">{user.fullName}</span>
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
        </div>
      </nav>

      <main className="container lc-shell flex-grow-1 py-4">
        <VerifyEmailBanner />
        <Outlet />
      </main>

      <footer className="border-top bg-white py-3 mt-auto">
        <div className="container lc-shell d-flex flex-wrap justify-content-between gap-2 small text-muted">
          <span>{t('layout.footer')}</span>
          <a className="text-muted text-decoration-none" href="/" data-testid="footer-landing">
            {t('layout.download')}
          </a>
        </div>
      </footer>
    </div>
  );
}
