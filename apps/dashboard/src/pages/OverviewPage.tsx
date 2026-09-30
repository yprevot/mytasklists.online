import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/endpoints';
import { KpiCard } from '../components/KpiCard';
import { BarChart } from '../components/BarChart';
import type { AdminStats, SeriesPoint } from '../types';

export function OverviewPage() {
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
      setLastRun(`${result.reactivated} reactivados · ${result.overdue} vencidos`);
      await load();
    } catch (err) {
      setLastRun(`Error: ${(err as Error).message}`);
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
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div data-testid="overview-page">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 mb-1">Resumen</h1>
          <p className="text-muted small mb-0">
            Actualizado {new Date(stats.generatedAt).toLocaleTimeString('es-MX')}
          </p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {lastRun && (
            <span className="small text-muted" data-testid="recurrence-result">
              {lastRun}
            </span>
          )}
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={runRecurrence}
            disabled={running}
            data-testid="run-recurrence"
          >
            <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
            {running ? 'Ejecutando…' : 'Ejecutar motor de recurrencia'}
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <KpiCard
            testId="kpi-users"
            label="Usuarios"
            value={stats.users.total}
            hint={`${stats.users.active} activos · +${stats.users.newLast7Days} esta semana`}
            icon="bi-people-fill"
          />
        </div>
        <div className="col-6 col-lg-3">
          <KpiCard
            testId="kpi-lists"
            label="Listas"
            value={stats.lists.total}
            hint={`${stats.lists.shared} compartidas · ${stats.lists.averageItems} productos de media`}
            icon="bi-card-checklist"
            variant="success"
          />
        </div>
        <div className="col-6 col-lg-3">
          <KpiCard
            testId="kpi-recurring"
            label="Productos recurrentes"
            value={stats.items.recurring}
            hint={`${stats.items.pending} pendientes en total`}
            icon="bi-arrow-repeat"
            variant="info"
          />
        </div>
        <div className="col-6 col-lg-3">
          <KpiCard
            testId="kpi-overdue"
            label="Recurrentes vencidos"
            value={stats.items.overdue}
            hint={`${stats.items.purchasedToday} comprados hoy`}
            icon="bi-exclamation-triangle-fill"
            variant="danger"
          />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h6 mb-3">Actividad de los ultimos 14 dias</h2>
              <BarChart data={series} />
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h6 mb-3">Distribucion</h2>

              <h3 className="label small text-uppercase text-muted">Metodo de registro</h3>
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

              <h3 className="label small text-uppercase text-muted">Productos</h3>
              <ul className="list-group list-group-flush" data-testid="items-breakdown">
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>Pendientes</span>
                  <strong>{stats.items.pending}</strong>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>Comprados</span>
                  <strong>{stats.items.purchased}</strong>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>Archivados</span>
                  <strong>{stats.items.archived}</strong>
                </li>
                <li className="list-group-item d-flex justify-content-between px-0 py-1">
                  <span>Avisos sin leer</span>
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
