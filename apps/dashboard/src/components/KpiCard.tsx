interface Props {
  label: string;
  value: number | string;
  hint?: string;
  icon: string;
  variant?: string;
  testId?: string;
}

export function KpiCard({ label, value, hint, icon, variant = 'primary', testId }: Props) {
  return (
    <div className="dash-kpi p-3 h-100 d-flex align-items-start gap-3" data-testid={testId}>
      <span className={`badge text-bg-${variant} p-2 fs-6`} aria-hidden="true">
        <i className={`bi ${icon}`} />
      </span>
      <div className="min-w-0">
        <div className="value" data-testid={testId ? `${testId}-value` : undefined}>
          {value}
        </div>
        <div className="label">{label}</div>
        {hint && <div className="small text-muted mt-1">{hint}</div>}
      </div>
    </div>
  );
}
