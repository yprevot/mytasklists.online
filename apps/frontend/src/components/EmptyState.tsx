import type { ReactNode } from 'react';

interface Props {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
  testId?: string;
}

export function EmptyState({ icon, title, description, action, testId }: Props) {
  return (
    <div className="text-center py-5 px-3" data-testid={testId ?? 'empty-state'}>
      <i className={`bi ${icon} text-secondary`} style={{ fontSize: '2.5rem' }} aria-hidden="true" />
      <h3 className="h6 mt-3 mb-1">{title}</h3>
      {description && <p className="text-muted small mb-3">{description}</p>}
      {action}
    </div>
  );
}
