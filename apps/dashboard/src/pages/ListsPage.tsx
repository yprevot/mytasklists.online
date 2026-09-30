import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';
import type { AdminListRow, Paginated } from '../types';

export function ListsPage() {
  const [result, setResult] = useState<Paginated<AdminListRow> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setResult(await adminApi.lists(page, search));
  }, [page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div data-testid="lists-page">
      <h1 className="h4 mb-3">Listas</h1>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <input
              className="form-control"
              style={{ maxWidth: 320 }}
              placeholder="Buscar por nombre o propietario…"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              data-testid="lists-search"
            />
            <span className="ms-auto align-self-center text-muted small" data-testid="lists-total">
              {result?.total ?? 0} lista(s)
            </span>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle" data-testid="lists-table">
              <thead>
                <tr>
                  <th scope="col">Lista</th>
                  <th scope="col">Propietario</th>
                  <th scope="col" className="text-center">
                    Integrantes
                  </th>
                  <th scope="col" className="text-center">
                    Productos
                  </th>
                  <th scope="col">Ultima actividad</th>
                </tr>
              </thead>
              <tbody>
                {(result?.data ?? []).map((list) => (
                  <tr key={list.id} data-testid="list-row" data-list-name={list.name}>
                    <td>
                      <span className="me-2" aria-hidden="true">
                        {list.icon}
                      </span>
                      {list.name}
                      {list.isArchived && (
                        <span className="badge text-bg-secondary ms-2">archivada</span>
                      )}
                    </td>
                    <td className="text-muted">
                      {list.ownerName}
                      <div className="small">{list.ownerEmail}</div>
                    </td>
                    <td className="text-center">{list.memberCount}</td>
                    <td className="text-center">{list.itemCount}</td>
                    <td className="text-muted small">
                      {new Date(list.updatedAt).toLocaleString('es-MX')}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
