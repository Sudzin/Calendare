/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { isTauri, tauriApi } from './tauriBridge';

export interface NotificationServiceOptions extends NotificationOptions {
  enabled?: boolean;
}

function getNotificationConstructor(): typeof Notification | null {
  if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
    return window.Notification;
  }
  if (typeof globalThis !== 'undefined' && 'Notification' in globalThis && (globalThis as unknown as { Notification?: typeof Notification }).Notification) {
    return (globalThis as unknown as { Notification: typeof Notification }).Notification;
  }
  return null;
}

/**
 * Проверяет доступность Notification API (или Tauri native notification) в текущем окружении.
 */
export function isNotificationSupported(): boolean {
  if (isTauri()) {
    return true;
  }
  return getNotificationConstructor() !== null;
}

/**
 * Возвращает текущий статус разрешения уведомлений.
 */
export function getNotificationPermission(): NotificationPermission {
  if (isTauri()) {
    return 'granted';
  }
  const NotificationClass = getNotificationConstructor();
  if (!NotificationClass) {
    return 'denied';
  }
  return NotificationClass.permission;
}

/**
 * Запрашивает у пользователя разрешение на показ уведомлений.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (isTauri()) {
    return 'granted';
  }
  const NotificationClass = getNotificationConstructor();
  if (!NotificationClass) {
    return 'denied';
  }
  try {
    return await NotificationClass.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Отправляет нативное уведомление в среде Tauri или браузерное через Notification API.
 * В Tauri уведомления показываются нативно даже при свёрнутом или скрытом в трей окне.
 *
 * @param title - заголовок уведомления
 * @param options - параметры уведомления (body, icon и т.д.)
 * @param enabled - флаг пользовательской настройки (если false, отправка полностью блокируется)
 * @returns boolean - true, если уведомление отправлено; false, если заблокировано
 */
export function showNotification(
  title: string,
  options?: NotificationServiceOptions,
  enabled?: boolean
): boolean {
  const isEnabled = enabled !== undefined ? enabled : (options?.enabled ?? true);
  if (!isEnabled) {
    return false;
  }

  // Нативные уведомления Tauri
  if (isTauri()) {
    tauriApi.showNotification(title, options?.body).catch(err => {
      console.warn('Tauri native notification failed:', err);
    });
    return true;
  }

  // Fallback к Browser Notification API
  const NotificationClass = getNotificationConstructor();
  if (!NotificationClass) {
    return false;
  }

  if (NotificationClass.permission !== 'granted') {
    return false;
  }

  try {
    const { enabled: _enabled, ...nativeOptions } = options || {};
    new NotificationClass(title, nativeOptions);
    return true;
  } catch {
    return false;
  }
}

export const notificationService = {
  isSupported: isNotificationSupported,
  getPermission: getNotificationPermission,
  requestPermission,
  showNotification,
};
