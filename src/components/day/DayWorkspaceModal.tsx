import React, { useState, useEffect, useMemo } from 'react';
import { Task } from '../../types';
import { UpdateTaskInput } from '../../repositories/TaskRepository';
import { DayHeader } from './DayHeader';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';
import { TaskDetailView } from './TaskDetailView';
import { PriorityFilterDropdown, PriorityFilterValue, PrioritySortValue } from './PriorityFilterDropdown';
import { sound } from '../../utils/sound';

interface DayWorkspaceModalProps {
  dateStr: string;
  tasks: Task[];
  onClose: () => void;
  onUpdateTask: (task: UpdateTaskInput) => void;
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
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>('all');
  const [prioritySort, setPrioritySort] = useState<PrioritySortValue>('default');

  const filteredDayTasks = useMemo(() => {
    if (priorityFilter === 'all') return dayTasks;
    return dayTasks.filter(t => t.priority === priorityFilter);
  }, [dayTasks, priorityFilter]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    dayTasks.length > 0 ? dayTasks[0].id : null
  );
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');

  // Keyboard navigation: Esc closes modal
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

  // Keep selection valid
  useEffect(() => {
    if (selectedTaskId && !dayTasks.some(t => t.id === selectedTaskId)) {
      setSelectedTaskId(dayTasks.length > 0 ? dayTasks[0].id : null);
    }
  }, [dayTasks, selectedTaskId]);

  const selectedTask = dayTasks.find(t => t.id === selectedTaskId) || null;
  const completedCount = dayTasks.filter(t => t.status === 'done').length;

  const handleSelectTask = (id: string) => {
    sound.playTabSwitch();
    setSelectedTaskId(id);
    setActiveTab('detail');
  };

  const handleToggleTaskDone = (task: Task) => {
    const isNowDone = task.status !== 'done';
    if (isNowDone) sound.playTaskComplete();
    else sound.playTap();

    onUpdateTask({
      ...task,
      status: isNowDone ? 'done' : 'todo',
    });
  };

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    sound.playTaskComplete();
    onAddTask(taskData);
    setIsAddingTask(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 glass-modal-backdrop flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={() => {
        sound.playModalClose();
        onClose();
      }}
    >
      <div
        className="glass-panel rounded-3xl w-full max-w-[640px] h-[85vh] flex flex-col shadow-2xl border border-[var(--color-border-glass)] overflow-hidden transition-all animate-in zoom-in-95 duration-200"
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
          onClose={() => {
            sound.playModalClose();
            onClose();
          }}
        />

        {/* View Switcher Tabs & Priority Filter/Sort Dropdown */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-solid)] px-4 py-2 text-xs gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'list') sound.playTabSwitch();
                setActiveTab('list');
              }}
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
              onClick={() => {
                if (activeTab !== 'detail') sound.playTabSwitch();
                setActiveTab('detail');
              }}
              className={`px-3 py-1 rounded-full transition-colors text-xs font-medium truncate max-w-[200px] sm:max-w-[260px] ${
                activeTab === 'detail'
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {selectedTask ? `Детали: ${selectedTask.title}` : 'Детали задачи'}
            </button>
          </div>

          {/* Task Priority Filter Dropdown */}
          <PriorityFilterDropdown
            filter={priorityFilter}
            sort={prioritySort}
            onFilterChange={setPriorityFilter}
            onSortChange={setPrioritySort}
            tasks={dayTasks}
          />
        </div>

        {/* Body Viewport */}
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
                tasks={filteredDayTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={handleSelectTask}
                onToggleTaskDone={handleToggleTaskDone}
                onOpenAddForm={() => setIsAddingTask(true)}
                prioritySort={prioritySort}
                priorityFilter={priorityFilter}
                onResetPriorityFilter={() => {
                  setPriorityFilter('all');
                  setPrioritySort('default');
                }}
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
