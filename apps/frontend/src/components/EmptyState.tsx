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
    <div className="lc-empty" data-testid={testId ?? 'empty-state'}>
      <div className="lc-empty-icon">
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <h3 className="h6">{title}</h3>
      {description && <p className="text-muted small mb-3 mx-auto" style={{ maxWidth: '34ch' }}>{description}</p>}
      {action}
    </div>
  );
}
