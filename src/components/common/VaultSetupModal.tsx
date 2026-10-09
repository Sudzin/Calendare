import React, { useState } from 'react';
import { Shield, Key, AlertTriangle, Check, Copy, X, Lock } from 'lucide-react';
import { TaskRepository } from '../../repositories/TaskRepository';
import { sound } from '../../utils/sound';

interface VaultSetupModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export const VaultSetupModal: React.FC<VaultSetupModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
}) => {
  const [step, setStep] = useState<'create' | 'recovery'>('create');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cacheInCredMgr, setCacheInCredMgr] = useState(true);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setIsSubmitting(true);
    sound.playTap();

    try {
      const res = await TaskRepository.createVault(password, cacheInCredMgr);
      setRecoveryKey(res.recoveryKey);
      sound.playComplete();
      setStep('recovery');
    } catch (err: any) {
      sound.playAlert();
      setError(err?.message || 'Не удалось создать зашифрованное хранилище');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    sound.playTap();
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFinish = () => {
    if (!confirmedSaved) return;
    sound.playComplete();
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-glass)] rounded-3xl p-6 shadow-2xl text-[var(--color-content-primary)]">
        {step === 'create' && (
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
            <Shield size={24} />
          </div>
          <div>
            <h2 className="text-xl font-serif font-medium tracking-tight">
              {step === 'create'
                ? 'Шифрование хранилища (Vault)'
                : 'Ключ восстановления'}
            </h2>
            <p className="text-xs text-[var(--color-content-muted)]">
              {step === 'create'
                ? 'Защита задач алгоритмами AES-256-GCM и Argon2id'
                : 'Сохраните ключ отдельно для предотвращения потери данных'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'create' ? (
          <form onSubmit={handleCreateVault} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-content-secondary)] mb-1.5">
                Мастер-пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Придумайте надежный пароль"
                autoFocus
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-input)] focus:border-[var(--color-emerald-500)] focus:outline-none text-sm transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-content-secondary)] mb-1.5">
                Повторите мастер-пароль
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Повторите пароль для проверки"
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-input)] focus:border-[var(--color-emerald-500)] focus:outline-none text-sm transition-colors"
              />
            </div>

            <label className="flex items-start gap-3 p-3 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-glass)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cacheInCredMgr}
                onChange={e => setCacheInCredMgr(e.target.checked)}
                className="mt-0.5 rounded border-[var(--color-border-input)] text-[var(--color-emerald-600)] focus:ring-0"
              />
              <div className="text-xs">
                <span className="font-medium text-[var(--color-content-primary)] block">
                  Кэшировать производный ключ в Windows Credential Manager
                </span>
                <span className="text-[var(--color-content-muted)] text-[11px] block mt-0.5">
                  Позволяет не вводить пароль при каждом запуске приложения на этом ПК. Можно отключить в настройках в любой момент.
                </span>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 py-3 px-4 rounded-2xl bg-[var(--color-emerald-600)] hover:bg-[var(--color-emerald-500)] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/20"
            >
              {isSubmitting ? (
                <span>Генерация ключей и шифрование...</span>
              ) : (
                <>
                  <Lock size={18} />
                  <span>Зашифровать хранилище</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Предупреждение по ТЗ: без пароля и без ключа восстановления данные не восстановить */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <AlertTriangle size={16} />
                <span>Критическое предупреждение безопасности</span>
              </div>
              <p className="leading-relaxed">
                Без пароля и без ключа восстановления данные восстановить невозможно.
                Сохраните этот ключ отдельно в надежном месте (например, в менеджере паролей). Этот ключ показывается только один раз!
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-bg-input)] border border-[var(--color-border-input)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[var(--color-content-muted)] uppercase">
                  Аварийный ключ восстановления
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-xl bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-hover)] text-xs text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>
              <div className="font-mono text-base font-semibold tracking-wider text-[var(--color-emerald-400)] select-all break-all">
                {recoveryKey}
              </div>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-glass)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={e => setConfirmedSaved(e.target.checked)}
                className="rounded border-[var(--color-border-input)] text-[var(--color-emerald-600)] focus:ring-0"
              />
              <span className="text-xs font-medium text-[var(--color-content-primary)]">
                Я сохранил(а) ключ восстановления в надежном месте
              </span>
            </label>

            <button
              type="button"
              disabled={!confirmedSaved}
              onClick={handleFinish}
              className="w-full py-3 px-4 rounded-2xl bg-[var(--color-emerald-600)] hover:bg-[var(--color-emerald-500)] disabled:opacity-40 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/20"
            >
              <Check size={18} />
              <span>Завершить настройку</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
