import { Task, TaskPriority, TaskStatus, TaskType, AppSettings } from '../types';

export const VALID_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high', 'critical'] as const;
export const VALID_STATUSES: readonly TaskStatus[] = ['todo', 'in_progress', 'done', 'postponed'] as const;
export const VALID_TYPES: readonly TaskType[] = ['timed', 'floating'] as const;

export interface ValidatedBackup {
  version?: string;
  exportedAt?: string;
  settings?: AppSettings;
  tasks: Task[];
}

/**
 * Валидирует отдельный объект задачи из внешних данных.
 * Проверяет наличие всех обязательных полей и их типов без приведения через "as Task".
 * Выбрасывает понятную ошибку при несоответствии.
 */
export function validateTask(raw: unknown, index?: number): Task {
  const prefix = index !== undefined ? `Задача #${index + 1}: ` : 'Задача: ';

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error(`${prefix}данные должны быть объектом`);
  }

  const obj = raw as Record<string, unknown>;

  // id: обязательная непустая строка
  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    throw new Error(`${prefix}отсутствует или некорректно обязательное поле "id" (ожидается непустая строка)`);
  }

  // title: обязательная строка
  if (typeof obj.title !== 'string') {
    throw new Error(`${prefix}отсутствует или некорректно обязательное поле "title" (ожидается строка)`);
  }

  // type: обязательный тип задачи ('timed' | 'floating')
  if (typeof obj.type !== 'string' || !VALID_TYPES.includes(obj.type as TaskType)) {
    throw new Error(`${prefix}некорректное поле "type" (допустимы: timed, floating)`);
  }

  // date: обязательная строка YYYY-MM-DD
  if (typeof obj.date !== 'string') {
    throw new Error(`${prefix}отсутствует или некорректно обязательное поле "date" (ожидается строка)`);
  }

  // priority: обязательный приоритет ('low' | 'medium' | 'high' | 'critical')
  if (typeof obj.priority !== 'string' || !VALID_PRIORITIES.includes(obj.priority as TaskPriority)) {
    throw new Error(`${prefix}некорректное поле "priority" (допустимы: low, medium, high, critical)`);
  }

  // status: обязательный статус ('todo' | 'in_progress' | 'done' | 'postponed')
  if (typeof obj.status !== 'string' || !VALID_STATUSES.includes(obj.status as TaskStatus)) {
    throw new Error(`${prefix}некорректное поле "status" (допустимы: todo, in_progress, done, postponed)`);
  }

  // notes: обязательная строка (markdown)
  if (typeof obj.notes !== 'string') {
    throw new Error(`${prefix}отсутствует или некорректно обязательное поле "notes" (ожидается строка)`);
  }

  // createdAt: обязательная строка ISO-даты
  if (typeof obj.createdAt !== 'string') {
    throw new Error(`${prefix}отсутствует или некорректно обязательное поле "createdAt" (ожидается строка)`);
  }

  // updatedAt: обязательная строка ISO-даты
  if (typeof obj.updatedAt !== 'string') {
    throw new Error(`${prefix}отсутствует или некорректно обязательное поле "updatedAt" (ожидается строка)`);
  }

  // Проверка опциональных полей (если переданы)
  if (obj.startTime !== undefined && typeof obj.startTime !== 'string') {
    throw new Error(`${prefix}некорректный тип опционального поля "startTime" (ожидается строка)`);
  }
  if (obj.endTime !== undefined && typeof obj.endTime !== 'string') {
    throw new Error(`${prefix}некорректный тип опционального поля "endTime" (ожидается строка)`);
  }
  if (obj.reminderTime !== undefined && typeof obj.reminderTime !== 'string') {
    throw new Error(`${prefix}некорректный тип опционального поля "reminderTime" (ожидается строка)`);
  }
  if (obj.isEscalated !== undefined && typeof obj.isEscalated !== 'boolean') {
    throw new Error(`${prefix}некорректный тип опционального поля "isEscalated" (ожидается boolean)`);
  }
  if (obj.escalationReason !== undefined && typeof obj.escalationReason !== 'string') {
    throw new Error(`${prefix}некорректный тип опционального поля "escalationReason" (ожидается строка)`);
  }
  if (obj.rolloverCount !== undefined && typeof obj.rolloverCount !== 'number') {
    throw new Error(`${prefix}некорректный тип опционального поля "rolloverCount" (ожидается число)`);
  }
  if (obj.pomodoroCount !== undefined && typeof obj.pomodoroCount !== 'number') {
    throw new Error(`${prefix}некорректный тип опционального поля "pomodoroCount" (ожидается число)`);
  }

  const validTask: Task = {
    id: obj.id,
    title: obj.title,
    type: obj.type as TaskType,
    date: obj.date,
    priority: obj.priority as TaskPriority,
    status: obj.status as TaskStatus,
    notes: obj.notes,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    ...(typeof obj.startTime === 'string' ? { startTime: obj.startTime } : {}),
    ...(typeof obj.endTime === 'string' ? { endTime: obj.endTime } : {}),
    ...(typeof obj.reminderTime === 'string' ? { reminderTime: obj.reminderTime } : {}),
    ...(typeof obj.isEscalated === 'boolean' ? { isEscalated: obj.isEscalated } : {}),
    ...(typeof obj.escalationReason === 'string' ? { escalationReason: obj.escalationReason } : {}),
    ...(typeof obj.rolloverCount === 'number' ? { rolloverCount: obj.rolloverCount } : {}),
    ...(typeof obj.pomodoroCount === 'number' ? { pomodoroCount: obj.pomodoroCount } : {}),
  };

  return validTask;
}

/**
 * Валидирует структуру всего объекта backup.
 * Проверяет:
 * 1. Данные являются не-null объектом (не массивом).
 * 2. Присутствует массив задач "tasks".
 * 3. Каждая задача в массиве полностью валидна.
 * 
 * При ошибке выбрасывает исключение с подробным описанием.
 */
export function validateBackup(data: unknown): ValidatedBackup {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Некорректный формат резервной копии: данные должны быть объектом');
  }

  const obj = data as Record<string, unknown>;

  if (!('tasks' in obj) || !Array.isArray(obj.tasks)) {
    throw new Error('Некорректный формат резервной копии: отсутствует массив задач "tasks"');
  }

  const validatedTasks: Task[] = [];
  for (let i = 0; i < obj.tasks.length; i++) {
    validatedTasks.push(validateTask(obj.tasks[i], i));
  }

  return {
    ...(typeof obj.version === 'string' ? { version: obj.version } : {}),
    ...(typeof obj.exportedAt === 'string' ? { exportedAt: obj.exportedAt } : {}),
    ...(typeof obj.settings === 'object' && obj.settings !== null ? { settings: obj.settings as AppSettings } : {}),
    tasks: validatedTasks,
  };
}
