import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-5" data-testid="not-found">
      <div style={{ fontSize: '3rem' }} aria-hidden="true">
        🧭
      </div>
      <h1 className="h4 mt-3">{t('notFound.title')}</h1>
      <p className="text-muted">{t('notFound.text')}</p>
      <Link className="btn btn-primary" to="/">
        {t('common.goToLists')}
      </Link>
    </div>
  );
}
