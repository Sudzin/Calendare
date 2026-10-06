import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Sparkles, 
  Flame, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { AppSettings, Task } from '../types';
import { 
  MONTH_NAMES_RU, WEEKDAYS_RU, getMonthMatrix, getWeekDays, 
  parseDateString, toDateString 
} from '../utils/dateUtils';
import { sound } from '../utils/sound';

interface CalendarViewProps {
  tasks: Task[];
  settings: AppSettings;
  currentDate: Date;
  onNavigateDate: (newDate: Date) => void;
  onSelectDay: (dateStr: string) => void;
  onOpenFullDay: (dateStr: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  settings,
  currentDate,
  onNavigateDate,
  onSelectDay,
  onOpenFullDay,
}) => {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrev = () => {
    sound.playClick();
    if (viewMode === 'month') {
      onNavigateDate(new Date(year, month - 1, 1));
    } else {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(prevWeek.getDate() - 7);
      onNavigateDate(prevWeek);
    }
  };

  const handleNext = () => {
    sound.playClick();
    if (viewMode === 'month') {
      onNavigateDate(new Date(year, month + 1, 1));
    } else {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      onNavigateDate(nextWeek);
    }
  };

  const handleToday = () => {
    sound.playClick();
    onNavigateDate(new Date());
  };

  const monthCells = getMonthMatrix(year, month);
  const weekDays = getWeekDays(currentDate);

  // Group tasks by date string
  const tasksByDate = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (!acc[t.date]) acc[t.date] = [];
    acc[t.date].push(t);
    return acc;
  }, {});

  const renderWorkloadBadge = (dateTasks: Task[]) => {
    if (dateTasks.length === 0) return null;
    const completed = dateTasks.filter(t => t.status === 'done').length;
    const hasCritical = dateTasks.some(t => t.priority === 'critical');
    const isAllDone = completed === dateTasks.length;

    if (isAllDone) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold" title="Все задачи выполнены">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span className="tabular-nums font-mono">{completed}/{dateTasks.length}</span>
        </span>
      );
    }

    if (hasCritical) {
      return (
        <span className="flex items-center gap-1 text-[10px] text-rose-400 font-bold" title="Есть критические задачи или срочный долг">
          <Flame className="w-3 h-3 fill-rose-500 text-rose-500 animate-pulse" />
          <span className="tabular-nums font-mono">{completed}/{dateTasks.length}</span>
        </span>
      );
    }

    return (
      <span className="text-[10px] text-neutral-400 font-mono tabular-nums">
        {completed}/{dateTasks.length}
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-900 overflow-hidden select-none">
      
      {/* Subheader: Calendar Navigation & View Toggle */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/80">
        
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-700/60">
            <button
              type="button"
              onClick={handlePrev}
              title="Предыдущий период"
              className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-neutral-200 hover:text-white hover:bg-neutral-700 rounded transition-colors"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Следующий период"
              className="p-1.5 hover:bg-neutral-700 rounded text-neutral-300 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-white tracking-tight pl-2">
            {MONTH_NAMES_RU[month]} {year}
          </h2>
        </div>

        {/* View Mode & Helper text */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-[11px] text-neutral-400">
            1 клик: быстрое превью · 2 клика: полный экран дня
          </span>

          <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setViewMode('month');
              }}
              className={`px-3 py-1 rounded transition-colors ${
                viewMode === 'month' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Месяц
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setViewMode('week');
              }}
              className={`px-3 py-1 rounded transition-colors ${
                viewMode === 'week' ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Неделя
            </button>
          </div>
        </div>

      </div>

      {/* Weekday Names Header (Mon - Sun) */}
      <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-950/60 text-xs font-medium text-neutral-400">
        {WEEKDAYS_RU.map((w) => {
          const isWeekend = settings.customWeekends.includes(w.index);
          return (
            <div
              key={w.index}
              className={`py-2 text-center border-r border-neutral-800/40 last:border-r-0 ${
                isWeekend ? 'text-rose-400/90 font-semibold bg-rose-950/10' : ''
              }`}
            >
              <span>{w.short}</span>
              {isWeekend && <span className="hidden sm:inline text-[9px] ml-1 opacity-70">(вых)</span>}
            </div>
          );
        })}
      </div>

      {/* Grid Content */}
      {viewMode === 'month' ? (
        <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-5 gap-px bg-neutral-800 overflow-y-auto">
          {monthCells.map((cell) => {
            const dateTasks = tasksByDate[cell.dateStr] || [];
            const isWeekend = settings.customWeekends.includes(cell.dayOfWeek);

            return (
              <div
                key={cell.dateStr}
                onClick={() => onSelectDay(cell.dateStr)}
                onDoubleClick={() => onOpenFullDay(cell.dateStr)}
                className={`min-h-[90px] md:min-h-[110px] p-1.5 flex flex-col justify-between transition-colors cursor-pointer group relative ${
                  cell.isCurrentMonth ? 'bg-neutral-900' : 'bg-neutral-950/70 opacity-50'
                } hover:bg-neutral-800/60 ${
                  cell.isToday ? 'ring-1 ring-inset ring-sky-500/50 bg-sky-950/10' : ''
                } ${isWeekend ? 'bg-neutral-900/90' : ''}`}
              >
                {/* Cell Header: Day Number and Workload indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center font-mono tabular-nums ${
                        cell.isToday
                          ? 'bg-sky-500 text-white font-bold'
                          : isWeekend
                          ? 'text-rose-400'
                          : 'text-neutral-300'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                  </div>

                  {renderWorkloadBadge(dateTasks)}
                </div>

                {/* Task preview items (Google Calendar chips style) */}
                <div className="flex-1 mt-1 space-y-1 overflow-hidden">
                  {dateTasks.slice(0, 3).map((task) => {
                    const isDone = task.status === 'done';
                    return (
                      <div
                        key={task.id}
                        className={`px-1.5 py-0.5 rounded text-[11px] truncate flex items-center gap-1 border transition-opacity ${
                          task.priority === 'critical'
                            ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                            : task.type === 'timed'
                            ? 'bg-sky-950/60 border-sky-800/60 text-sky-200'
                            : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300'
                        } ${isDone ? 'opacity-40 line-through' : ''}`}
                      >
                        {task.type === 'timed' ? (
                          <span className="font-mono text-[9px] text-sky-400 font-bold shrink-0">
                            {task.startTime}
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        )}
                        <span className="truncate">{task.title}</span>
                      </div>
                    );
                  })}

                  {dateTasks.length > 3 && (
                    <div className="text-[10px] text-neutral-500 font-medium px-1">
                      +{dateTasks.length - 3} ещё...
                    </div>
                  )}
                </div>

                {/* Hover indicator */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-sky-400 font-medium text-right pt-0.5">
                  Открыть ➔
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Week View */
        <div className="flex-1 grid grid-cols-7 gap-px bg-neutral-800 overflow-y-auto">
          {weekDays.map((w) => {
            const dateTasks = tasksByDate[w.dateStr] || [];
            const isWeekend = settings.customWeekends.includes(w.dayOfWeek);

            return (
              <div
                key={w.dateStr}
                onClick={() => onSelectDay(w.dateStr)}
                onDoubleClick={() => onOpenFullDay(w.dateStr)}
                className={`p-3 flex flex-col justify-between transition-colors cursor-pointer group ${
                  w.isToday ? 'bg-sky-950/20 ring-1 ring-inset ring-sky-500' : 'bg-neutral-900'
                } hover:bg-neutral-800/70`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div>
                      <span className={`text-base font-bold font-mono tabular-nums ${w.isToday ? 'text-sky-400' : 'text-white'}`}>
                        {w.dayNumber}
                      </span>
                      <span className="text-[11px] text-neutral-400 ml-1.5">{w.monthName}</span>
                    </div>
                    {renderWorkloadBadge(dateTasks)}
                  </div>

                  {/* Tasks list */}
                  <div className="mt-3 space-y-1.5">
                    {dateTasks.map((t) => (
                      <div
                        key={t.id}
                        className={`p-1.5 rounded border text-xs flex flex-col gap-0.5 ${
                          t.priority === 'critical'
                            ? 'bg-rose-950/60 border-rose-800 text-rose-200'
                            : t.type === 'timed'
                            ? 'bg-sky-950/60 border-sky-800 text-sky-200'
                            : 'bg-neutral-800/80 border-neutral-700 text-neutral-300'
                        } ${t.status === 'done' ? 'line-through opacity-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          {t.type === 'timed' && (
                            <span className="font-mono text-[10px] text-sky-400 font-bold">
                              {t.startTime} - {t.endTime || ''}
                            </span>
                          )}
                          <span className="text-[9px] uppercase font-bold text-neutral-400 ml-auto">
                            {t.priority}
                          </span>
                        </div>
                        <span className="font-medium truncate">{t.title}</span>
                      </div>
                    ))}

                    {dateTasks.length === 0 && (
                      <div className="text-center py-8 text-neutral-500 text-xs italic">
                        Свободный день
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                  Открыть день ➔
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
