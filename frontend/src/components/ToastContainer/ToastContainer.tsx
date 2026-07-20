import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ToastMessage } from '../../types/game';
import styles from './ToastContainer.module.css';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          role="status"
        >
          {toast.type === 'success' && <CheckCircle2 size={18} aria-hidden="true" />}
          {toast.type === 'error' && <XCircle size={18} aria-hidden="true" />}
          {toast.type === 'info' && <Info size={18} aria-hidden="true" />}
          <span>{toast.message}</span>
          <button
            type="button"
            className={styles.close}
            onClick={() => onDismiss(toast.id)}
            aria-label="Fechar notificação"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
