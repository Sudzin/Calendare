import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showNotification,
  requestPermission,
  getNotificationPermission,
  isNotificationSupported,
} from './notificationService';

describe('Notification Service (src/services/notificationService.ts)', () => {
  let originalNotification: typeof Notification | undefined;
  let mockNotificationConstructor: ReturnType<typeof vi.fn<(title: string, options?: NotificationOptions) => void>>;

  beforeEach(() => {
    originalNotification = (globalThis as unknown as { Notification?: typeof Notification }).Notification;

    mockNotificationConstructor = vi.fn<(title: string, options?: NotificationOptions) => void>();
    class MockNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = vi.fn().mockResolvedValue('granted');

      constructor(title: string, options?: NotificationOptions) {
        mockNotificationConstructor(title, options);
      }
    }

    Object.defineProperty(globalThis, 'Notification', {
      value: MockNotification,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalNotification !== undefined) {
      Object.defineProperty(globalThis, 'Notification', {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    } else {
      delete (globalThis as unknown as { Notification?: unknown }).Notification;
    }
    vi.restoreAllMocks();
  });

  describe('showNotification', () => {
    it('permission granted: создаёт уведомление и возвращает true', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'granted';

      const result = showNotification('Заголовок', { body: 'Текст уведомления' });

      expect(result).toBe(true);
      expect(mockNotificationConstructor).toHaveBeenCalledTimes(1);
      expect(mockNotificationConstructor).toHaveBeenCalledWith('Заголовок', { body: 'Текст уведомления' });
    });

    it('permission denied: не создаёт уведомление и возвращает false', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'denied';

      const result = showNotification('Заголовок', { body: 'Текст' });

      expect(result).toBe(false);
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });

    it('permission default: не создаёт уведомление до получения разрешения', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'default';

      const result = showNotification('Заголовок', { body: 'Текст' });

      expect(result).toBe(false);
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });

    it('notification disabled: полностью блокирует отправку при enabled = false (через 3-й аргумент)', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'granted';

      const result = showNotification('Заголовок', { body: 'Текст' }, false);

      expect(result).toBe(false);
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });

    it('notification disabled: полностью блокирует отправку при options.enabled = false', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'granted';

      const result = showNotification('Заголовок', { body: 'Текст', enabled: false });

      expect(result).toBe(false);
      expect(mockNotificationConstructor).not.toHaveBeenCalled();
    });

    it('корректный вызов Notification API с передачей параметров и очисткой служебных полей', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'granted';

      const result = showNotification('Задача выполнена', {
        body: 'Пора сделать перерыв',
        tag: 'pomodoro-tag',
        enabled: true,
      });

      expect(result).toBe(true);
      expect(mockNotificationConstructor).toHaveBeenCalledWith('Задача выполнена', {
        body: 'Пора сделать перерыв',
        tag: 'pomodoro-tag',
      });
    });

    it('безопасно возвращает false при возникновении исключения в конструкторе Notification', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'granted';

      // Эмулируем выброс исключения (например, при строгой политике безопасности браузера)
      mockNotificationConstructor.mockImplementationOnce(() => {
        throw new Error('SecurityError: Notification not allowed in this context');
      });

      const result = showNotification('Заголовок', { body: 'Текст' });

      expect(result).toBe(false);
    });

    it('возвращает false, если Notification API не поддерживается (отсутствует в окружении)', () => {
      delete (globalThis as unknown as { Notification?: unknown }).Notification;

      const result = showNotification('Заголовок', { body: 'Текст' });

      expect(result).toBe(false);
    });
  });

  describe('requestPermission', () => {
    it('возвращает granted, если пользователь дал разрешение', async () => {
      (globalThis.Notification.requestPermission as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('granted');

      const permission = await requestPermission();

      expect(permission).toBe('granted');
      expect(globalThis.Notification.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('возвращает denied, если пользователь отклонил запрос', async () => {
      (globalThis.Notification.requestPermission as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('denied');

      const permission = await requestPermission();

      expect(permission).toBe('denied');
    });

    it('безопасно возвращает denied при ошибке или отклонении промиса', async () => {
      (globalThis.Notification.requestPermission as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Permission prompt dismissed')
      );

      const permission = await requestPermission();

      expect(permission).toBe('denied');
    });

    it('возвращает denied, если Notification API отсутствует', async () => {
      delete (globalThis as unknown as { Notification?: unknown }).Notification;

      const permission = await requestPermission();

      expect(permission).toBe('denied');
    });
  });

  describe('getNotificationPermission & isNotificationSupported', () => {
    it('возвращает текущий статус permission', () => {
      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'granted';
      expect(getNotificationPermission()).toBe('granted');

      (globalThis.Notification as unknown as { permission: NotificationPermission }).permission = 'denied';
      expect(getNotificationPermission()).toBe('denied');
    });

    it('isNotificationSupported возвращает true при наличии Notification и false при отсутствии', () => {
      expect(isNotificationSupported()).toBe(true);

      delete (globalThis as unknown as { Notification?: unknown }).Notification;
      expect(isNotificationSupported()).toBe(false);
      expect(getNotificationPermission()).toBe('denied');
    });
  });
});
