import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="lc-empty mx-auto" style={{ maxWidth: '32rem' }} data-testid="not-found">
      <div className="lc-empty-icon">
        <i className="bi bi-compass" aria-hidden="true" />
      </div>
      <h1 className="h4">{t('notFound.title')}</h1>
      <p className="text-muted mb-3">{t('notFound.text')}</p>
      <Link className="btn btn-primary" to="/">
        {t('common.goToLists')}
      </Link>
    </div>
  );
}
