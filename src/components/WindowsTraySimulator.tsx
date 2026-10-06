import React, { useState } from 'react';
import { Minus, Square, X, Calendar, HardDrive, Bell, CheckCircle2, ChevronUp } from 'lucide-react';
import { sound } from '../utils/sound';

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

interface WindowsTraySimulatorProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
  activeTimerText?: string;
  dbPath: string;
  toasts: ToastNotification[];
  onDismissToast: (id: string) => void;
}

export const WindowsTraySimulator: React.FC<WindowsTraySimulatorProps> = ({
  isMinimized,
  onToggleMinimize,
  activeTimerText = '25:00',
  dbPath,
  toasts,
  onDismissToast,
}) => {
  const [isTrayMenuOpen, setIsTrayMenuOpen] = useState(false);

  return (
    <>
      {/* Windows 11 Toast Notifications Stack (Bottom Right) */}
      <div className="fixed bottom-14 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto bg-neutral-900/95 border border-neutral-700 backdrop-blur-md rounded-xl p-3.5 shadow-2xl flex items-start gap-3 animate-in slide-in-from-right-5 duration-200"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white truncate">{t.title}</span>
                <span className="text-[10px] text-neutral-500 font-mono tabular-nums">{t.timestamp}</span>
              </div>
              <p className="text-neutral-300 mt-0.5 leading-snug">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => onDismissToast(t.id)}
              className="text-neutral-500 hover:text-white p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* When minimized: Floating Windows 11 Taskbar Indicator */}
      {isMinimized && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-md shadow-2xl space-y-4">
            <div className="w-14 h-14 bg-sky-500/20 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto text-sky-400">
              <Calendar className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Chronos-Task работает в системном трее</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Фоновый процесс отслеживает напоминания, таймер Pomodoro и статус базы данных SQLite.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onToggleMinimize();
              }}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow transition-colors inline-flex items-center gap-2"
            >
              <span>Развернуть главное окно</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Windows Taskbar Strip Simulation */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-neutral-950/90 border-t border-neutral-800 backdrop-blur-md z-40 flex items-center justify-between px-3 text-xs select-none">
        
        {/* Left: Windows Start & Widgets placeholder */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Локальный режим: OneDrive активен</span>
          </div>
        </div>

        {/* Center: Open App button */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              if (isMinimized) onToggleMinimize();
            }}
            className={`px-3 py-1 rounded-md flex items-center gap-2 transition-all ${
              !isMinimized
                ? 'bg-neutral-800 border-b-2 border-sky-500 text-white'
                : 'text-neutral-400 hover:bg-neutral-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-medium">Chronos-Task</span>
          </button>
        </div>

        {/* Right: System Tray */}
        <div className="flex items-center gap-2 relative">
          {/* Tray chevron toggle */}
          <button
            type="button"
            onClick={() => setIsTrayMenuOpen(!isTrayMenuOpen)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <ChevronUp className={`w-3.5 h-3.5 transition-transform ${isTrayMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Tray App Icon */}
          <button
            type="button"
            onClick={() => setIsTrayMenuOpen(!isTrayMenuOpen)}
            title="Chronos-Task в трее"
            className="p-1 rounded hover:bg-neutral-800 text-sky-400 relative"
          >
            <Calendar className="w-4 h-4" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-sky-400 rounded-full" />
          </button>

          {/* System Clock */}
          <div className="text-right text-[11px] text-neutral-400 font-mono tabular-nums leading-tight pl-1 border-l border-neutral-800">
            <div>{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-[10px] text-neutral-500">{new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</div>
          </div>

          {/* Tray Context Flyout Menu */}
          {isTrayMenuOpen && (
            <div className="absolute bottom-11 right-0 w-64 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-2.5 space-y-2 text-xs animate-in slide-in-from-bottom-2 duration-150 z-50">
              <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  Chronos-Task (Трей)
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1 rounded">
                  Фон OK
                </span>
              </div>

              <div className="space-y-1 text-neutral-300">
                <div className="flex items-center justify-between text-[11px] p-1.5 rounded bg-neutral-950">
                  <span className="text-neutral-400">Фокус-таймер:</span>
                  <span className="font-mono text-white font-semibold">{activeTimerText}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] p-1.5 rounded bg-neutral-950">
                  <span className="text-neutral-400">Файл БД:</span>
                  <span className="font-mono text-sky-400 truncate max-w-[120px]" title={dbPath}>
                    tasks.db
                  </span>
                </div>
              </div>

              <div className="pt-1 border-t border-neutral-800 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setIsTrayMenuOpen(false);
                    if (isMinimized) onToggleMinimize();
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-800 text-white font-medium transition-colors"
                >
                  Развернуть окно
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setIsTrayMenuOpen(false);
                    if (!isMinimized) onToggleMinimize();
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                >
                  Свернуть в трей
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
};
