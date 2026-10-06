import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { Task, TaskPriority, TaskType } from '../../types';

interface TaskFormProps {
  dateStr: string;
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ dateStr, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('floating');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      type,
      date: dateStr,
      startTime: type === 'timed' ? startTime : undefined,
      endTime: type === 'timed' ? endTime : undefined,
      priority,
      status: 'todo',
      notes: type === 'floating' ? '- [ ] Шаг 1\n- [ ] Шаг 2' : `Заметки к: ${title.trim()}`,
      pomodoroCount: 0,
      reminderTime: type === 'timed' ? startTime : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-[var(--color-app-bg)] border-b border-[var(--color-border)] space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[var(--color-text-primary)]">Новая задача</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          Отмена
        </button>
      </div>

      <input
        type="text"
        placeholder="Название дела..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        autoFocus
        className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
      />

      <div className="flex items-center gap-2">
        <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-0.5">
          <button
            type="button"
            onClick={() => setType('floating')}
            className={`px-2 py-0.5 rounded text-[11px] ${type === 'floating' ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]'}`}
          >
            Плавающая
          </button>
          <button
            type="button"
            onClick={() => setType('timed')}
            className={`px-2 py-0.5 rounded text-[11px] ${type === 'timed' ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]'}`}
          >
            По времени
          </button>
        </div>

        <select
          value={priority}
          onChange={e => setPriority(e.target.value as TaskPriority)}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:outline-none"
        >
          <option value="low">Низкий</option>
          <option value="medium">Средний</option>
          <option value="high">Высокий</option>
          <option value="critical">Критический</option>
        </select>
      </div>

      {type === 'timed' && (
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
          <Clock className="w-3.5 h-3.5" />
          <span>С:</span>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] font-mono"
          />
          <span>По:</span>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[var(--color-text-primary)] font-mono"
          />
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          className="px-3 py-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)] rounded-xl font-medium text-xs transition-colors"
        >
          Создать
        </button>
      </div>
    </form>
  );
};
