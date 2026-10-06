import React, { useState, useEffect } from 'react';
import { Task } from '../../types';
import { DayHeader } from './DayHeader';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';
import { TaskDetailView } from './TaskDetailView';
import { sound } from '../../utils/sound';

interface DayWorkspaceModalProps {
  dateStr: string;
  tasks: Task[];
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteTask: (taskId: string) => void;
  onChangeDate: (newDateStr: string) => void;
}

export const DayWorkspaceModal: React.FC<DayWorkspaceModalProps> = ({
  dateStr,
  tasks,
  onClose,
  onUpdateTask,
  onAddTask,
  onDeleteTask,
  onChangeDate,
}) => {
  const dayTasks = tasks.filter(t => t.date === dateStr);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    dayTasks.length > 0 ? dayTasks[0].id : null
  );
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');

  // Keyboard navigation: Esc closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Keep selection valid
  useEffect(() => {
    if (selectedTaskId && !dayTasks.some(t => t.id === selectedTaskId)) {
      setSelectedTaskId(dayTasks.length > 0 ? dayTasks[0].id : null);
    }
  }, [dayTasks, selectedTaskId]);

  const selectedTask = dayTasks.find(t => t.id === selectedTaskId) || null;
  const completedCount = dayTasks.filter(t => t.status === 'done').length;

  const handleSelectTask = (id: string) => {
    sound.playClick();
    setSelectedTaskId(id);
    setActiveTab('detail');
  };

  const handleToggleTaskDone = (task: Task) => {
    const isNowDone = task.status !== 'done';
    if (isNowDone) sound.playSuccess();
    else sound.playClick();

    onUpdateTask({
      ...task,
      status: isNowDone ? 'done' : 'todo',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    sound.playClick();
    onAddTask(taskData);
    setIsAddingTask(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-glass)] backdrop-blur-md border border-[var(--color-border)] rounded-2xl w-full max-w-[640px] h-[85vh] flex flex-col shadow-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <DayHeader
          dateStr={dateStr}
          totalCount={dayTasks.length}
          completedCount={completedCount}
          onChangeDate={newDate => {
            onChangeDate(newDate);
            setSelectedTaskId(null);
          }}
          onClose={onClose}
        />

        {/* View Switcher Tabs (fully rounded chips style) */}
        <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-solid)] px-4 py-2 text-xs gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1 rounded-full transition-colors text-xs font-medium ${
              activeTab === 'list'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Список дел ({dayTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('detail')}
            className={`px-3 py-1 rounded-full transition-colors text-xs font-medium truncate max-w-[320px] ${
              activeTab === 'detail'
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {selectedTask ? `Детали: ${selectedTask.title}` : 'Детали задачи'}
          </button>
        </div>

        {/* Body Viewport (Dense, opaque surface inside so reading is crisp and without blur) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[var(--color-surface-solid)]">
          {isAddingTask && (
            <TaskForm
              dateStr={dateStr}
              onSave={handleCreateTask}
              onCancel={() => setIsAddingTask(false)}
            />
          )}

          <div className="flex-1 overflow-hidden">
            {activeTab === 'list' ? (
              <TaskList
                tasks={dayTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={handleSelectTask}
                onToggleTaskDone={handleToggleTaskDone}
                onOpenAddForm={() => setIsAddingTask(true)}
              />
            ) : (
              <TaskDetailView
                task={selectedTask}
                onUpdateTask={onUpdateTask}
                onDeleteTask={id => {
                  onDeleteTask(id);
                  setActiveTab('list');
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
