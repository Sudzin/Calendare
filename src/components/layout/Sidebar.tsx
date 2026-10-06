import React, { useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Timer, 
  Settings, 
  Plus, 
  RefreshCw, 
  Sun, 
  Moon 
} from 'lucide-react';
import { sound } from '../../utils/sound';

export type ActiveNavTab = 'calendar' | 'tasks' | 'pomodoro';

interface SidebarProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewTask: () => void;
  onRunRollover: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  onOpenNewTask,
  onRunRollover,
  onOpenSettings,
}) => {
  // Shortcut 'N' to create task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        onOpenNewTask();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenNewTask]);

  return (
    <aside className="w-16 bg-[var(--color-surface-glass)] backdrop-blur-md border-r border-[var(--color-border)] flex flex-col items-center justify-between py-4 shrink-0 select-none z-20">
      {/* Top: Logo & New Task */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* App Logo Mark */}
        <div
          className="w-10 h-10 rounded-xl bg-[var(--color-surface-solid)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] font-serif font-semibold text-lg"
          title="Chronos-Task"
        >
          C
        </div>

        {/* Quick Add Button (+) */}
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onOpenNewTask();
          }}
          title="Новая задача (N)"
          className="w-10 h-10 rounded-xl bg-[var(--color-accent)] text-[var(--color-on-accent)] flex items-center justify-center hover:opacity-90 transition-all duration-150 shadow-xs group relative"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="w-8 h-px bg-[var(--color-border)] my-1" />

        {/* Navigation Rail */}
        <nav className="flex flex-col items-center gap-2.5 w-full">
          {/* Calendar Tab */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onSelectTab('calendar');
            }}
            title="Календарь"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 ${
              activeTab === 'calendar'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
          </button>

          {/* Tasks Tab */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onSelectTab('tasks');
            }}
            title="Задачи на сегодня"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 ${
              activeTab === 'tasks'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          {/* Pomodoro Tab */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onSelectTab('pomodoro');
            }}
            title="Фокус-таймер Pomodoro"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 ${
              activeTab === 'pomodoro'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/40'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <Timer className="w-4 h-4" />
          </button>
        </nav>
      </div>

      {/* Bottom: Rollover, Theme, Settings */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* Rollover Action */}
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onRunRollover();
          }}
          title="Перенос просроченных долгов (+1 приоритет)"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-priority-high)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onToggleTheme();
          }}
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => {
            sound.playClick();
            onOpenSettings();
          }}
          title="Настройки"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
