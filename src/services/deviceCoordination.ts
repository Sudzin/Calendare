/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEVICE_ID_KEY = 'chronos_device_id';
export const ACTIVE_REMINDER_DEVICE_KEY = 'chronos_active_reminder_device';

/**
 * Получить или сгенерировать устойчивый уникальный идентификатор текущего устройства.
 */
export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return 'device-server';
  }
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = `device-${crypto.randomUUID()}`;
    } else {
      id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Получить ID устройства, назначенного для показа напоминаний (если задано).
 */
export function getActiveReminderDevice(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(ACTIVE_REMINDER_DEVICE_KEY);
}

/**
 * Назначить текущее устройство как единственное для показа напоминаний.
 */
export function claimActiveReminderDevice(): void {
  if (typeof localStorage === 'undefined') return;
  const myId = getDeviceId();
  localStorage.setItem(ACTIVE_REMINDER_DEVICE_KEY, myId);
}

/**
 * Освободить назначение текущего устройства.
 */
export function releaseActiveReminderDevice(): void {
  if (typeof localStorage === 'undefined') return;
  const myId = getDeviceId();
  const current = localStorage.getItem(ACTIVE_REMINDER_DEVICE_KEY);
  if (current === myId) {
    localStorage.removeItem(ACTIVE_REMINDER_DEVICE_KEY);
  }
}

export interface ReminderDeviceCheckParams {
  notificationsEnabled?: boolean;
  remindersThisDeviceOnly?: boolean;
  currentDeviceId?: string;
  activeDeviceId?: string | null;
}

/**
 * Чистая функция проверки: разрешено ли показывать напоминание на текущем устройстве.
 * Решает проблему двух включённых ПК с одной синхронизируемой папкой:
 * - Если опция `remindersThisDeviceOnly` включена, текущее устройство активно и показывает напоминания.
 * - Если на одном из ПК включена эта опция (зафиксирован activeDeviceId), второй ПК (где опция выключена)
 *   подавляет уведомления, чтобы не дублировать звук и баннеры.
 * - Если опция нигде не включена, оба устройства работают в обычном режиме.
 */
export function isReminderAllowedOnDevice(params: ReminderDeviceCheckParams): boolean {
  const {
    notificationsEnabled = true,
    remindersThisDeviceOnly = false,
    currentDeviceId,
    activeDeviceId,
  } = params;

  if (!notificationsEnabled) {
    return false;
  }

  // Если пользователь на этом устройстве явно выбрал "только на этом устройстве"
  if (remindersThisDeviceOnly) {
    return true;
  }

  // Если опция выключена, но другое устройство заявило себя как единственный хост напоминаний
  if (activeDeviceId && currentDeviceId && activeDeviceId !== currentDeviceId) {
    return false;
  }

  return true;
}

/**
 * Проверка для вызова в рантайме приложения с чтением текущих хранилищ.
 */
export function isReminderAllowedOnCurrentDevice(options: {
  notificationsEnabled?: boolean;
  remindersThisDeviceOnly?: boolean;
}): boolean {
  const currentDeviceId = getDeviceId();
  const activeDeviceId = getActiveReminderDevice();

  if (options.remindersThisDeviceOnly) {
    // Автоматически регистрируем клейм при активной настройке
    if (activeDeviceId !== currentDeviceId) {
      claimActiveReminderDevice();
    }
  } else if (activeDeviceId === currentDeviceId) {
    // Пользователь отключил опцию на этом устройстве — освобождаем клейм
    releaseActiveReminderDevice();
  }

  return isReminderAllowedOnDevice({
    notificationsEnabled: options.notificationsEnabled,
    remindersThisDeviceOnly: options.remindersThisDeviceOnly,
    currentDeviceId,
    activeDeviceId: getActiveReminderDevice(),
  });
}
