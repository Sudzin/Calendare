import { useState, useCallback } from 'react';
import { sound } from '../utils/sound';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

export function useNotifications(soundEnabled = true) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    const item: ToastItem = {
      id,
      title,
      message,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setToasts(prev => [item, ...prev].slice(0, 4));

    if (soundEnabled) {
      sound.playAlert();
    }

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: message });
      } catch {
        // Notification API fallback
      }
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, [soundEnabled]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    toasts,
    pushToast,
    dismissToast,
  };
}
