import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALE_TAGS, currentLanguage } from '../i18n';
import { adminApi } from '../api/endpoints';
import type { AdminListRow, Paginated } from '../types';

export function ListsPage() {
  const { t } = useTranslation();
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
      <h1 className="lc-page-title mb-4">{t('lists.title')}</h1>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <input
              className="form-control"
              style={{ maxWidth: 320 }}
              placeholder={t('lists.search')}
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              data-testid="lists-search"
            />
            <span className="ms-auto align-self-center text-muted small" data-testid="lists-total">
              {t('lists.total', { count: result?.total ?? 0 })}
            </span>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle" data-testid="lists-table">
              <thead>
                <tr>
                  <th scope="col">{t('lists.list')}</th>
                  <th scope="col">{t('lists.owner')}</th>
                  <th scope="col" className="text-center">
                    {t('lists.members')}
                  </th>
                  <th scope="col" className="text-center">
                    {t('lists.items')}
                  </th>
                  <th scope="col">{t('lists.lastActivity')}</th>
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
                        <span className="badge text-bg-secondary ms-2">{t('lists.archived')}</span>
                      )}
                    </td>
                    <td className="text-muted">
                      {list.ownerName}
                      <div className="small">{list.ownerEmail}</div>
                    </td>
                    <td className="text-center">{list.memberCount}</td>
                    <td className="text-center">{list.itemCount}</td>
                    <td className="text-muted small">
                      {new Date(list.updatedAt).toLocaleString(LOCALE_TAGS[currentLanguage()])}
                    </td>
                  </tr>
                ))}
                {result?.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      {t('common.noResults')}
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
