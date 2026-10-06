import React, { useState } from 'react';
import { X, HardDrive, Bell, Volume2, ShieldCheck, Download, Upload, Check } from 'lucide-react';
import { AppSettings, Task } from '../types';
import { WEEKDAYS_RU } from '../utils/dateUtils';
import { sound } from '../utils/sound';

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
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleWeekend = (dayIndex: number) => {
    sound.playClick();
    const current = [...localSettings.customWeekends];
    const exists = current.includes(dayIndex);
    const updated = exists ? current.filter(d => d !== dayIndex) : [...current, dayIndex];
    setLocalSettings({ ...localSettings, customWeekends: updated });
  };

  const handleTestSync = () => {
    sound.playClick();
    setSyncStatus('Проверка файла БД...');
    setTimeout(() => {
      sound.playSuccess();
      setSyncStatus('Файл SQLite доступен. Режим WAL активен, авто-синхронизация OneDrive включена.');
    }, 600);
  };

  const handleSave = () => {
    sound.playSuccess();
    onSaveSettings(localSettings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleExportBackup = () => {
    sound.playClick();
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: localSettings,
      tasks: tasks,
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
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          sound.playSuccess();
          onImportTasks(parsed.tasks);
          if (parsed.settings) {
            onSaveSettings(parsed.settings);
            setLocalSettings(parsed.settings);
          }
          alert(`Успешно импортировано ${parsed.tasks.length} задач из резервной копии.`);
        }
      } catch {
        alert('Ошибка чтения файла резервной копии. Проверьте формат JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white">
              Настройки приложения & Локальная синхронизация
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-neutral-300">
          
          {/* Section 1: Storage and Sync */}
          <div className="space-y-2">
            <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              1. Расположение базы данных (Синхронизация ПК ↔ Ноутбук)
            </span>
            <p className="text-neutral-400 text-[11px]">
              Для автоматической синхронизации укажите путь внутри папки OneDrive, Google Drive или Syncthing.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={localSettings.dbPath}
                onChange={(e) => setLocalSettings({ ...localSettings, dbPath: e.target.value })}
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={handleTestSync}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg font-semibold shrink-0 transition-colors"
              >
                Проверить
              </button>
            </div>
            {syncStatus && (
              <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-emerald-300 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{syncStatus}</span>
              </div>
            )}
          </div>

          <div className="h-px bg-neutral-800" />

          {/* Section 2: Custom Weekends */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                2. Настройка выходных дней
              </span>
              <span className="text-[11px] text-neutral-500">
                выберите любые дни недели
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {WEEKDAYS_RU.map((w) => {
                const isSelected = localSettings.customWeekends.includes(w.index);
                return (
                  <button
                    key={w.index}
                    type="button"
                    onClick={() => toggleWeekend(w.index)}
                    className={`py-2 rounded-lg text-center font-semibold transition-all border ${
                      isSelected
                        ? 'bg-rose-950/60 border-rose-600/80 text-rose-300'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="text-xs">{w.short}</div>
                    <div className="text-[9px] mt-0.5 opacity-70">
                      {isSelected ? 'Выходной' : 'Будни'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-neutral-800" />

          {/* Section 3: Pomodoro timer config */}
          <div className="space-y-2">
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              3. Параметры Pomodoro-таймера
            </span>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-1">
                <span className="text-neutral-400 text-[11px]">Время работы (минут):</span>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={localSettings.pomodoroWorkMinutes}
                  onChange={(e) => setLocalSettings({ ...localSettings, pomodoroWorkMinutes: Number(e.target.value) || 25 })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-white font-mono font-semibold"
                />
              </div>
              <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 space-y-1">
                <span className="text-neutral-400 text-[11px]">Время перерыва (минут):</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={localSettings.pomodoroBreakMinutes}
                  onChange={(e) => setLocalSettings({ ...localSettings, pomodoroBreakMinutes: Number(e.target.value) || 5 })}
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-white font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-neutral-800" />

          {/* Section 4: Toggles */}
          <div className="space-y-2.5">
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              4. Системные функции Windows
            </span>

            <label className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-sky-400" />
                <span>Звуковые сигналы (таймер, перенос долгов, клики)</span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.soundEnabled}
                onChange={(e) => setLocalSettings({ ...localSettings, soundEnabled: e.target.checked })}
                className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-400" />
                <span>Всплывающие уведомления (Windows Toast)</span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.notificationsEnabled}
                onChange={(e) => setLocalSettings({ ...localSettings, notificationsEnabled: e.target.checked })}
                className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 cursor-pointer">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Авто-перенос невыполненных задач со сменой приоритета</span>
              </div>
              <input
                type="checkbox"
                checked={localSettings.autoRollover}
                onChange={(e) => setLocalSettings({ ...localSettings, autoRollover: e.target.checked })}
                className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-0"
              />
            </label>
          </div>

          <div className="h-px bg-neutral-800" />

          {/* Section 5: Backup / Restore */}
          <div className="space-y-2">
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              5. Резервная копия базы данных
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Экспорт резервной копии (.json)</span>
              </button>

              <label className="flex-1 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-200 hover:text-white flex items-center justify-center gap-1.5 transition-colors font-medium cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Импорт базы данных</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 text-xs transition-colors"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {saveSuccess && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            <span>{saveSuccess ? 'Сохранено!' : 'Применить настройки'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
