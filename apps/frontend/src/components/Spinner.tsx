import { useTranslation } from 'react-i18next';

export function Spinner({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-3" data-testid="spinner">
      <div className="lc-spinner" role="status" aria-hidden="true" />
      <span className="text-muted small">{label ?? t('common.loading')}</span>
    </div>
  );
}
