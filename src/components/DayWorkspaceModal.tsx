import React, { useState } from 'react';
import { 
  X, Plus, Clock, Check, AlertCircle, ChevronLeft, ChevronRight, 
  Trash2, Flame, Calendar, Sparkles, Filter
} from 'lucide-react';
import { Task, TaskPriority, TaskStatus, TaskType } from '../types';
import { formatHumanDate, parseDateString, toDateString } from '../utils/dateUtils';
import { sound } from '../utils/sound';
import { PomodoroTimer } from './PomodoroTimer';
import { MarkdownWorkspace } from './MarkdownWorkspace';

interface DayWorkspaceModalProps {
  dateStr: string;
  tasks: Task[];
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteTask: (taskId: string) => void;
  onChangeDate: (newDateStr: string) => void;
  onSendNotification: (title: string, body: string) => void;
}

const PRIORITY_LABELS: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  low: { label: 'Низкий', color: 'text-neutral-400', bg: 'bg-neutral-800', border: 'border-neutral-700' },
  medium: { label: 'Средний', color: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-800/40' },
  high: { label: 'Высокий', color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-800/40' },
  critical: { label: 'Критический', color: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-800/40' },
};

const STATUS_LABELS: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: 'К выполнению', color: 'text-neutral-400' },
  in_progress: { label: 'В процессе', color: 'text-sky-400' },
  done: { label: 'Завершено', color: 'text-emerald-400' },
  postponed: { label: 'Отложено', color: 'text-neutral-500' },
};

export const DayWorkspaceModal: React.FC<DayWorkspaceModalProps> = ({
  dateStr,
  tasks,
  onClose,
  onUpdateTask,
  onAddTask,
  onDeleteTask,
  onChangeDate,
  onSendNotification,
}) => {
  const dayTasks = tasks.filter(t => t.date === dateStr);
  
  // Selected task in detail panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    dayTasks.length > 0 ? dayTasks[0].id : null
  );

  // Filter state for left list
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'done'>('all');

  // New task form state
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<TaskType>('floating');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:30');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');

  const selectedTask = dayTasks.find(t => t.id === selectedTaskId) || null;

  // Split tasks into Timed and Floating
  const timedTasks = dayTasks
    .filter(t => t.type === 'timed')
    .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

  const floatingTasks = dayTasks.filter(t => t.type === 'floating');

  // Filtered lists
  const filterTask = (t: Task) => {
    if (filterMode === 'active') return t.status !== 'done';
    if (filterMode === 'done') return t.status === 'done';
    return true;
  };

  const displayedTimed = timedTasks.filter(filterTask);
  const displayedFloating = floatingTasks.filter(filterTask);

  const completedCount = dayTasks.filter(t => t.status === 'done').length;
  const totalCount = dayTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Date stepper
  const handlePrevDay = () => {
    const d = parseDateString(dateStr);
    d.setDate(d.getDate() - 1);
    onChangeDate(toDateString(d));
  };

  const handleNextDay = () => {
    const d = parseDateString(dateStr);
    d.setDate(d.getDate() + 1);
    onChangeDate(toDateString(d));
  };

  const handleToggleTaskDone = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const isNowDone = task.status !== 'done';
    if (isNowDone) {
      sound.playSuccess();
    } else {
      sound.playClick();
    }

    onUpdateTask({
      ...task,
      status: isNowDone ? 'done' : 'todo',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    sound.playClick();
    onAddTask({
      title: newTitle.trim(),
      type: newType,
      date: dateStr,
      startTime: newType === 'timed' ? newStartTime : undefined,
      endTime: newType === 'timed' ? newEndTime : undefined,
      priority: newPriority,
      status: 'todo',
      notes: newType === 'floating' 
        ? `- [ ] Шаг 1\n- [ ] Шаг 2`
        : `Заметки к событию ${newTitle.trim()}...`,
      pomodoroCount: 0,
      reminderTime: newType === 'timed' ? newStartTime : undefined,
    });

    setNewTitle('');
    setIsAddingTask(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header of Modal (Windows Fluent Navigation Bar) */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-900/90 select-none">
          {/* Date navigator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-700/60">
              <button
                type="button"
                onClick={handlePrevDay}
                title="Предыдущий день"
                className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onChangeDate(toDateString(new Date()))}
                className="px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-700 rounded transition-colors"
              >
                Сегодня
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                title="Следующий день"
                className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                {formatHumanDate(dateStr)}
              </h2>
            </div>
          </div>

          {/* Progress & Close */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Прогресс дня:</span>
              <span className="font-mono font-semibold text-white tabular-nums">
                {completedCount}/{totalCount} ({progressPercent}%)
              </span>
              <div className="w-16 bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Закрыть окно (Esc)"
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master-Detail Split Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-neutral-800">
          
          {/* ================= LEFT PANEL: MASTER (Расписание и Задачи) ================= */}
          <div className="w-full md:w-5/12 flex flex-col bg-neutral-900/50 overflow-hidden">
            
            {/* Filter toolbar */}
            <div className="p-3 border-b border-neutral-800/80 flex items-center justify-between text-xs bg-neutral-900/80">
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-neutral-500 mr-1" />
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    filterMode === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Все ({dayTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('active')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    filterMode === 'active' ? 'bg-neutral-800 text-sky-400' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  К выполнению ({dayTasks.filter(t => t.status !== 'done').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('done')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    filterMode === 'done' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Сделано ({completedCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingTask(true)}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Задача</span>
              </button>
            </div>

            {/* Quick Add Form Drawer */}
            {isAddingTask && (
              <form onSubmit={handleCreateTask} className="p-3 bg-neutral-950/80 border-b border-neutral-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">Новая задача на этот день</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="text-neutral-500 hover:text-neutral-300"
                  >
                    Отмена
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Название задачи или дела..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-500"
                />

                <div className="flex items-center gap-3">
                  {/* Type toggle */}
                  <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded p-0.5">
                    <button
                      type="button"
                      onClick={() => setNewType('floating')}
                      className={`px-2 py-1 rounded text-[11px] font-medium ${
                        newType === 'floating' ? 'bg-neutral-700 text-white' : 'text-neutral-400'
                      }`}
                    >
                      Плавающая
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('timed')}
                      className={`px-2 py-1 rounded text-[11px] font-medium ${
                        newType === 'timed' ? 'bg-neutral-700 text-white' : 'text-neutral-400'
                      }`}
                    >
                      По времени
                    </button>
                  </div>

                  {/* Priority selector */}
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[11px] text-neutral-300 focus:outline-none"
                  >
                    <option value="low">Низкий приоритет</option>
                    <option value="medium">Средний приоритет</option>
                    <option value="high">Высокий приоритет</option>
                    <option value="critical">Критический</option>
                  </select>
                </div>

                {newType === 'timed' && (
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>С:</span>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-white"
                    />
                    <span>По:</span>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-white"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded transition-colors text-xs"
                  >
                    Сохранить задачу
                  </button>
                </div>
              </form>
            )}

            {/* Tasks Lists Container */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              
              {/* SECTION 1: Жесткое расписание (Timed Schedule) */}
              <div>
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Жесткое расписание ({displayedTimed.length})
                  </span>
                  <span className="text-[11px] text-neutral-500">по часам</span>
                </div>

                {displayedTimed.length === 0 ? (
                  <div className="text-xs text-neutral-500 italic py-2 pl-2">
                    Нет задач с фиксированным временем.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {displayedTimed.map((task) => {
                      const isSelected = selectedTaskId === task.id;
                      const isDone = task.status === 'done';
                      const p = PRIORITY_LABELS[task.priority];

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-neutral-800/90 border-sky-500/80 shadow-md ring-1 ring-sky-500/30'
                              : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                          } ${isDone ? 'opacity-60' : ''}`}
                        >
                          {/* Checkbox button */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleTaskDone(task, e)}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'border-neutral-600 hover:border-neutral-400 bg-neutral-800'
                            }`}
                          >
                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono text-[11px] text-sky-400 font-semibold tabular-nums">
                                {task.startTime} — {task.endTime || '...'}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${p.bg} ${p.border} ${p.color}`}>
                                {p.label}
                              </span>
                            </div>
                            <h4 className={`text-xs font-medium text-neutral-100 truncate ${isDone ? 'line-through text-neutral-400' : ''}`}>
                              {task.title}
                            </h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: Плавающие задачи (Floating Tasks) */}
              <div>
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800">
                  <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Плавающие дела ({displayedFloating.length})
                  </span>
                  <span className="text-[11px] text-neutral-500">в свободное время</span>
                </div>

                {displayedFloating.length === 0 ? (
                  <div className="text-xs text-neutral-500 italic py-2 pl-2">
                    Нет свободных задач на этот день.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {displayedFloating.map((task) => {
                      const isSelected = selectedTaskId === task.id;
                      const isDone = task.status === 'done';
                      const p = PRIORITY_LABELS[task.priority];

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                            isSelected
                              ? 'bg-neutral-800/90 border-sky-500/80 shadow-md ring-1 ring-sky-500/30'
                              : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                          } ${isDone ? 'opacity-60' : ''}`}
                        >
                          {/* Checkbox button */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleTaskDone(task, e)}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'border-neutral-600 hover:border-neutral-400 bg-neutral-800'
                            }`}
                          >
                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              {task.isEscalated ? (
                                <span className="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-700 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                                  <Flame className="w-2.5 h-2.5 fill-rose-400" />
                                  Срочный долг
                                </span>
                              ) : (
                                <span className="text-[10px] text-neutral-500">Плавающая</span>
                              )}
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${p.bg} ${p.border} ${p.color}`}>
                                {p.label}
                              </span>
                            </div>
                            <h4 className={`text-xs font-medium text-neutral-100 truncate ${isDone ? 'line-through text-neutral-400' : ''}`}>
                              {task.title}
                            </h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ================= RIGHT PANEL: DETAIL (Среда Исполнения) ================= */}
          <div className="w-full md:w-7/12 flex flex-col bg-neutral-900/90 overflow-y-auto p-4 md:p-6">
            {selectedTask ? (
              <div className="space-y-4">
                
                {/* Escalation Alert Banner if applicable */}
                {selectedTask.isEscalated && (
                  <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg flex items-start gap-3 text-rose-200 text-xs">
                    <Flame className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 fill-rose-400" />
                    <div>
                      <span className="font-bold">Авто-перенос с повышением приоритета!</span>
                      <p className="text-rose-300/80 mt-0.5">
                        {selectedTask.escalationReason || 'Задача не была закрыта в предыдущий день и автоматически эскалирована до Критической.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Title & Actions Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={selectedTask.title}
                      onChange={(e) => onUpdateTask({
                        ...selectedTask,
                        title: e.target.value,
                        updatedAt: new Date().toISOString(),
                      })}
                      className="text-lg font-bold text-white bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-sky-500 focus:outline-none w-full py-0.5 transition-colors"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        onDeleteTask(selectedTask.id);
                        setSelectedTaskId(null);
                      }}
                      title="Удалить задачу"
                      className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Timing for Timed tasks */}
                  {selectedTask.type === 'timed' && (
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>Время проведения:</span>
                      <input
                        type="time"
                        value={selectedTask.startTime || '09:00'}
                        onChange={(e) => onUpdateTask({
                          ...selectedTask,
                          startTime: e.target.value,
                          updatedAt: new Date().toISOString(),
                        })}
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-white"
                      />
                      <span>—</span>
                      <input
                        type="time"
                        value={selectedTask.endTime || '10:30'}
                        onChange={(e) => onUpdateTask({
                          ...selectedTask,
                          endTime: e.target.value,
                          updatedAt: new Date().toISOString(),
                        })}
                        className="bg-neutral-800 border border-neutral-700 rounded px-2 py-0.5 text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Status & Priority Segmented Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  
                  {/* Status Picker */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Статус исполнения
                    </span>
                    <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                      {(['todo', 'in_progress', 'done', 'postponed'] as TaskStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            sound.playClick();
                            onUpdateTask({
                              ...selectedTask,
                              status: st,
                              updatedAt: new Date().toISOString(),
                            });
                          }}
                          className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                            selectedTask.status === st
                              ? 'bg-neutral-800 text-white shadow-sm'
                              : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          {STATUS_LABELS[st].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority Picker */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Уровень приоритета
                    </span>
                    <div className="grid grid-cols-4 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                      {(['low', 'medium', 'high', 'critical'] as TaskPriority[]).map((pr) => {
                        const meta = PRIORITY_LABELS[pr];
                        const isCurrent = selectedTask.priority === pr;
                        return (
                          <button
                            key={pr}
                            type="button"
                            onClick={() => {
                              sound.playClick();
                              onUpdateTask({
                                ...selectedTask,
                                priority: pr,
                                updatedAt: new Date().toISOString(),
                              });
                            }}
                            className={`px-1.5 py-1.5 rounded text-[11px] font-semibold transition-colors ${
                              isCurrent
                                ? `${meta.bg} ${meta.color} border ${meta.border} shadow-sm`
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                {/* Pomodoro Focus Timer Widget */}
                <PomodoroTimer
                  taskTitle={selectedTask.title}
                  pomodoroCount={selectedTask.pomodoroCount || 0}
                  onSessionComplete={() => {
                    onUpdateTask({
                      ...selectedTask,
                      pomodoroCount: (selectedTask.pomodoroCount || 0) + 1,
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  onSendNotification={onSendNotification}
                />

                {/* Markdown Notes & Subtasks */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-300">
                      Заметки и подзадачи (Markdown)
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Кликайте по чекбоксам в превью для закрытия пунктов
                    </span>
                  </div>

                  <MarkdownWorkspace
                    content={selectedTask.notes || ''}
                    onChange={(newNotes) => {
                      onUpdateTask({
                        ...selectedTask,
                        notes: newNotes,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                  />
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-3">
                <AlertCircle className="w-10 h-10 text-neutral-600 stroke-[1.5]" />
                <h3 className="text-base font-semibold text-neutral-300">
                  Задача не выбрана
                </h3>
                <p className="text-xs max-w-sm text-neutral-500">
                  Выберите задачу из левого списка или нажмите «+ Задача», чтобы открыть рабочую область с Pomodoro-таймером и Markdown-заметками.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
