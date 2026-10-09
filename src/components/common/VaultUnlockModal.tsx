import React, { useState } from 'react';
import { Lock, Key, AlertTriangle, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { TaskRepository } from '../../repositories/TaskRepository';
import { sound } from '../../utils/sound';

interface VaultUnlockModalProps {
  isOpen: boolean;
  onUnlocked: () => void;
  onClose?: () => void;
}

export const VaultUnlockModal: React.FC<VaultUnlockModalProps> = ({
  isOpen,
  onUnlocked,
  onClose,
}) => {
  const [mode, setMode] = useState<'password' | 'recovery'>('password');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    sound.playTap();

    try {
      if (mode === 'password') {
        if (!password.trim()) {
          setError('Введите пароль');
          setIsSubmitting(false);
          return;
        }
        await TaskRepository.unlockVault(password);
      } else {
        if (!recoveryKey.trim()) {
          setError('Введите ключ восстановления');
          setIsSubmitting(false);
          return;
        }
        await TaskRepository.unlockVaultWithRecoveryKey(recoveryKey);
      }

      sound.playComplete();
      setPassword('');
      setRecoveryKey('');
      onUnlocked();
    } catch (err: any) {
      sound.playAlert();
      setError(err?.message || (mode === 'password' ? 'Неверный пароль' : 'Неверный ключ восстановления'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[var(--color-bg-panel)] border border-[var(--color-border-glass)] rounded-3xl p-6 shadow-2xl text-[var(--color-content-primary)]">
        {onClose && (
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="absolute top-5 right-5 p-2 rounded-xl text-[var(--color-content-muted)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-emerald-500)]/15 border border-[var(--color-emerald-500)]/30 flex items-center justify-center text-[var(--color-emerald-400)]">
            <Lock size={24} />
          </div>
          <div>
            <h2 className="text-xl font-serif font-medium tracking-tight">
              Хранилище заблокировано
            </h2>
            <p className="text-xs text-[var(--color-content-muted)]">
              {mode === 'password'
                ? 'Введите пароль для расшифровки задач'
                : 'Введите аварийный ключ восстановления'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'password' ? (
            <div>
              <label className="block text-xs font-medium text-[var(--color-content-secondary)] mb-1.5">
                Пароль от хранилища
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoFocus
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-input)] focus:border-[var(--color-emerald-500)] focus:outline-none text-sm transition-colors"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-[var(--color-content-secondary)] mb-1.5">
                Ключ восстановления
              </label>
              <input
                type="text"
                value={recoveryKey}
                onChange={e => setRecoveryKey(e.target.value)}
                placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                autoFocus
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-input)] focus:border-[var(--color-emerald-500)] focus:outline-none text-sm font-mono transition-colors uppercase"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setError(null);
                setMode(m => (m === 'password' ? 'recovery' : 'password'));
              }}
              className="text-xs text-[var(--color-content-muted)] hover:text-[var(--color-emerald-400)] transition-colors flex items-center gap-1.5"
            >
              <Key size={13} />
              {mode === 'password'
                ? 'Использовать ключ восстановления'
                : 'Войти по паролю'}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-2xl bg-[var(--color-emerald-600)] hover:bg-[var(--color-emerald-500)] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/20"
          >
            {isSubmitting ? (
              <span>Расшифровка...</span>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>Разблокировать</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
