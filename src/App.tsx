/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Settings, RefreshCw, 
  Minus, X, HardDrive, Bell, CheckCircle2, Flame, Sparkles
} from 'lucide-react';
import { AppSettings, Task, TaskPriority } from './types';
import { getInitialTasks } from './data/initialTasks';
import { toDateString } from './utils/dateUtils';
import { sound } from './utils/sound';
import { CalendarView } from './components/CalendarView';
import { DayWorkspaceModal } from './components/DayWorkspaceModal';
import { DayPreviewModal } from './components/DayPreviewModal';
import { SettingsModal } from './components/SettingsModal';
import { RolloverAlertModal } from './components/RolloverAlertModal';
import { WindowsTraySimulator, ToastNotification } from './components/WindowsTraySimulator';

const DEFAULT_SETTINGS: AppSettings = {
  dbPath: 'C:\\Users\\User\\OneDrive\\ChronosTask\\tasks.db',
  customWeekends: [0, 6], // Sunday (0) and Saturday (6)
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  soundEnabled: true,
  autoRollover: true,
  notificationsEnabled: true,
  startWithWindows: true,
  theme: 'dark',
};

const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export default function App() {
  // State: Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('chronos_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // State: Tasks
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('chronos_tasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to initial
    }
    return getInitialTasks();
  });

  // Calendar navigation date
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Selected date for modals
  const [activeDateStr, setActiveDateStr] = useState<string>(toDateString(new Date()));

  // Modals state
  const [isDayPreviewOpen, setIsDayPreviewOpen] = useState(false);
  const [isDayWorkspaceOpen, setIsDayWorkspaceOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRolloverAlertOpen, setIsRolloverAlertOpen] = useState(false);
  const [escalatedTasks, setEscalatedTasks] = useState<Array<{ task: Task; oldPriority: string; newPriority: string }>>([]);

  // Windows Tray Simulation
  const [isMinimized, setIsMinimized] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Save tasks and settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chronos_tasks', JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('chronos_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }, [settings]);

  // Push toast notification
  const pushToast = (title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastNotification = {
      id,
      title,
      message,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setToasts(prev => [newToast, ...prev].slice(0, 4));

    if (settings.soundEnabled) {
      sound.playAlert();
    }

    // Native browser notification if available & allowed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: message, icon: '/favicon.ico' });
      } catch {
        // Notification API fallback
      }
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // Rollover logic: move uncompleted tasks from past days with +1 priority step-up
  const runRollover = (showModalIfZero = true) => {
    const todayStr = toDateString(new Date());
    const overdueTasks = tasks.filter(t => t.date < todayStr && t.status !== 'done');

    if (overdueTasks.length === 0) {
      if (showModalIfZero) {
        setEscalatedTasks([]);
        setIsRolloverAlertOpen(true);
      }
      return;
    }

    const escalations: Array<{ task: Task; oldPriority: string; newPriority: string }> = [];

    const updatedTasks = tasks.map(t => {
      if (t.date < todayStr && t.status !== 'done') {
        const oldPriority = t.priority;
        const currentIndex = PRIORITY_ORDER.indexOf(t.priority);
        const nextIndex = Math.min(currentIndex + 1, PRIORITY_ORDER.length - 1);
        const newPriority = PRIORITY_ORDER[nextIndex];

        const updated: Task = {
          ...t,
          date: todayStr,
          priority: newPriority,
          isEscalated: true,
          escalationReason: `Авто-перенос с ${t.date}: не выполнено вовремя (+1 приоритет)`,
          rolloverCount: (t.rolloverCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        };

        escalations.push({
          task: updated,
          oldPriority,
          newPriority,
        });

        return updated;
      }
      return t;
    });

    setTasks(updatedTasks);
    setEscalatedTasks(escalations);
    setIsRolloverAlertOpen(true);

    if (settings.soundEnabled) {
      sound.playAlert();
    }

    pushToast(
      'Перенос долгов выполнен ⚠️',
      `Перенесено ${escalations.length} невыполненных задач со вчерашнего дня с повышением приоритета.`
    );
  };

  // Initial check on load for rollover
  useEffect(() => {
    if (settings.autoRollover) {
      const todayStr = toDateString(new Date());
      const hasOverdue = tasks.some(t => t.date < todayStr && t.status !== 'done');
      if (hasOverdue) {
        // Run auto rollover without forcing modal if user didn't request, or trigger toast
        runRollover(false);
      }
    }
  }, []);

  // Request browser notification permission once
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Handlers for Task management
  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleAddTask = (newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = 'task-' + Date.now();
    const newTask: Task = {
      ...newTaskData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(prev => [newTask, ...prev]);
    pushToast('Задача добавлена', `"${newTask.title}" добавлена на ${newTask.date}`);
  };

  const handleDeleteTask = (taskId: string) => {
    sound.playClick();
    setTasks(prev => prev.filter(t => t.id !== taskId));
    pushToast('Задача удалена', 'Задача успешно удалена из локальной базы данных.');
  };

  // Day interactions
  const handleSelectDay = (dateStr: string) => {
    sound.playClick();
    setActiveDateStr(dateStr);
    setIsDayPreviewOpen(true);
  };

  const handleOpenFullDay = (dateStr: string) => {
    sound.playClick();
    setActiveDateStr(dateStr);
    setIsDayPreviewOpen(false);
    setIsDayWorkspaceOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-900 text-neutral-100 overflow-hidden font-sans select-none pb-10">
      
      {/* ================= TOP NAVIGATION BAR (Windows 11 Fluent Header) ================= */}
      <header className="h-12 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md flex items-center justify-between px-4 z-30 shrink-0">
        
        {/* ZONE 1: Brand Wordmark (Clean single element) */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white whitespace-nowrap">
            Chronos-Task
          </span>
        </div>

        {/* ZONE 2: Primary Actions */}
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {/* Rollover Simulator button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              runRollover(true);
            }}
            title="Проверить и перенести долги с повышением приоритета"
            className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-lg text-xs font-medium text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Перенос долгов (+1 приоритет)</span>
            <span className="sm:hidden">Долги</span>
          </button>
        </nav>

        {/* ZONE 3: Settings & Windows Window Controls (Shifted to the right) */}
        <div className="flex items-center gap-2">
          {/* Settings / SQLite sync button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setIsSettingsOpen(true);
            }}
            title="Настройки базы данных и синхронизации"
            className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-lg text-xs font-medium text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden md:inline">Синхронизация & Настройки</span>
            <span className="md:hidden">Настройки</span>
          </button>

          <div className="h-4 w-px bg-neutral-800 hidden sm:block mx-0.5" />

          {/* Window controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setIsMinimized(true);
                pushToast('Chronos-Task', 'Приложение свернуто в системный трей Windows.');
              }}
              title="Свернуть в трей"
              className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setIsMinimized(true);
                pushToast('Chronos-Task', 'Приложение свернуто в трей и продолжает работать в фоне.');
              }}
              title="Закрыть окно (свернуть в трей)"
              className="p-1.5 hover:bg-rose-600/80 text-neutral-400 hover:text-white rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </header>

      {/* ================= MAIN CALENDAR VIEW ================= */}
      <CalendarView
        tasks={tasks}
        settings={settings}
        currentDate={currentDate}
        onNavigateDate={setCurrentDate}
        onSelectDay={handleSelectDay}
        onOpenFullDay={handleOpenFullDay}
      />

      {/* ================= POPUP 1: Quick Day Preview ================= */}
      {isDayPreviewOpen && (
        <DayPreviewModal
          dateStr={activeDateStr}
          tasks={tasks}
          onClose={() => setIsDayPreviewOpen(false)}
          onOpenFullDay={(d) => {
            setIsDayPreviewOpen(false);
            setIsDayWorkspaceOpen(true);
          }}
          onQuickAddTask={(d) => {
            setIsDayPreviewOpen(false);
            setIsDayWorkspaceOpen(true);
          }}
        />
      )}

      {/* ================= POPUP 2: Full Master-Detail Day Workspace ================= */}
      {isDayWorkspaceOpen && (
        <DayWorkspaceModal
          dateStr={activeDateStr}
          tasks={tasks}
          onClose={() => setIsDayWorkspaceOpen(false)}
          onUpdateTask={handleUpdateTask}
          onAddTask={handleAddTask}
          onDeleteTask={handleDeleteTask}
          onChangeDate={setActiveDateStr}
          onSendNotification={pushToast}
        />
      )}

      {/* ================= MODAL 4: Settings & SQLite Sync ================= */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          tasks={tasks}
          onSaveSettings={setSettings}
          onImportTasks={(imported) => setTasks(imported)}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* ================= MODAL 5: Rollover Alert Escalation ================= */}
      {isRolloverAlertOpen && (
        <RolloverAlertModal
          escalatedTasks={escalatedTasks}
          onClose={() => setIsRolloverAlertOpen(false)}
        />
      )}

      {/* ================= WINDOWS 11 TRAY & TOASTS SIMULATOR ================= */}
      <WindowsTraySimulator
        isMinimized={isMinimized}
        onToggleMinimize={() => setIsMinimized(!isMinimized)}
        dbPath={settings.dbPath}
        toasts={toasts}
        onDismissToast={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
      />

    </div>
  );
}
