import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';
import type { AdminUser, Paginated } from '../types';

export function UsersPage() {
  const [result, setResult] = useState<Paginated<AdminUser> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setResult(await adminApi.users(page, search));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = async (user: AdminUser) => {
    await adminApi.setUserActive(user.id, !user.isActive);
    await load();
  };

  const resetMfa = async (user: AdminUser) => {
    if (!window.confirm(`¿Quitar la verificacion en dos pasos de ${user.email}? Se cerraran sus sesiones.`)) {
      return;
    }
    await adminApi.resetUserMfa(user.id);
    await load();
  };

  return (
    <div data-testid="users-page">
      <h1 className="h4 mb-3">Usuarios</h1>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <input
              className="form-control"
              style={{ maxWidth: 320 }}
              placeholder="Buscar por nombre o correo…"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              data-testid="users-search"
            />
            <span className="ms-auto align-self-center text-muted small" data-testid="users-total">
              {result?.total ?? 0} usuario(s)
            </span>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <div className="table-responsive">
            <table className="table table-sm align-middle" data-testid="users-table">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">WhatsApp</th>
                  <th scope="col">Registro</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="text-end">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {(result?.data ?? []).map((user) => (
                  <tr key={user.id} data-testid="user-row" data-email={user.email}>
                    <td>{user.fullName}</td>
                    <td className="text-muted">{user.email}</td>
                    <td className="text-muted">{user.whatsapp ?? '—'}</td>
                    <td>
                      <span className="badge text-bg-light border text-capitalize">{user.provider}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${user.role === 'admin' ? 'text-bg-dark' : 'text-bg-light border'}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.isActive ? 'text-bg-success' : 'text-bg-secondary'}`}>
                        {user.isActive ? 'activo' : 'inactivo'}
                      </span>
                      {user.mfaEnabled && (
                        <span className="badge text-bg-info ms-1" title="Verificacion en dos pasos activa">
                          2FA
                        </span>
                      )}
                      {!user.emailVerified && (
                        <span className="badge text-bg-warning ms-1" title="Correo sin confirmar">
                          sin verificar
                        </span>
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      {user.mfaEnabled && (
                        <button
                          className="btn btn-sm btn-outline-warning me-1"
                          onClick={() => resetMfa(user)}
                          data-testid="reset-mfa"
                        >
                          Quitar 2FA
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => toggleActive(user)}
                        data-testid="toggle-active"
                      >
                        {user.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result && result.pages > 1 && (
            <nav className="d-flex justify-content-between align-items-center">
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Anterior
              </button>
              <span className="small text-muted">
                Pagina {result.page} de {result.pages}
              </span>
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={page >= result.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
