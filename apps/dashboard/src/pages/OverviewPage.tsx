import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALE_TAGS, currentLanguage } from '../i18n';
import { adminApi } from '../api/endpoints';
import { KpiCard } from '../components/KpiCard';
import { BarChart } from '../components/BarChart';
import type { AdminStats, SeriesPoint } from '../types';

export function OverviewPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextStats, nextSeries] = await Promise.all([adminApi.stats(), adminApi.timeseries(14)]);
      setStats(nextStats);
      setSeries(nextSeries);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const runRecurrence = async () => {
    setRunning(true);
    try {
      const result = await adminApi.runRecurrence();
      setLastRun(t('overview.runResult', { reactivated: result.reactivated, overdue: result.overdue }));
      await load();
    } catch (err) {
      setLastRun(t('overview.runError', { message: (err as Error).message }));
    } finally {
      setRunning(false);
    }
  };

  if (error) {
    return (
      <div className="alert alert-danger" data-testid="overview-error">
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="d-flex justify-content-center py-5" data-testid="spinner">
        <div className="lc-spinner" role="status" />
      </div>
    );
  }

  return (
    <div data-testid="overview-page">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="lc-page-title mb-1">{t('overview.title')}</h1>
          <p className="text-muted small mb-0">
            {t('overview.updated', {
              time: new Date(stats.generatedAt).toLocaleTimeString(LOCALE_TAGS[currentLanguage()]),
            })}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {lastRun && (
            <span className="small text-muted" data-testid="recurrence-result">
              {lastRun}
            </span>
          )}
          <button
            className="btn btn-outline-primary"
            onClick={runRecurrence}
            disabled={running}
            data-testid="run-recurrence"
          >
            <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
            {running ? t('overview.running') : t('overview.run')}
          </button>
        </div>
      </div>

      <div className="dash-kpis mb-4">
          <KpiCard
            testId="kpi-users"
            label={t('overview.users')}
            value={stats.users.total}
            hint={t('overview.usersHint', { active: stats.users.active, recent: stats.users.newLast7Days })}
            icon="bi-people-fill"
          />
          <KpiCard
            testId="kpi-lists"
            label={t('overview.lists')}
            value={stats.lists.total}
            hint={t('overview.listsHint', { shared: stats.lists.shared, average: stats.lists.averageItems })}
            icon="bi-card-checklist"
            variant="success"
          />
          <KpiCard
            testId="kpi-recurring"
            label={t('overview.recurring')}
            value={stats.items.recurring}
            hint={t('overview.recurringHint', { pending: stats.items.pending })}
            icon="bi-arrow-repeat"
            variant="info"
          />
          <KpiCard
            testId="kpi-overdue"
            label={t('overview.overdue')}
            value={stats.items.overdue}
            hint={t('overview.overdueHint', { today: stats.items.purchasedToday })}
            icon="bi-exclamation-triangle-fill"
            variant="danger"
          />
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">{t('overview.activity')}</h2>
              <BarChart data={series} />
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-3">{t('overview.distribution')}</h2>

              <h3 className="lc-section-title mb-1">{t('overview.signupMethod')}</h3>
              <ul className="list-group list-group-flush mb-3" data-testid="provider-breakdown">
                {Object.entries(stats.users.byProvider).map(([provider, count]) => (
                  <li
                    key={provider}
                    className="list-group-item d-flex justify-content-between px-0 py-1 text-capitalize"
                  >
                    <span>{provider}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>

              <h3 className="lc-section-title mb-1">{t('overview.items')}</h3>
              <ul className="list-group list-group-flush" data-testid="items-breakdown">
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>{t('overview.pending')}</span>
                  <strong>{stats.items.pending}</strong>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>{t('overview.purchased')}</span>
                  <strong>{stats.items.purchased}</strong>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>{t('overview.archived')}</span>
                  <strong>{stats.items.archived}</strong>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>{t('overview.unread')}</span>
                  <strong>{stats.notifications.unread}</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
