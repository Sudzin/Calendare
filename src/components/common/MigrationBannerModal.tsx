import React from 'react';
import { Database, ArrowRight, X } from 'lucide-react';

interface MigrationBannerModalProps {
  taskCount: number;
  onMigrate: () => void;
  onDismiss: () => void;
}

export const MigrationBannerModal: React.FC<MigrationBannerModalProps> = ({
  taskCount,
  onMigrate,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-border-glass)] rounded-2xl p-6 shadow-2xl relative text-[var(--color-content-primary)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="migration-title"
      >
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 id="migration-title" className="font-serif text-lg font-medium tracking-tight">
              Импорт в файлы
            </h3>
            <p className="text-xs text-[var(--color-content-secondary)]">
              Переход на десктопное хранилище
            </p>
          </div>
        </div>

        <p className="text-sm text-[var(--color-content-secondary)] leading-relaxed mb-6">
          В браузере найдено <span className="font-semibold text-emerald-400">{taskCount}</span> задач.
          Желаете импортировать их в локальные файлы? Исходные данные в браузере останутся нетронутыми.
        </p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-xs font-medium rounded-xl text-[var(--color-content-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-content-primary)] transition-colors"
          >
            Позже
          </button>
          <button
            onClick={onMigrate}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-98"
          >
            <span>Импортировать</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
