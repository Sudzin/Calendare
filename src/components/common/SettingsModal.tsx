import React, { useState, useEffect } from 'react';
import { X, HardDrive, Volume2, ShieldCheck, Download, Upload, Check, Sun, Moon } from 'lucide-react';
import { AppSettings, Task } from '../../types';
import { WEEKDAYS_RU } from '../../utils/dateUtils';
import { sound } from '../../utils/sound';

interface SettingsModalProps {
  settings: AppSettings;
  tasks: Task[];
  onSaveSettings: (settings: AppSettings) => void;
  onImportTasks: (tasks: Task[]) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  tasks,
  onSaveSettings,
  onImportTasks,
  onClose,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Esc key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleWeekend = (dayIndex: number) => {
    sound.playClick();
    const current = [...localSettings.customWeekends];
    const exists = current.includes(dayIndex);
    const updated = exists ? current.filter(d => d !== dayIndex) : [...current, dayIndex];
    setLocalSettings({ ...localSettings, customWeekends: updated });
  };

  const handleSave = () => {
    sound.playSuccess();
    onSaveSettings(localSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 400);
  };

  const handleExportBackup = () => {
    sound.playClick();
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: localSettings,
      tasks,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ChronosTask_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          sound.playSuccess();
          onImportTasks(parsed.tasks);
          if (parsed.settings) {
            onSaveSettings(parsed.settings);
            setLocalSettings(parsed.settings);
          }
        }
      } catch {
        alert('Не удалось прочитать файл резервной копии. Проверьте JSON-формат.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-glass)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl w-full max-w-[560px] flex flex-col max-h-[85vh] overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-solid)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
              <HardDrive className="w-4 h-4" />
            </div>
            <h2 className="font-serif text-lg font-medium text-[var(--color-text-primary)]">
              Настройки приложения
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body (solid inside for clear reading) */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-solid)]">
          {/* Section 1: Theme */}
          <div className="space-y-2">
            <span className="font-medium text-[var(--color-text-primary)]">Тема оформления</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                  localSettings.theme === 'dark'
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium'
                    : 'border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Тёмная (#051F20)</span>
              </button>
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                className={`p-2.5 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                  localSettings.theme === 'light'
                    ? 'border-[var(--color-accent)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium'
                    : 'border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Светлая (#DAF1DE)</span>
              </button>
            </div>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          {/* Section 2: Custom Weekends */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--color-text-primary)]">Выходные дни</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">нажмите для переключения</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {WEEKDAYS_RU.map(w => {
                const isSelected = localSettings.customWeekends.includes(w.index);
                return (
                  <button
                    key={w.index}
                    type="button"
                    onClick={() => toggleWeekend(w.index)}
                    className={`py-2 rounded-lg text-center transition-all border text-xs ${
                      isSelected
                        ? 'border-[var(--color-priority-critical)]/40 bg-[var(--color-priority-critical)]/10 text-[var(--color-priority-critical)] font-medium'
                        : 'border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <div>{w.short}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">
                      {isSelected ? 'Вых' : 'Буд'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          {/* Section 3: Pomodoro Intervals */}
          <div className="space-y-2">
            <span className="font-medium text-[var(--color-text-primary)]">Pomodoro-таймер</span>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-[var(--color-app-bg)] p-2.5 rounded-lg border border-[var(--color-border)] space-y-1">
                <span className="text-[11px] text-[var(--color-text-muted)]">Время работы (минут):</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={localSettings.pomodoroWorkMinutes}
                  onChange={e => setLocalSettings({ ...localSettings, pomodoroWorkMinutes: Number(e.target.value) || 25 })}
                  className="w-full bg-transparent border-0 text-[var(--color-text-primary)] font-mono font-medium focus:ring-0 text-sm"
                />
              </div>
              <div className="bg-[var(--color-app-bg)] p-2.5 rounded-lg border border-[var(--color-border)] space-y-1">
                <span className="text-[11px] text-[var(--color-text-muted)]">Время отдыха (минут):</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={localSettings.pomodoroBreakMinutes}
                  onChange={e => setLocalSettings({ ...localSettings, pomodoroBreakMinutes: Number(e.target.value) || 5 })}
                  className="w-full bg-transparent border-0 text-[var(--color-text-primary)] font-mono font-medium focus:ring-0 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          {/* Section 4: Behavior toggles */}
          <div className="space-y-2">
            <span className="font-medium text-[var(--color-text-primary)]">Поведение и уведомления</span>

            <label className="flex items-center justify-between p-2.5 bg-[var(--color-app-bg)] rounded-lg border border-[var(--color-border)] cursor-pointer">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-[var(--color-text-primary)]">Звуковые сигналы (таймер, клики)</span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.soundEnabled}
                onChange={e => setLocalSettings({ ...localSettings, soundEnabled: e.target.checked })}
                className="rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-[var(--color-app-bg)] rounded-lg border border-[var(--color-border)] cursor-pointer">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span className="text-[var(--color-text-primary)]">Авто-перенос невыполненных задач</span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoRollover}
                onChange={e => setLocalSettings({ ...localSettings, autoRollover: e.target.checked })}
                className="rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-0"
              />
            </label>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          {/* Section 5: Web vs Tauri Desktop limitations */}
          <div className="space-y-2">
            <span className="font-medium text-[var(--color-text-primary)]">Синхронизация и десктоп</span>
            <div className="p-3 bg-[var(--color-app-bg)] rounded-lg border border-[var(--color-border)] space-y-1.5 opacity-70">
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-primary)]">Путь к файлу базы данных:</span>
                <span className="text-[10px] text-[var(--color-text-muted)] italic">Недоступно в веб-версии</span>
              </div>
              <p className="font-mono text-[11px] text-[var(--color-text-secondary)] truncate">
                {localSettings.dbPath}
              </p>
              <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--color-text-muted)]">
                <span>Автозапуск при старте Windows:</span>
                <span className="italic">Недоступно в веб-версии</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--color-border)]" />

          {/* Section 6: Backup / Restore */}
          <div className="space-y-2">
            <span className="font-medium text-[var(--color-text-primary)]">Резервная копия</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 px-3 py-2 bg-[var(--color-app-bg)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] flex items-center justify-center gap-1.5 transition-colors font-medium text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Экспорт JSON</span>
              </button>

              <label className="flex-1 px-3 py-2 bg-[var(--color-app-bg)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] flex items-center justify-center gap-1.5 transition-colors font-medium text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Импорт JSON</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-colors"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-primary)] font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors"
          >
            {saveSuccess && <Check className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? 'Сохранено' : 'Применить'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
