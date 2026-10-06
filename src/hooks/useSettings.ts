import { useState, useEffect } from 'react';
import { AppSettings } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  dbPath: 'C:\\Users\\User\\OneDrive\\ChronosTask\\tasks.db',
  customWeekends: [0, 6], // Sunday (0) and Saturday (6)
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  soundEnabled: true,
  autoRollover: true,
  notificationsEnabled: true,
  startWithWindows: true,
  theme: 'dark',
};

const STORAGE_KEY = 'chronos_settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw);
      // Safe merge with DEFAULT_SETTINGS
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  // Synchronize theme class on body / documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.remove('theme-dark');
      root.classList.add('theme-light');
    } else {
      root.classList.remove('theme-light');
      root.classList.add('theme-dark');
    }
  }, [settings.theme]);

  const updateSettings = (partial: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    setSettings(prev => {
      if (typeof partial === 'function') {
        return partial(prev);
      }
      return { ...prev, ...partial };
    });
  };

  const toggleTheme = () => {
    updateSettings(prev => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  return {
    settings,
    updateSettings,
    toggleTheme,
  };
}
