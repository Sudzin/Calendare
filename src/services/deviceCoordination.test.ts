// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDeviceId,
  getActiveReminderDevice,
  claimActiveReminderDevice,
  releaseActiveReminderDevice,
  isReminderAllowedOnDevice,
  isReminderAllowedOnCurrentDevice,
  DEVICE_ID_KEY,
  ACTIVE_REMINDER_DEVICE_KEY,
} from './deviceCoordination';

describe('Device Coordination for Reminders (src/services/deviceCoordination.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getDeviceId', () => {
    it('создает устойчивый ID устройства и сохраняет в localStorage', () => {
      const id1 = getDeviceId();
      expect(id1).toBeTruthy();
      expect(id1.startsWith('device-')).toBe(true);

      const id2 = getDeviceId();
      expect(id2).toBe(id1);
      expect(localStorage.getItem(DEVICE_ID_KEY)).toBe(id1);
    });
  });

  describe('claimActiveReminderDevice & releaseActiveReminderDevice', () => {
    it('позволяет текущему устройству занять статус активного хоста напоминаний', () => {
      const myId = getDeviceId();
      expect(getActiveReminderDevice()).toBeNull();

      claimActiveReminderDevice();
      expect(getActiveReminderDevice()).toBe(myId);

      releaseActiveReminderDevice();
      expect(getActiveReminderDevice()).toBeNull();
    });

    it('releaseActiveReminderDevice не снимает чужой клейм', () => {
      getDeviceId(); // инициализирует локальный ID
      localStorage.setItem(ACTIVE_REMINDER_DEVICE_KEY, 'other-device-123');

      releaseActiveReminderDevice();
      expect(getActiveReminderDevice()).toBe('other-device-123');
    });
  });

  describe('isReminderAllowedOnDevice (чистая функция)', () => {
    it('возвращает false, если уведомления отключены глобально', () => {
      const allowed = isReminderAllowedOnDevice({
        notificationsEnabled: false,
        remindersThisDeviceOnly: true,
      });
      expect(allowed).toBe(false);
    });

    it('возвращает true, если опция "напоминания только на этом устройстве" включена', () => {
      const allowed = isReminderAllowedOnDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: true,
        currentDeviceId: 'dev-1',
        activeDeviceId: 'dev-1',
      });
      expect(allowed).toBe(true);
    });

    it('возвращает true при отключенной опции, если ни одно устройство не заняло монополию', () => {
      const allowed = isReminderAllowedOnDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: false,
        currentDeviceId: 'dev-1',
        activeDeviceId: null,
      });
      expect(allowed).toBe(true);
    });

    it('подавляет напоминание на ПК-2, если ПК-1 включил "только на этом устройстве"', () => {
      // Компьютер 2: опция выключена, но активный хост напоминаний — dev-1
      const allowed = isReminderAllowedOnDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: false,
        currentDeviceId: 'dev-2',
        activeDeviceId: 'dev-1',
      });
      expect(allowed).toBe(false);
    });

    it('не подавляет напоминание на ПК-1, если активный хост — dev-1', () => {
      const allowed = isReminderAllowedOnDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: false,
        currentDeviceId: 'dev-1',
        activeDeviceId: 'dev-1',
      });
      expect(allowed).toBe(true);
    });
  });

  describe('isReminderAllowedOnCurrentDevice', () => {
    it('при включении remindersThisDeviceOnly автоматически регистрирует клейм и разрешает показ', () => {
      const myId = getDeviceId();
      const res = isReminderAllowedOnCurrentDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: true,
      });

      expect(res).toBe(true);
      expect(getActiveReminderDevice()).toBe(myId);
    });

    it('при выключении remindersThisDeviceOnly освобождает собственный клейм', () => {
      isReminderAllowedOnCurrentDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: true,
      });

      isReminderAllowedOnCurrentDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: false,
      });

      expect(getActiveReminderDevice()).toBeNull();
    });

    it('подавляет уведомления при чужом активном клейме', () => {
      getDeviceId(); // наш ID
      localStorage.setItem(ACTIVE_REMINDER_DEVICE_KEY, 'foreign-pc-999');

      const res = isReminderAllowedOnCurrentDevice({
        notificationsEnabled: true,
        remindersThisDeviceOnly: false,
      });

      expect(res).toBe(false);
    });
  });
});
