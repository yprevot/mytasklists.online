import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="text-center py-5" data-testid="not-found">
      <div style={{ fontSize: '3rem' }} aria-hidden="true">
        🧭
      </div>
      <h1 className="h4 mt-3">No encontramos esta pagina</h1>
      <p className="text-muted">Puede que el enlace haya cambiado o que la lista ya no exista.</p>
      <Link className="btn btn-primary" to="/">
        Ir a mis listas
      </Link>
    </div>
  );
}
