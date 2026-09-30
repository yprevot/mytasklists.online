interface Props {
  label: string;
  value: number | string;
  hint?: string;
  icon: string;
  /** 'danger' pinta la cifra en rojo cuando hay algo que atender */
  variant?: string;
  testId?: string;
}

export function KpiCard({ label, value, hint, icon, variant = 'primary', testId }: Props) {
  const alert = variant === 'danger' && Number(value) > 0;
  return (
    <div className="dash-kpi" data-testid={testId}>
      <div className="dash-kpi-label">
        <span>{label}</span>
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <div
        className={`dash-kpi-value ${alert ? 'is-alert' : ''}`}
        data-testid={testId ? `${testId}-value` : undefined}
      >
        {value}
      </div>
      {hint && <div className="dash-kpi-hint">{hint}</div>}
    </div>
  );
}
