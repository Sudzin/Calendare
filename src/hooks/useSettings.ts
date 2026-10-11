import { useState, useEffect, useRef } from 'react';
import { AppSettings, ThemePreset } from '../types';
import { sound } from '../utils/sound';
import { isTauri, tauriApi } from '../services/tauriBridge';

export const DEFAULT_SETTINGS: AppSettings = {
  dataDir: '',
  dbPath: '',
  customWeekends: [0, 6], // Sunday (0) and Saturday (6)
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  soundEnabled: true,
  autoRollover: true,
  notificationsEnabled: true,
  remindersThisDeviceOnly: false,
  startWithWindows: false,
  theme: 'midnight-gold',
  blurStrength: 16,
};

const STORAGE_KEY = 'chronos_settings';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw);
      // If previous stored theme was 'dark', upgrade to 'midnight-gold', if 'light' upgrade to 'solar-glass'
      let theme: AppSettings['theme'] = parsed.theme || DEFAULT_SETTINGS.theme;
      if (theme === 'dark') theme = 'midnight-gold';
      if (theme === 'light') theme = 'solar-glass';

      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        dataDir: parsed.dataDir || parsed.dbPath || DEFAULT_SETTINGS.dataDir,
        theme,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const isInitialMount = useRef(true);

  // Синхронизация реального автозапуска Windows при запуске в среде Tauri
  useEffect(() => {
    if (isTauri()) {
      tauriApi.getAutostart().then(enabled => {
        setSettings(prev => ({ ...prev, startWithWindows: enabled }));
      }).catch(err => {
        console.warn('Failed to query autostart status:', err);
      });

      tauriApi.getDataDir().then(dir => {
        if (dir) {
          setSettings(prev => ({ ...prev, dataDir: dir }));
        }
      }).catch(err => {
        console.warn('Failed to query dataDir:', err);
      });
    }
  }, []);

  // При изменении настройки startWithWindows в среде Tauri обновляем автозапуск ОС
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (isTauri()) {
      tauriApi.setAutostart(settings.startWithWindows).catch(err => {
        console.error('Failed to update autostart setting in OS:', err);
      });
    }
  }, [settings.startWithWindows]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }, [settings]);

  // Synchronize sound effects state
  useEffect(() => {
    sound.setEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  // Synchronize theme class on documentElement & body
  useEffect(() => {
    const root = document.documentElement;
    const currentTheme = settings.theme;

    root.classList.remove(
      'theme-midnight-gold',
      'theme-emerald-frosted',
      'theme-solar-glass',
      'theme-dark',
      'theme-light'
    );

    if (currentTheme === 'solar-glass' || currentTheme === 'light') {
      root.classList.add('theme-solar-glass', 'theme-light');
    } else if (currentTheme === 'emerald-frosted') {
      root.classList.add('theme-emerald-frosted', 'theme-dark');
    } else {
      // midnight-gold or dark
      root.classList.add('theme-midnight-gold', 'theme-dark');
    }

    const blur = settings.blurStrength ?? 16;
    root.style.setProperty('--glass-blur', `${blur}px`);
  }, [settings.theme, settings.blurStrength]);

  const updateSettings = (partial: Partial<AppSettings> | ((prev: AppSettings) => AppSettings)) => {
    setSettings(prev => {
      if (typeof partial === 'function') {
        return partial(prev);
      }
      return { ...prev, ...partial };
    });
  };

  const toggleTheme = () => {
    updateSettings(prev => {
      let nextTheme: ThemePreset = 'midnight-gold';
      if (prev.theme === 'midnight-gold' || prev.theme === 'dark') {
        nextTheme = 'emerald-frosted';
      } else if (prev.theme === 'emerald-frosted') {
        nextTheme = 'solar-glass';
      } else {
        nextTheme = 'midnight-gold';
      }
      return { ...prev, theme: nextTheme };
    });
  };

  return {
    settings,
    updateSettings,
    toggleTheme,
  };
}
