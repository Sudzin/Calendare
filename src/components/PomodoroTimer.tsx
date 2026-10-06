import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, FastForward, Bell, BellOff, CheckCircle2 } from 'lucide-react';
import { sound } from '../utils/sound';

interface PomodoroTimerProps {
  workMinutes?: number;
  breakMinutes?: number;
  taskTitle: string;
  pomodoroCount?: number;
  onSessionComplete?: () => void;
  onSendNotification?: (title: string, body: string) => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  workMinutes = 25,
  breakMinutes = 5,
  taskTitle,
  pomodoroCount = 0,
  onSessionComplete,
  onSendNotification,
}) => {
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(workMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Sync when workMinutes changes
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(mode === 'work' ? workMinutes * 60 : breakMinutes * 60);
    }
  }, [workMinutes, breakMinutes, mode, isRunning]);

  // Main countdown tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      // Completed session
      if (soundEnabled) {
        sound.playAlert();
      }

      if (mode === 'work') {
        if (onSendNotification) {
          onSendNotification('Фокус-сессия завершена! 🍅', `Отличная работа над задачей: "${taskTitle}". Пора отдохнуть ${breakMinutes} минут.`);
        }
        if (onSessionComplete) {
          onSessionComplete();
        }
        setMode('break');
        setTimeLeft(breakMinutes * 60);
      } else {
        if (onSendNotification) {
          onSendNotification('Перерыв окончен! ⚡', `Готовы продолжить работу над: "${taskTitle}"?`);
        }
        setMode('work');
        setTimeLeft(workMinutes * 60);
      }
      setIsRunning(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, soundEnabled, breakMinutes, workMinutes, taskTitle, onSessionComplete, onSendNotification]);

  const toggleRunning = () => {
    sound.playClick();
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    sound.playClick();
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? workMinutes * 60 : breakMinutes * 60);
  };

  const handleSkip = () => {
    sound.playClick();
    setIsRunning(false);
    if (mode === 'work') {
      setMode('break');
      setTimeLeft(breakMinutes * 60);
    } else {
      setMode('work');
      setTimeLeft(workMinutes * 60);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalCurrentSeconds = (mode === 'work' ? workMinutes : breakMinutes) * 60;
  const progressPercent = Math.min(100, Math.max(0, ((totalCurrentSeconds - timeLeft) / totalCurrentSeconds) * 100));

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-3.5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-200">
            {mode === 'work' ? 'Фокус-таймер (Pomodoro)' : 'Перерыв на отдых'}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            mode === 'work' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {mode === 'work' ? 'Работа' : 'Отдых'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="flex items-center gap-1 text-[11px] text-neutral-300">
            <CheckCircle2 className="w-3 h-3 text-sky-400" />
            <span className="font-mono tabular-nums">{pomodoroCount}</span>
            <span className="text-neutral-500">сессий</span>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Звук включен' : 'Без звука'}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
          >
            {soundEnabled ? <Bell className="w-3.5 h-3.5 text-neutral-300" /> : <BellOff className="w-3.5 h-3.5 text-neutral-600" />}
          </button>
        </div>
      </div>

      {/* Progress Bar & Big Digits */}
      <div className="flex items-center justify-between bg-neutral-950/60 p-2.5 rounded-md border border-neutral-800/80">
        <div className="flex flex-col">
          <span className="font-mono text-2xl font-bold tracking-tight text-white tabular-nums">
            {formattedTime}
          </span>
          <span className="text-[10px] text-neutral-400 truncate max-w-[200px]">
            {mode === 'work' ? 'Концентрация на задаче' : 'Восстановление энергии'}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleRunning}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm ${
              isRunning
                ? 'bg-amber-600/90 hover:bg-amber-500 text-white'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Пауза</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Старт</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            title="Сбросить таймер"
            className="p-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSkip}
            title={mode === 'work' ? 'Перейти к перерыву' : 'Перейти к работе'}
            className="p-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress track */}
      <div className="w-full bg-neutral-800 h-1 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            mode === 'work' ? 'bg-sky-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
