import { useState, useCallback } from 'react';
import { sound } from '../utils/sound';
import { showNotification, requestPermission } from '../services/notificationService';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

export interface UseNotificationsOptions {
  soundEnabled?: boolean;
  notificationsEnabled?: boolean;
}

export function useNotifications(
  optionsOrSoundEnabled: boolean | UseNotificationsOptions = true,
  notificationsEnabledParam = true
) {
  const soundEnabled = typeof optionsOrSoundEnabled === 'boolean'
    ? optionsOrSoundEnabled
    : (optionsOrSoundEnabled.soundEnabled ?? true);

  const notificationsEnabled = typeof optionsOrSoundEnabled === 'object'
    ? (optionsOrSoundEnabled.notificationsEnabled ?? true)
    : notificationsEnabledParam;

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

    // Отправка через изолированный сервис браузерных уведомлений
    showNotification(title, { body: message }, notificationsEnabled);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, [soundEnabled, notificationsEnabled]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    toasts,
    pushToast,
    dismissToast,
    requestPermission,
  };
}
