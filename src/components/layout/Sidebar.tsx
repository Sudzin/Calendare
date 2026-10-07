import React, { useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Timer, 
  Settings, 
  Plus, 
  RefreshCw, 
  Sparkles,
  Sun,
  Palette
} from 'lucide-react';
import { sound } from '../../utils/sound';
import { Task, ThemePreset } from '../../types';
import { WeeklySummaryWidget } from '../sidebar/WeeklySummaryWidget';

export type ActiveNavTab = 'calendar' | 'tasks' | 'pomodoro';

interface SidebarProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  theme: ThemePreset | 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewTask: () => void;
  onRunRollover: () => void;
  onOpenSettings: () => void;
  tasks: Task[];
  onSelectDay?: (dateStr: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  onOpenNewTask,
  onRunRollover,
  onOpenSettings,
  tasks,
  onSelectDay,
}) => {
  // Shortcut 'N' to create task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
        e.preventDefault();
        sound.playTap();
        onOpenNewTask();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenNewTask]);

  const getThemeLabel = () => {
    if (theme === 'emerald-frosted') return 'Изумрудная (Emerald Frosted)';
    if (theme === 'solar-glass' || theme === 'light') return 'Светлая (Solar Glass)';
    return 'Премиум (Midnight & Gold)';
  };

  const renderThemeIcon = () => {
    if (theme === 'solar-glass' || theme === 'light') {
      return <Sun className="w-4 h-4 text-[var(--color-accent)]" />;
    }
    if (theme === 'emerald-frosted') {
      return <Palette className="w-4 h-4 text-[var(--color-accent)]" />;
    }
    return <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />;
  };

  return (
    <aside className="w-16 glass-panel rounded-3xl flex flex-col items-center justify-between py-4 shrink-0 select-none z-20 shadow-2xl border border-[var(--color-border-glass)]">
      {/* Top: Avatar & Quick Add Action */}
      <div className="flex flex-col items-center gap-3.5 w-full">
        {/* Profile Avatar / Initials in Claude Serif */}
        <div
          className="w-10 h-10 rounded-2xl bg-[var(--color-surface-hover)]/70 border border-[var(--color-border-glass)] flex items-center justify-center text-[var(--color-accent)] font-serif font-medium text-lg shadow-xs ring-1 ring-[var(--color-accent)]/20"
          title="Calendare — Личный планировщик"
        >
          C
        </div>

        {/* Quick Add Button (+) with vibrant accent */}
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            onOpenNewTask();
          }}
          title="Новая задача (клавиша N)"
          className="w-10 h-10 rounded-2xl bg-[var(--color-accent)] text-[var(--color-accent-text)] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all duration-150 shadow-md group relative"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>

        <div className="w-7 h-px bg-[var(--color-border-glass)] my-0.5 opacity-60" />

        {/* Section Navigation Rail */}
        <nav className="flex flex-col items-center gap-2.5 w-full">
          {/* Calendar Tab */}
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onSelectTab('calendar');
            }}
            title="Календарь"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 ${
              activeTab === 'calendar'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/50 shadow-xs'
                : 'text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
          </button>

          {/* Tasks Tab */}
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onSelectTab('tasks');
            }}
            title="Список задач"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 ${
              activeTab === 'tasks'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/50 shadow-xs'
                : 'text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          {/* Pomodoro Tab */}
          <button
            type="button"
            onClick={() => {
              sound.playTap();
              onSelectTab('pomodoro');
            }}
            title="Таймер / Фокус Pomodoro"
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 ${
              activeTab === 'pomodoro'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/50 shadow-xs'
                : 'text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <Timer className="w-4 h-4" />
          </button>
        </nav>
      </div>

      {/* Middle: Weekly Summary D3 Circular Progress Widget */}
      <div className="flex flex-col items-center gap-2.5 w-full my-auto">
        <div className="w-7 h-px bg-[var(--color-border-glass)] opacity-60" />
        <WeeklySummaryWidget tasks={tasks} onSelectDay={onSelectDay} />
        <div className="w-7 h-px bg-[var(--color-border-glass)] opacity-60" />
      </div>

      {/* Bottom Group: Rollover, Theme Switcher, Settings */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* Rollover Action */}
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            onRunRollover();
          }}
          title="Перенос просроченных долгов (+1 приоритет)"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-priority-high)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Theme Preset Switcher */}
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            onToggleTheme();
          }}
          title={`Текущая тема: ${getThemeLabel()}. Нажмите для переключения.`}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors relative group"
        >
          {renderThemeIcon()}
        </button>

        {/* Settings Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            sound.playTap();
            onOpenSettings();
          }}
          title="Настройки приложения"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-content-secondary)] hover:text-[var(--color-content-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
