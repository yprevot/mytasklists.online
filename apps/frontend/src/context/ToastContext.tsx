import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info' | 'primary';

export interface ToastMessage {
  id: string;
  title: string;
  body: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  show: (toast: Omit<ToastMessage, 'id' | 'createdAt'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: 'bi-check-circle-fill',
  danger: 'bi-exclamation-octagon-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
  primary: 'bi-bell-fill',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ToastMessage, 'id' | 'createdAt'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current.slice(-4), { ...toast, id, createdAt: Date.now() }]);
      window.setTimeout(() => dismiss(id), 7000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="toast-container position-fixed top-0 end-0 p-3"
        style={{ zIndex: 1080 }}
        data-testid="toast-container"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast show align-items-center border-0 mb-2 text-bg-${toast.variant}`}
            role="alert"
            data-testid="toast"
            data-variant={toast.variant}
          >
            <div className="d-flex">
              <div className="toast-body">
                <div className="d-flex align-items-start gap-2">
                  <i className={`bi ${VARIANT_ICON[toast.variant]} fs-5`} aria-hidden="true" />
                  <div>
                    <div className="fw-semibold" data-testid="toast-title">
                      {toast.title}
                    </div>
                    <div className="small" data-testid="toast-body">
                      {toast.body}
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label={t('common.close')}
                data-testid="toast-close"
                onClick={() => dismiss(toast.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
}
