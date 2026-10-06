import { useState, useEffect, useCallback, useRef } from 'react';
import { sound } from '../utils/sound';

interface UsePomodoroProps {
  workMinutes?: number;
  breakMinutes?: number;
  soundEnabled?: boolean;
  onSessionComplete?: () => void;
  onSendNotification?: (title: string, message: string) => void;
}

export function usePomodoro({
  workMinutes = 25,
  breakMinutes = 5,
  soundEnabled = true,
  onSessionComplete,
  onSendNotification,
}: UsePomodoroProps = {}) {
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeLeft, setTimeLeft] = useState(workMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);

  const isRunningRef = useRef(false);
  isRunningRef.current = isRunning;

  // Sync timeLeft when durations change and timer is paused
  useEffect(() => {
    if (!isRunningRef.current) {
      setTimeLeft(mode === 'work' ? workMinutes * 60 : breakMinutes * 60);
    }
  }, [workMinutes, breakMinutes, mode]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      if (soundEnabled) {
        sound.playAlert();
      }

      if (mode === 'work') {
        setCompletedSessions(c => c + 1);
        if (onSessionComplete) onSessionComplete();
        if (onSendNotification) {
          onSendNotification('Фокус-сессия завершена', `Пора сделать короткий перерыв (${breakMinutes} мин).`);
        }
        setMode('break');
        setTimeLeft(breakMinutes * 60);
      } else {
        if (onSendNotification) {
          onSendNotification('Перерыв окончен', 'Готовы вернуться к задачам?');
        }
        setMode('work');
        setTimeLeft(workMinutes * 60);
      }
      setIsRunning(false);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, timeLeft, mode, soundEnabled, breakMinutes, workMinutes, onSessionComplete, onSendNotification]);

  const toggle = useCallback(() => {
    if (soundEnabled) sound.playClick();
    setIsRunning(r => !r);
  }, [soundEnabled]);

  const reset = useCallback(() => {
    if (soundEnabled) sound.playClick();
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? workMinutes * 60 : breakMinutes * 60);
  }, [soundEnabled, mode, workMinutes, breakMinutes]);

  const skip = useCallback(() => {
    if (soundEnabled) sound.playClick();
    setIsRunning(false);
    if (mode === 'work') {
      setMode('break');
      setTimeLeft(breakMinutes * 60);
    } else {
      setMode('work');
      setTimeLeft(workMinutes * 60);
    }
  }, [soundEnabled, mode, workMinutes, breakMinutes]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const totalSeconds = (mode === 'work' ? workMinutes : breakMinutes) * 60;
  const progressPercent = Math.min(100, Math.max(0, ((totalSeconds - timeLeft) / totalSeconds) * 100));

  return {
    mode,
    timeLeft,
    formattedTime,
    isRunning,
    progressPercent,
    completedSessions,
    toggle,
    reset,
    skip,
  };
}
