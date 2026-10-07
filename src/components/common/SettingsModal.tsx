import React, { useState, useEffect } from 'react';
import { 
  X, 
  HardDrive, 
  Volume2, 
  ShieldCheck, 
  Download, 
  Upload, 
  Check, 
  Sliders, 
  Sparkles,
  Palette
} from 'lucide-react';
import { AppSettings, Task, ThemePreset } from '../../types';
import { WEEKDAYS_RU } from '../../utils/dateUtils';
import { getTodayDate, getCurrentTimestamp } from '../../utils/date';
import { sound } from '../../utils/sound';
import { validateBackup } from '../../utils/backupValidation';

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
  const [localSettings, setLocalSettings] = useState<AppSettings>({ 
    ...settings,
    blurStrength: settings.blurStrength ?? 16,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    sound.playModalOpen();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sound.playModalClose();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleWeekend = (dayIndex: number) => {
    sound.playTap();
    const current = [...localSettings.customWeekends];
    const exists = current.includes(dayIndex);
    const updated = exists ? current.filter(d => d !== dayIndex) : [...current, dayIndex];
    setLocalSettings({ ...localSettings, customWeekends: updated });
  };

  const handleSelectTheme = (theme: ThemePreset) => {
    sound.playTabSwitch();
    setLocalSettings(prev => ({ ...prev, theme }));
  };

  const handleSave = () => {
    sound.playComplete();
    onSaveSettings(localSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 350);
  };

  const handleExportBackup = () => {
    sound.playTap();
    const backupData = {
      version: '2.0',
      exportedAt: getCurrentTimestamp(),
      settings: localSettings,
      tasks,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Calendare_backup_${getTodayDate()}.json`;
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
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validated = validateBackup(parsed);

        sound.playComplete();
        onImportTasks(validated.tasks);
        if (validated.settings) {
          onSaveSettings(validated.settings);
          setLocalSettings(validated.settings);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Проверьте JSON-формат файла.';
        alert(`Не удалось импортировать резервную копию: ${message}`);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 glass-modal-backdrop flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => {
        sound.playModalClose();
        onClose();
      }}
    >
      <div
        className="glass-panel rounded-3xl w-full max-w-[580px] flex flex-col max-h-[85vh] overflow-hidden shadow-2xl border border-[var(--color-border-glass)] transition-all animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border-glass)] bg-[var(--color-surface)]/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border-glass)] flex items-center justify-center text-[var(--color-accent)] shadow-xs">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-normal text-[var(--color-content-primary)] tracking-tight">
                Настройки приложения
              </h2>
              <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                Оформление, звук, интервалы и резервные копии
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.playModalClose();
              onClose();
            }}
            className="p-2 text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs text-[var(--color-content-secondary)] bg-[var(--color-surface-elevated)]/90 backdrop-blur-md">
          {/* Section 1: Appearance (Внешний вид) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
              <Palette className="w-3.5 h-3.5" />
              <span>Внешний вид (Appearance)</span>
            </div>

            {/* 3 Theme Preset Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Card 1: Midnight & Gold */}
              <button
                type="button"
                onClick={() => handleSelectTheme('midnight-gold')}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-28 ${
                  localSettings.theme === 'midnight-gold' || localSettings.theme === 'dark'
                    ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 bg-[#0B132B] shadow-md'
                    : 'border-[var(--color-border-glass)] bg-[#0B132B]/80 hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="w-4 h-4 rounded-full bg-[#FCA311] shadow-xs" />
                  {(localSettings.theme === 'midnight-gold' || localSettings.theme === 'dark') && (
                    <Sparkles className="w-3.5 h-3.5 text-[#FCA311]" />
                  )}
                </div>
                <div>
                  <div className="font-serif text-sm font-medium text-white">Midnight Gold</div>
                  <div className="text-[10px] text-slate-300 mt-0.5 leading-tight">
                    Уголь и золото
                  </div>
                </div>
              </button>

              {/* Card 2: Emerald Frosted */}
              <button
                type="button"
                onClick={() => handleSelectTheme('emerald-frosted')}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-28 ${
                  localSettings.theme === 'emerald-frosted'
                    ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 bg-[#051F20] shadow-md'
                    : 'border-[var(--color-border-glass)] bg-[#051F20]/80 hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="w-4 h-4 rounded-full bg-[#8EB69B] shadow-xs" />
                  {localSettings.theme === 'emerald-frosted' && (
                    <Sparkles className="w-3.5 h-3.5 text-[#8EB69B]" />
                  )}
                </div>
                <div>
                  <div className="font-serif text-sm font-medium text-[#DAF1DE]">Emerald Frosted</div>
                  <div className="text-[10px] text-[#8EB69B] mt-0.5 leading-tight">
                    Благородный изумруд
                  </div>
                </div>
              </button>

              {/* Card 3: Solar Glass */}
              <button
                type="button"
                onClick={() => handleSelectTheme('solar-glass')}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-28 ${
                  localSettings.theme === 'solar-glass' || localSettings.theme === 'light'
                    ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 bg-[#FAFBF7] shadow-md'
                    : 'border-[var(--color-border-glass)] bg-[#FAFBF7]/80 hover:border-[var(--color-accent)]/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="w-4 h-4 rounded-full bg-[#D48806] shadow-xs" />
                  {(localSettings.theme === 'solar-glass' || localSettings.theme === 'light') && (
                    <Sparkles className="w-3.5 h-3.5 text-[#D48806]" />
                  )}
                </div>
                <div>
                  <div className="font-serif text-sm font-medium text-[#1E1E1E]">Solar Glass</div>
                  <div className="text-[10px] text-[#4A5568] mt-0.5 leading-tight">
                    Атмосферный свет
                  </div>
                </div>
              </button>
            </div>

            {/* Blur Strength Slider */}
            <div className="p-3.5 rounded-2xl bg-[var(--color-canvas)]/60 border border-[var(--color-border-glass)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-[var(--color-content-primary)]">
                  <Sliders className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  Интенсивность размытия стекла (Blur strength)
                </span>
                <span className="font-mono text-[11px] text-[var(--color-accent)] font-semibold tabular-nums">
                  {localSettings.blurStrength ?? 16}px
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="28"
                step="2"
                value={localSettings.blurStrength ?? 16}
                onChange={e => {
                  const val = Number(e.target.value);
                  setLocalSettings({ ...localSettings, blurStrength: val });
                  document.documentElement.style.setProperty('--glass-blur', `${val}px`);
                }}
                className="w-full accent-[var(--color-accent)] cursor-pointer"
              />
            </div>
          </div>

          <div className="h-px bg-[var(--color-border-glass)]" />

          {/* Section 2: Audio & Feedback */}
          <div className="space-y-3">
            <span className="font-medium text-[var(--color-content-primary)]">Звуки и уведомления</span>

            <label className="flex items-center justify-between p-3.5 bg-[var(--color-canvas)]/60 rounded-2xl border border-[var(--color-border-glass)] cursor-pointer hover:border-[var(--color-accent)]/40 transition-colors">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-[var(--color-accent)]" />
                <div>
                  <div className="text-[var(--color-content-primary)] font-medium">
                    Звуковые эффекты интерфейса
                  </div>
                  <div className="text-[11px] text-[var(--color-content-muted)]">
                    Тактильные клики Pixel Haptic и джинглы завершения
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localSettings.soundEnabled}
                onChange={e => {
                  sound.playTap();
                  setLocalSettings({ ...localSettings, soundEnabled: e.target.checked });
                }}
                className="rounded border-[var(--color-border-glass)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-0 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 bg-[var(--color-canvas)]/60 rounded-2xl border border-[var(--color-border-glass)] cursor-pointer hover:border-[var(--color-accent)]/40 transition-colors">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--color-accent)]" />
                <div>
                  <div className="text-[var(--color-content-primary)] font-medium">
                    Авто-перенос невыполненных задач
                  </div>
                  <div className="text-[11px] text-[var(--color-content-muted)]">
                    Повышение приоритета просроченных дел со вчерашнего дня
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoRollover}
                onChange={e => {
                  sound.playTap();
                  setLocalSettings({ ...localSettings, autoRollover: e.target.checked });
                }}
                className="rounded border-[var(--color-border-glass)] bg-[var(--color-surface)] text-[var(--color-accent)] focus:ring-0 w-4 h-4"
              />
            </label>
          </div>

          <div className="h-px bg-[var(--color-border-glass)]" />

          {/* Section 3: Custom Weekends */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--color-content-primary)]">Выходные дни</span>
              <span className="text-[11px] text-[var(--color-content-muted)]">нажмите для переключения</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {WEEKDAYS_RU.map(w => {
                const isSelected = localSettings.customWeekends.includes(w.index);
                return (
                  <button
                    key={w.index}
                    type="button"
                    onClick={() => toggleWeekend(w.index)}
                    className={`py-2 rounded-xl text-center transition-all border text-xs ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold'
                        : 'border-[var(--color-border-glass)] bg-[var(--color-canvas)]/60 text-[var(--color-content-secondary)] hover:border-[var(--color-accent)]/40'
                    }`}
                  >
                    <div>{w.short}</div>
                    <div className="text-[9px] mt-0.5 opacity-70">
                      {isSelected ? 'Вых' : 'Буд'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[var(--color-border-glass)]" />

          {/* Section 4: Pomodoro Intervals */}
          <div className="space-y-2">
            <span className="font-medium text-[var(--color-content-primary)]">Pomodoro-таймер</span>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-[var(--color-canvas)]/60 p-3 rounded-2xl border border-[var(--color-border-glass)] space-y-1">
                <span className="text-[11px] text-[var(--color-content-muted)]">Время работы (минут):</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={localSettings.pomodoroWorkMinutes}
                  onChange={e => setLocalSettings({ ...localSettings, pomodoroWorkMinutes: Number(e.target.value) || 25 })}
                  className="w-full bg-transparent border-0 text-[var(--color-content-primary)] font-mono font-semibold focus:ring-0 text-sm"
                />
              </div>
              <div className="bg-[var(--color-canvas)]/60 p-3 rounded-2xl border border-[var(--color-border-glass)] space-y-1">
                <span className="text-[11px] text-[var(--color-content-muted)]">Время отдыха (минут):</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={localSettings.pomodoroBreakMinutes}
                  onChange={e => setLocalSettings({ ...localSettings, pomodoroBreakMinutes: Number(e.target.value) || 5 })}
                  className="w-full bg-transparent border-0 text-[var(--color-content-primary)] font-mono font-semibold focus:ring-0 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[var(--color-border-glass)]" />

          {/* Section 5: Backup / Restore */}
          <div className="space-y-2">
            <span className="font-medium text-[var(--color-content-primary)]">Резервная копия</span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 px-4 py-2.5 bg-[var(--color-canvas)]/60 hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-glass)] rounded-2xl text-[var(--color-content-primary)] flex items-center justify-center gap-2 transition-colors font-medium text-xs shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>Экспорт JSON</span>
              </button>

              <label className="flex-1 px-4 py-2.5 bg-[var(--color-canvas)]/60 hover:bg-[var(--color-surface-hover)] border border-[var(--color-border-glass)] rounded-2xl text-[var(--color-content-primary)] flex items-center justify-center gap-2 transition-colors font-medium text-xs cursor-pointer shadow-xs">
                <Upload className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>Импорт JSON</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border-glass)] bg-[var(--color-surface)]/60 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              sound.playModalClose();
              onClose();
            }}
            className="px-4 py-2 text-xs text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] rounded-full transition-colors"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-[var(--color-accent)] hover:opacity-95 text-[var(--color-accent-text)] font-medium rounded-full text-xs flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            {saveSuccess && <Check className="w-4 h-4 stroke-[2.5]" />}
            <span>{saveSuccess ? 'Сохранено' : 'Применить'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
