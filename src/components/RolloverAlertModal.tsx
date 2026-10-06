import React from 'react';
import { X, Flame, ArrowRight, ShieldAlert, Check } from 'lucide-react';
import { Task } from '../types';
import { sound } from '../utils/sound';

interface RolloverAlertModalProps {
  escalatedTasks: Array<{ task: Task; oldPriority: string; newPriority: string }>;
  onClose: () => void;
}

export const RolloverAlertModal: React.FC<RolloverAlertModalProps> = ({
  escalatedTasks,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-rose-950/40 border-b border-rose-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flame className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Автоматический перенос невыполненных задач
              </h3>
              <p className="text-[11px] text-rose-200/80">
                Смена календарных суток: незакрытые дела перенесены с эскалацией приоритета
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

        {/* List of rolled over tasks */}
        <div className="p-4 space-y-2.5 max-h-[360px] overflow-y-auto">
          {escalatedTasks.length === 0 ? (
            <div className="p-4 text-center text-neutral-400 text-xs">
              <ShieldAlert className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
              Все задачи выполнены! Просроченных долгов нет.
            </div>
          ) : (
            escalatedTasks.map(({ task, oldPriority, newPriority }) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white truncate max-w-[280px]">
                    {task.title}
                  </span>
                  <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded font-bold">
                    +1 уровень
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                  <span className="text-neutral-400 capitalize">{oldPriority}</span>
                  <ArrowRight className="w-3 h-3 text-neutral-500" />
                  <span className="font-bold text-rose-400 capitalize">{newPriority}</span>
                  {newPriority === 'critical' && (
                    <span className="text-[10px] text-rose-300 bg-rose-900/60 px-1 rounded font-medium">
                      [Срочный долг]
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Принято к сведению</span>
          </button>
        </div>
      </div>
    </div>
  );
};
