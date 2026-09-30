export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-2" data-testid="spinner">
      <div className="spinner-border text-primary" role="status" aria-hidden="true" />
      <span className="text-muted small">{label}</span>
    </div>
  );
}
