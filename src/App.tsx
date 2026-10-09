/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSettings } from './hooks/useSettings';
import { useTasks } from './hooks/useTasks';
import { useNotifications } from './hooks/useNotifications';
import { useRollover } from './hooks/useRollover';
import { useReminderScheduler } from './hooks/useReminderScheduler';
import { getTodayDate } from './utils/date';
import { TaskRepository } from './repositories/TaskRepository';

import { Sidebar, ActiveNavTab } from './components/layout/Sidebar';
import { CalendarGrid } from './components/calendar/CalendarGrid';
import { DayPreviewModal } from './components/common/DayPreviewModal';
import { DayWorkspaceModal } from './components/day/DayWorkspaceModal';
import { SettingsModal } from './components/common/SettingsModal';
import { RolloverAlertModal } from './components/common/RolloverAlertModal';
import { PomodoroModal } from './components/common/PomodoroModal';
import { ToastContainer } from './components/common/ToastContainer';
import { MigrationBannerModal } from './components/common/MigrationBannerModal';

export default function App() {
  const { settings, updateSettings, toggleTheme } = useSettings();
  const { tasks, addTask, updateTask, deleteTask, setAllTasks } = useTasks();
  const { toasts, pushToast, dismissToast } = useNotifications({
    soundEnabled: settings.soundEnabled,
    notificationsEnabled: settings.notificationsEnabled,
  });

  const {
    runRollover,
    escalatedTasks,
    isRolloverAlertOpen,
    setIsRolloverAlertOpen,
  } = useRollover(
    tasks,
    setAllTasks,
    pushToast,
    settings.soundEnabled,
    settings.autoRollover
  );

  useReminderScheduler(tasks, {
    notificationsEnabled: settings.notificationsEnabled,
  });

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeDateStr, setActiveDateStr] = useState<string>(getTodayDate());

  // Active rail tab: 'calendar' | 'tasks' | 'pomodoro'
  const [activeNavTab, setActiveNavTab] = useState<ActiveNavTab>('calendar');

  // Modals state
  const [isDayPreviewOpen, setIsDayPreviewOpen] = useState(false);
  const [isDayWorkspaceOpen, setIsDayWorkspaceOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPomodoroModalOpen, setIsPomodoroModalOpen] = useState(false);

  // Migration state
  const [migrationCount, setMigrationCount] = useState<number | null>(null);

  // Проверка уведомлений о повреждённых файлах
  useEffect(() => {
    return TaskRepository.onCorruptedData(notices => {
      if (notices.length > 0) {
        pushToast(
          'Внимание: повреждённые файлы',
          `Обнаружены повреждённые файлы задач (${notices.length} шт.). Они сохранены в папку corrupt/ для безопасности.`
        );
      }
    });
  }, [pushToast]);

  // Подписка на ошибки записи/удаления задач на диск
  useEffect(() => {
    return TaskRepository.onStorageError(errorMessage => {
      pushToast('Ошибка записи', errorMessage);
    });
  }, [pushToast]);

  // Проверка необходимости предложения однократной миграции из localStorage
  useEffect(() => {
    if (TaskRepository.hasPendingMigration()) {
      try {
        const raw = localStorage.getItem(TaskRepository.STORAGE_KEY);
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMigrationCount(parsed.length);
        }
      } catch {
        // Игнорируем ошибку чтения при проверке
      }
    }
  }, []);

  const handlePerformMigration = async () => {
    try {
      const res = await TaskRepository.migrateFromLocalStorage();
      setMigrationCount(null);
      pushToast(
        'Импорт завершён',
        `Импортировано: ${res.imported} задач. Пропущено дубликатов: ${res.skipped}.`
      );
      const updated = await TaskRepository.loadAsync();
      if (updated.length > 0) {
        setAllTasks(updated);
      }
    } catch (err: any) {
      pushToast(
        'Ошибка импорта',
        err?.message || 'Не удалось импортировать задачи'
      );
    }
  };

  // Handlers
  const handleSelectDay = (dateStr: string) => {
    setActiveDateStr(dateStr);
    setIsDayPreviewOpen(true);
  };

  const handleOpenFullDay = (dateStr: string) => {
    setActiveDateStr(dateStr);
    setIsDayPreviewOpen(false);
    setIsDayWorkspaceOpen(true);
  };

  const handleOpenNewTask = () => {
    setActiveDateStr(getTodayDate());
    setIsDayPreviewOpen(false);
    setIsDayWorkspaceOpen(true);
    setActiveNavTab('tasks');
  };

  const handleSelectNavTab = (tab: ActiveNavTab) => {
    setActiveNavTab(tab);
    if (tab === 'tasks') {
      setActiveDateStr(getTodayDate());
      setIsDayWorkspaceOpen(true);
    } else if (tab === 'pomodoro') {
      setIsPomodoroModalOpen(true);
    } else {
      setIsDayWorkspaceOpen(false);
      setIsPomodoroModalOpen(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden p-3.5 gap-3.5 text-[var(--color-content-primary)] relative">
      {/* 1. Left Navigation Floating Dock / Island */}
      <Sidebar
        activeTab={activeNavTab}
        onSelectTab={handleSelectNavTab}
        theme={settings.theme}
        onToggleTheme={toggleTheme}
        onOpenNewTask={handleOpenNewTask}
        onRunRollover={() => runRollover(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        tasks={tasks}
        onSelectDay={handleSelectDay}
      />

      {/* 2. Floating Main Panel: Header + Calendar Viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden glass-panel rounded-3xl relative z-10 shadow-2xl border border-[var(--color-border-glass)]">
        <CalendarGrid
          tasks={tasks}
          customWeekends={settings.customWeekends}
          currentDate={currentDate}
          onNavigateDate={setCurrentDate}
          onSelectDay={handleSelectDay}
          onOpenFullDay={handleOpenFullDay}
        />
      </main>

      {/* 3. Contextual Modals */}
      {isDayPreviewOpen && (
        <DayPreviewModal
          dateStr={activeDateStr}
          tasks={tasks}
          onClose={() => setIsDayPreviewOpen(false)}
          onOpenFullDay={handleOpenFullDay}
          onQuickAddTask={handleOpenFullDay}
        />
      )}

      {isDayWorkspaceOpen && (
        <DayWorkspaceModal
          dateStr={activeDateStr}
          tasks={tasks}
          onClose={() => {
            setIsDayWorkspaceOpen(false);
            setActiveNavTab('calendar');
          }}
          onUpdateTask={updateTask}
          onAddTask={addTask}
          onDeleteTask={deleteTask}
          onChangeDate={setActiveDateStr}
        />
      )}

      {isPomodoroModalOpen && (
        <PomodoroModal
          workMinutes={settings.pomodoroWorkMinutes}
          breakMinutes={settings.pomodoroBreakMinutes}
          soundEnabled={settings.soundEnabled}
          onSendNotification={pushToast}
          onClose={() => {
            setIsPomodoroModalOpen(false);
            setActiveNavTab('calendar');
          }}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          tasks={tasks}
          onSaveSettings={updateSettings}
          onImportTasks={setAllTasks}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isRolloverAlertOpen && (
        <RolloverAlertModal
          escalatedTasks={escalatedTasks}
          onClose={() => setIsRolloverAlertOpen(false)}
        />
      )}

      {migrationCount !== null && (
        <MigrationBannerModal
          taskCount={migrationCount}
          onMigrate={handlePerformMigration}
          onDismiss={() => setMigrationCount(null)}
        />
      )}

      {/* 4. Feedback: Toast Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
