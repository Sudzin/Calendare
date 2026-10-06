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
      onClick={() => onSelectDay(dateStr)}
      onDoubleClick={() => onOpenFullDay(dateStr)}
      className={`min-h-[90px] sm:min-h-[110px] p-2 pb-3.5 flex flex-col justify-between transition-colors cursor-pointer group relative border-r border-b border-[var(--color-border)] select-none bg-transparent ${
        isCurrentMonth ? '' : 'opacity-35'
      } hover:bg-[var(--color-cell-hover)] ${
        isToday ? 'ring-1 ring-inset ring-[var(--color-accent)]' : ''
      }`}
    >
      {/* Top line: Day number & subtle text count */}
      <div className="flex items-center justify-between">
        <span
          className={`font-serif text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
            isToday
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] font-semibold'
              : isWeekend
              ? 'text-[var(--color-priority-critical)]'
              : 'text-[var(--color-text-primary)]'
          }`}
        >
          {dayNumber}
        </span>

        {/* Thin workload status */}
        {workload.total > 0 && (
          <span className="text-[11px] font-mono text-[var(--color-text-muted)] tabular-nums">
            {workload.completed}/{workload.total}
          </span>
        )}
      </div>

      {/* Center: Quiet task chips (fully rounded: rounded-full) */}
      <div className="flex-1 my-1 space-y-1 overflow-hidden pb-1">
        {tasks.slice(0, 2).map(task => {
          const meta = PRIORITY_META[task.priority];
          const isDone = task.status === 'done';

          return (
            <div
              key={task.id}
              className={`px-2 py-0.5 rounded-full text-[11px] truncate flex items-center gap-1.5 border border-[var(--color-border)] bg-[var(--color-task-chip)] ${
                isDone ? 'opacity-40 line-through' : 'text-[var(--color-text-primary)]'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: meta.colorVar }}
              />
              {task.type === 'timed' && task.startTime && (
                <span className="font-mono text-[10px] text-[var(--color-text-secondary)] font-medium">
                  {task.startTime}
                </span>
              )}
              <span className="truncate">{task.title}</span>
            </div>
          );
        })}

        {tasks.length > 2 && (
          <div className="text-[10px] text-[var(--color-text-muted)] px-1.5 font-mono">
            +{tasks.length - 2} ещё
          </div>
        )}
      </div>

      {/* Bottom: Thin 2px workload indicator line docked at bottom-0 */}
      {workload.total > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-border)]/40 overflow-hidden">
          <div
            className={`h-full transition-all duration-200 ${
              workload.hasCritical
                ? 'bg-[var(--color-priority-critical)]'
                : workload.completed === workload.total
                ? 'bg-[var(--color-priority-medium)]'
                : 'bg-[var(--color-accent)]'
            }`}
            style={{ width: `${Math.round((workload.completed / workload.total) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
