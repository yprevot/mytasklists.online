import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const NAV = [
  { to: '/', label: 'Resumen', icon: 'bi-speedometer2', end: true },
  { to: '/users', label: 'Usuarios', icon: 'bi-people' },
  { to: '/lists', label: 'Listas', icon: 'bi-card-checklist' },
  { to: '/activity', label: 'Bitacora', icon: 'bi-clock-history' },
  { to: '/security', label: 'Seguridad', icon: 'bi-shield-lock' },
];

export function Layout() {
  const { user, logout } = useAdminAuth();

  return (
    <div className="d-flex flex-column flex-md-row min-vh-100">
      <aside className="dash-sidebar p-3" data-testid="sidebar">
        <div className="d-flex align-items-center gap-2 mb-4 text-white">
          <span style={{ fontSize: '1.4rem' }} aria-hidden="true">
            📊
          </span>
          <div>
            <div className="fw-bold">ListaDeCompras</div>
            <div className="small text-white-50">Panel de administracion</div>
          </div>
        </div>

        <nav className="nav flex-column gap-1">
          {NAV.map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              className="px-3 py-2 d-flex align-items-center gap-2"
              data-testid={`nav-${entry.label.toLowerCase()}`}
            >
              <i className={`bi ${entry.icon}`} aria-hidden="true" />
              {entry.label}
            </NavLink>
          ))}
        </nav>

        <hr className="text-white-50" />
        <div className="small text-white-50 px-2" data-testid="sidebar-user">
          {user?.fullName}
          <div className="text-truncate">{user?.email}</div>
        </div>
        <button
          className="btn btn-sm btn-outline-light w-100 mt-2"
          onClick={logout}
          data-testid="logout-button"
        >
          Cerrar sesion
        </button>
      </aside>

      <main className="flex-grow-1 p-3 p-lg-4" style={{ minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
