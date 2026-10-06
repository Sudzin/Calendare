/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSettings } from './hooks/useSettings';
import { useTasks } from './hooks/useTasks';
import { useNotifications } from './hooks/useNotifications';
import { useRollover } from './hooks/useRollover';
import { toDateString } from './utils/dateUtils';
import { sound } from './utils/sound';

import { Sidebar, ActiveNavTab } from './components/layout/Sidebar';
import { CalendarGrid } from './components/calendar/CalendarGrid';
import { DayPreviewModal } from './components/common/DayPreviewModal';
import { DayWorkspaceModal } from './components/day/DayWorkspaceModal';
import { SettingsModal } from './components/common/SettingsModal';
import { RolloverAlertModal } from './components/common/RolloverAlertModal';
import { PomodoroModal } from './components/common/PomodoroModal';
import { ToastContainer } from './components/common/ToastContainer';

export default function App() {
  const { settings, updateSettings, toggleTheme } = useSettings();
  const { tasks, addTask, updateTask, deleteTask, setAllTasks } = useTasks();
  const { toasts, pushToast, dismissToast } = useNotifications(settings.soundEnabled);

  const {
    runRollover,
    escalatedTasks,
    isRolloverAlertOpen,
    setIsRolloverAlertOpen,
  } = useRollover(tasks, setAllTasks, pushToast, settings.soundEnabled);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeDateStr, setActiveDateStr] = useState<string>(toDateString(new Date()));

  // Active rail tab: 'calendar' | 'tasks' | 'pomodoro'
  const [activeNavTab, setActiveNavTab] = useState<ActiveNavTab>('calendar');

  // Modals state
  const [isDayPreviewOpen, setIsDayPreviewOpen] = useState(false);
  const [isDayWorkspaceOpen, setIsDayWorkspaceOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPomodoroModalOpen, setIsPomodoroModalOpen] = useState(false);

  // Auto-rollover on initial app load if enabled
  useEffect(() => {
    if (settings.autoRollover) {
      const todayStr = toDateString(new Date());
      const hasOverdue = tasks.some(t => t.date < todayStr && t.status !== 'done');
      if (hasOverdue) {
        runRollover(false);
      }
    }
  }, []);

  // Handlers
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

  const handleOpenNewTask = () => {
    sound.playClick();
    setActiveDateStr(toDateString(new Date()));
    setIsDayPreviewOpen(false);
    setIsDayWorkspaceOpen(true);
    setActiveNavTab('tasks');
  };

  const handleSelectNavTab = (tab: ActiveNavTab) => {
    setActiveNavTab(tab);
    if (tab === 'tasks') {
      setActiveDateStr(toDateString(new Date()));
      setIsDayWorkspaceOpen(true);
    } else if (tab === 'pomodoro') {
      setIsPomodoroModalOpen(true);
    } else {
      setIsDayWorkspaceOpen(false);
      setIsPomodoroModalOpen(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden p-3 gap-3 text-[var(--color-text-primary)] relative select-none">
      {/* Fixed Ambient Light Glows behind glass panels */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {/* Top-Left Spot (#235347, alpha 0.35) */}
        <div
          className="fixed -top-28 -left-28 w-[55vw] h-[55vw] max-w-[750px] max-h-[750px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(35, 83, 71, 0.35) 0%, rgba(35, 83, 71, 0) 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Bottom-Right Spot (#8EB69B, alpha 0.12) */}
        <div
          className="fixed -bottom-28 -right-28 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(142, 182, 155, 0.12) 0%, rgba(142, 182, 155, 0) 70%)',
            filter: 'blur(70px)',
          }}
        />
        {/* Center-Top Ambient Accent */}
        <div
          className="fixed top-1/4 right-1/4 w-[35vw] h-[35vw] max-w-[500px] max-h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(35, 83, 71, 0.20) 0%, rgba(35, 83, 71, 0) 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      {/* 1. Narrow Left Column (~64px Icon Rail) - Floating glass panel */}
      <Sidebar
        activeTab={activeNavTab}
        onSelectTab={handleSelectNavTab}
        theme={settings.theme}
        onToggleTheme={toggleTheme}
        onOpenNewTask={handleOpenNewTask}
        onRunRollover={() => runRollover(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Floating Main Panel: Header + Calendar Viewport (One panel) */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden glass-panel rounded-2xl relative z-10 shadow-xl">
        <CalendarGrid
          tasks={tasks}
          customWeekends={settings.customWeekends}
          currentDate={currentDate}
          onNavigateDate={setCurrentDate}
          onSelectDay={handleSelectDay}
          onOpenFullDay={handleOpenFullDay}
        />
      </main>

      {/* 3. Contextual Modals (Max 640px, rounded-2xl glass frame, Esc support) */}
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

      {/* 4. Feedback: Toast Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
