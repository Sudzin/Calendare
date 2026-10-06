import React from 'react';
import { X, Calendar, Clock, Sparkles, ArrowRight, Plus } from 'lucide-react';
import { Task } from '../types';
import { formatHumanDate } from '../utils/dateUtils';
import { sound } from '../utils/sound';

interface DayPreviewModalProps {
  dateStr: string;
  tasks: Task[];
  onClose: () => void;
  onOpenFullDay: (dateStr: string) => void;
  onQuickAddTask: (dateStr: string) => void;
}

export const DayPreviewModal: React.FC<DayPreviewModalProps> = ({
  dateStr,
  tasks,
  onClose,
  onOpenFullDay,
  onQuickAddTask,
}) => {
  const dayTasks = tasks.filter(t => t.date === dateStr);
  const timedTasks = dayTasks.filter(t => t.type === 'timed');
  const floatingTasks = dayTasks.filter(t => t.type === 'floating');
  const completed = dayTasks.filter(t => t.status === 'done').length;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="bg-neutral-900 border border-neutral-700/80 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {formatHumanDate(dateStr)}
              </h3>
              <p className="text-[11px] text-neutral-400">
                Задач: {dayTasks.length} · Закрыто: {completed}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto">
          {/* Timed section */}
          {timedTasks.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-400" />
                Расписание
              </div>
              <div className="space-y-1">
                {timedTasks.map(t => (
                  <div
                    key={t.id}
                    className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs"
                  >
                    <span className={`font-medium ${t.status === 'done' ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                      {t.title}
                    </span>
                    <span className="font-mono text-[11px] text-sky-400 tabular-nums font-semibold">
                      {t.startTime} - {t.endTime || ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Floating section */}
          {floatingTasks.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Плавающие задачи
              </div>
              <div className="space-y-1">
                {floatingTasks.map(t => (
                  <div
                    key={t.id}
                    className="p-2 rounded bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs"
                  >
                    <span className={`font-medium truncate ${t.status === 'done' ? 'line-through text-neutral-500' : 'text-neutral-200'}`}>
                      {t.title}
                    </span>
                    <span className={`text-[10px] uppercase font-bold ${
                      t.priority === 'critical' ? 'text-rose-400' : t.priority === 'high' ? 'text-amber-400' : 'text-neutral-500'
                    }`}>
                      {t.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dayTasks.length === 0 && (
            <div className="text-center py-6 text-neutral-500 text-xs">
              На этот день ничего не запланировано.
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onQuickAddTask(dateStr);
            }}
            className="px-3 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onOpenFullDay(dateStr);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Открыть полный день (Master-Detail)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
