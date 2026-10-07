/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
 * Проверяет доступность Browser Notification API в текущем окружении.
 */
export function isNotificationSupported(): boolean {
  return getNotificationConstructor() !== null;
}

/**
 * Возвращает текущий статус разрешения браузерных уведомлений.
 */
export function getNotificationPermission(): NotificationPermission {
  const NotificationClass = getNotificationConstructor();
  if (!NotificationClass) {
    return 'denied';
  }
  return NotificationClass.permission;
}

/**
 * Запрашивает у пользователя разрешение на показ браузерных уведомлений.
 * Безопасно обрабатывает отсутствие API или ошибки браузера.
 */
export async function requestPermission(): Promise<NotificationPermission> {
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
 * Отправляет браузерное уведомление через Notification API.
 *
 * @param title - заголовок уведомления
 * @param options - параметры уведомления (body, icon и т.д.)
 * @param enabled - флаг пользовательской настройки (если false, отправка полностью блокируется)
 * @returns boolean - true, если уведомление успешно создано; false, если заблокировано или произошла ошибка
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
