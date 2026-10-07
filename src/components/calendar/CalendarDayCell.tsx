import React from 'react';
import { Task } from '../../types';
import { DayWorkload } from '../../types';
import { PRIORITY_META } from '../../utils/priorityUtils';

interface CalendarDayCellProps {
  dayNumber: number;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  workload: DayWorkload;
  tasks: Task[];
  onSelectDay: (dateStr: string) => void;
  onOpenFullDay: (dateStr: string) => void;
}

export const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  dayNumber,
  dateStr,
  isCurrentMonth,
  isToday,
  isWeekend,
  workload,
  tasks,
  onSelectDay,
  onOpenFullDay,
}) => {
  return (
    <div
      onClick={() => {
        onSelectDay(dateStr);
      }}
      onDoubleClick={() => {
        onOpenFullDay(dateStr);
      }}
      className={`min-h-[92px] sm:min-h-[112px] p-2 flex flex-col justify-between transition-colors cursor-pointer group relative border-r border-b border-[var(--color-border-glass)] select-none bg-[var(--color-surface)]/20 ${
        isCurrentMonth ? '' : 'opacity-40'
      } hover:bg-[var(--color-cell-hover)] ${
        isToday ? 'ring-1 ring-inset ring-[var(--color-accent)] shadow-[inset_0_0_14px_rgba(252,163,17,0.12)]' : ''
      }`}
    >
      {/* Top line: Day number & subtle text count */}
      <div className="flex items-center justify-between">
        <span
          className={`font-serif text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full transition-transform group-hover:scale-105 ${
            isToday
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-semibold shadow-xs'
              : isWeekend
              ? 'text-[var(--color-accent)] font-medium'
              : 'text-[var(--color-content-primary)]'
          }`}
        >
          {dayNumber}
        </span>

        {/* Thin workload status and overflow task count */}
        {workload.total > 0 && (
          <span className="text-[11px] font-mono text-[var(--color-content-muted)] tabular-nums">
            {workload.completed}/{workload.total}
            {tasks.length > 2 ? ` · +${tasks.length - 2}` : ''}
          </span>
        )}
      </div>

      {/* Center: Neat mini-pills with time tag & priority indicator */}
      <div className="flex-1 my-0.5 space-y-1 overflow-hidden">
        {tasks.slice(0, 2).map(task => {
          const meta = PRIORITY_META[task.priority];
          const isDone = task.status === 'done';

          return (
            <div
              key={task.id}
              className={`px-2 py-0.5 rounded-full text-[11px] truncate flex items-center gap-1.5 border border-[var(--color-border-glass)]/70 bg-[var(--color-task-chip)] backdrop-blur-xs transition-opacity ${
                isDone ? 'opacity-40 line-through' : 'text-[var(--color-content-primary)]'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs"
                style={{ backgroundColor: meta.colorVar }}
              />
              {task.type === 'timed' && task.startTime && (
                <span className="font-mono text-[10px] text-[var(--color-content-secondary)] font-medium">
                  {task.startTime}
                </span>
              )}
              <span className="truncate">{task.title}</span>
            </div>
          );
        })}
      </div>

      {/* Bottom: Thin 2px workload indicator line docked at bottom-0 */}
      {workload.total > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-border-glass)]/40 overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              workload.hasCritical
                ? 'bg-[var(--color-priority-critical)]'
                : workload.completed === workload.total
                ? 'bg-[var(--color-accent)]'
                : 'bg-[var(--color-accent)]/80'
            }`}
            style={{ width: `${Math.round((workload.completed / workload.total) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
