import React from 'react';
import { X, Bell } from 'lucide-react';
import { ToastItem } from '../../hooks/useNotifications';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 shadow-sm flex items-start gap-2.5 text-xs transition-all duration-150"
        >
          <div className="w-6 h-6 rounded-md bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-secondary)] shrink-0 mt-0.5">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="font-medium text-[var(--color-text-primary)] truncate">{t.title}</span>
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono tabular-nums">{t.timestamp}</span>
            </div>
            <p className="text-[var(--color-text-secondary)] mt-0.5 leading-snug">{t.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
