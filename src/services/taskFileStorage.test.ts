import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryFileSystemDriver, TaskFileManager } from './taskFileStorage';
import { Task } from '../types';
import { TaskRepository, LocalStorageBackend, TASK_STORAGE_KEY } from '../repositories/TaskRepository';

function createSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-100',
    title: 'Тестовая задача',
    type: 'floating',
    date: '2026-10-09',
    priority: 'medium',
    status: 'todo',
    notes: 'Заметка к задаче',
    pomodoroCount: 0,
    createdAt: '2026-10-09T10:00:00.000Z',
    updatedAt: '2026-10-09T10:00:00.000Z',
    ...overrides,
  };
}

describe('TaskFileManager (Файловый слой хранения задач)', () => {
  let fs: MemoryFileSystemDriver;
  let manager: TaskFileManager;
  const dataDir = '/app/data/CalendareData';

  beforeEach(() => {
    fs = new MemoryFileSystemDriver();
    manager = new TaskFileManager(dataDir, fs);
  });

  describe('1. Базовый CRUD и перезапуск приложения', () => {
    it('создаёт, правит, удаляет задачи и корректно читает их после перезапуска', async () => {
      // 1. Создание задачи
      const task1 = createSampleTask({ id: 'uuid-1', title: 'Первая задача' });
      await manager.writeTask(task1);

      // Проверяем наличие файла в tasks/uuid-1.json
      const taskFileExists = await fs.exists(`${manager.tasksDir}/uuid-1.json`);
      expect(taskFileExists).toBe(true);

      // Чтение
      let readResult = await manager.readAllTasks();
      expect(readResult.tasks).toHaveLength(1);
      expect(readResult.tasks[0].id).toBe('uuid-1');
      expect(readResult.tasks[0].title).toBe('Первая задача');

      // 2. Обновление задачи
      const updatedTask1 = {
        ...task1,
        title: 'Обновлённая первая задача',
        status: 'done' as const,
        updatedAt: '2026-10-09T11:00:00.000Z',
      };
      await manager.writeTask(updatedTask1);

      // Имитация перезапуска: новый экземпляр менеджера над той же файловой системой
      const restartedManager = new TaskFileManager(dataDir, fs);
      readResult = await restartedManager.readAllTasks();
      expect(readResult.tasks).toHaveLength(1);
      expect(readResult.tasks[0].title).toBe('Обновлённая первая задача');
      expect(readResult.tasks[0].status).toBe('done');

      // 3. Добавление второй задачи
      const task2 = createSampleTask({ id: 'uuid-2', title: 'Вторая задача' });
      await manager.writeTask(task2);

      readResult = await restartedManager.readAllTasks();
      expect(readResult.tasks).toHaveLength(2);

      // 4. Удаление задачи (tombstone)
      await manager.deleteTask('uuid-1', '2026-10-09T12:00:00.000Z');

      // После удаления активных задач остается 1
      const afterDelete = await restartedManager.readAllTasks();
      expect(afterDelete.tasks).toHaveLength(1);
      expect(afterDelete.tasks[0].id).toBe('uuid-2');

      // Физический файл uuid-1.json не удален сразу, а содержит deletedAt (tombstone)
      const rawDeletedContent = await fs.readFile(`${manager.tasksDir}/uuid-1.json`);
      const parsedDeleted = JSON.parse(rawDeletedContent);
      expect(parsedDeleted.deletedAt).toBe('2026-10-09T12:00:00.000Z');
      expect(parsedDeleted.id).toBe('uuid-1');
    });
  });

  describe('2. Защита от потери данных и изоляция повреждённых файлов', () => {
    it('не удаляет и не игнорирует молча синтаксически битые JSON-файлы, а переносит их в corrupt/', async () => {
      // Создаем валидную задачу
      const validTask = createSampleTask({ id: 'valid-task', title: 'Валидная' });
      await manager.writeTask(validTask);

      // Подсовываем битый JSON файл в папку tasks/
      await fs.writeFile(`${manager.tasksDir}/corrupt-syntax.json`, '{ broken json: null, ,');

      // Читаем все задачи
      const result = await manager.readAllTasks();

      // Валидная задача не потеряна
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('valid-task');

      // Битый файл обнаружен и зарегистрирован в отчете
      expect(result.corruptedFiles).toHaveLength(1);
      expect(result.corruptedFiles[0].filename).toBe('corrupt-syntax.json');
      expect(result.corruptedFiles[0].reason).toContain('JSON parse error');

      // Битый файл удален из tasks/, но перемещен в corrupt/
      const inTasks = await fs.exists(`${manager.tasksDir}/corrupt-syntax.json`);
      expect(inTasks).toBe(false);

      const inCorrupt = await fs.exists(result.corruptedFiles[0].corruptPath);
      expect(inCorrupt).toBe(true);

      // Исходное поврежденное содержимое полностью сохранено
      const preservedContent = await fs.readFile(result.corruptedFiles[0].corruptPath);
      expect(preservedContent).toBe('{ broken json: null, ,');
    });

    it('переносит в corrupt/ файлы с невалидной структурой Task (отсутствуют обязательные поля)', async () => {
      // Файл с JSON, но без обязательных полей Task (нет title, date, priority, status)
      const invalidTaskJson = JSON.stringify({ id: 'incomplete-task', notes: 'только заметка' });
      await fs.writeFile(`${manager.tasksDir}/incomplete-task.json`, invalidTaskJson);

      const result = await manager.readAllTasks();
      expect(result.tasks).toHaveLength(0);
      expect(result.corruptedFiles).toHaveLength(1);
      expect(result.corruptedFiles[0].filename).toBe('incomplete-task.json');
      expect(result.corruptedFiles[0].reason.toLowerCase()).toContain('missing required fields');

      const corruptPath = result.corruptedFiles[0].corruptPath;
      expect(await fs.exists(corruptPath)).toBe(true);
      expect(await fs.readFile(corruptPath)).toBe(invalidTaskJson);
    });
  });

  describe('3. Атомарная запись и прерывание процесса', () => {
    it('при сбое записи во временный файл целевой файл остаётся абсолютно невредимым', async () => {
      // 1. Создаем существующую валидную задачу
      const existingTask = createSampleTask({ id: 'critical-task', title: 'Оригинальный заголовок' });
      await manager.writeTask(existingTask);

      const originalFileContent = await fs.readFile(`${manager.tasksDir}/critical-task.json`);
      expect(JSON.parse(originalFileContent).title).toBe('Оригинальный заголовок');

      // 2. Имитируем сбой диска/процесса при следующей попытке записи
      fs.failNextWrite = true;

      const updatedTask = {
        ...existingTask,
        title: 'Сломанная попытка записи',
      };

      // Попытка записи должна завершиться ошибкой
      await expect(manager.writeTask(updatedTask)).rejects.toThrow('Simulated write failure');

      // 3. Проверяем целевой файл: он НЕ повреждён и содержит прежний заголовок!
      const contentAfterFailedWrite = await fs.readFile(`${manager.tasksDir}/critical-task.json`);
      expect(JSON.parse(contentAfterFailedWrite).title).toBe('Оригинальный заголовок');
    });

    it('никогда не пишет напрямую в целевой файл, а использует временный файл в той же папке', async () => {
      const task = createSampleTask({ id: 'atomic-test', title: 'Атомарность' });
      const targetPath = `${manager.tasksDir}/atomic-test.json`;

      await manager.writeTask(task);

      // Целевой файл существует
      expect(await fs.exists(targetPath)).toBe(true);

      // Временные файлы (.tmp.) не должны оставаться после успешного rename
      const filesInDir = await fs.readDir(manager.tasksDir);
      const tmpFiles = filesInDir.filter(f => f.includes('.tmp.'));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe('4. Импорт из localStorage и идемпотентность', () => {
    it('импортирует задачи из списка и не дублирует их при повторном запуске (идемпотентность по id)', async () => {
      const localTasks: Task[] = [
        createSampleTask({ id: 'import-1', title: 'Импорт 1', updatedAt: '2026-10-09T10:00:00.000Z' }),
        createSampleTask({ id: 'import-2', title: 'Импорт 2', updatedAt: '2026-10-09T10:00:00.000Z' }),
      ];

      // Первый импорт
      const firstImport = await manager.importTasks(localTasks);
      expect(firstImport.importedCount).toBe(2);
      expect(firstImport.skippedCount).toBe(0);

      let readResult = await manager.readAllTasks();
      expect(readResult.tasks).toHaveLength(2);

      // Повторный импорт тех же задач
      const secondImport = await manager.importTasks(localTasks);
      expect(secondImport.importedCount).toBe(0);
      expect(secondImport.skippedCount).toBe(2);

      // Количество задач в хранилище не изменилось (нет дубликатов)
      readResult = await manager.readAllTasks();
      expect(readResult.tasks).toHaveLength(2);

      // Если одна из задач имеет более свежий updatedAt — она обновляется
      const updatedLocalTasks: Task[] = [
        createSampleTask({ id: 'import-1', title: 'Импорт 1 обновлен', updatedAt: '2026-10-09T12:00:00.000Z' }),
        createSampleTask({ id: 'import-2', title: 'Импорт 2', updatedAt: '2026-10-09T10:00:00.000Z' }),
      ];

      const thirdImport = await manager.importTasks(updatedLocalTasks);
      expect(thirdImport.importedCount).toBe(1);
      expect(thirdImport.skippedCount).toBe(1);

      readResult = await manager.readAllTasks();
      expect(readResult.tasks).toHaveLength(2);
      const updatedItem = readResult.tasks.find(t => t.id === 'import-1');
      expect(updatedItem?.title).toBe('Импорт 1 обновлен');
    });
  });
});

describe('LocalStorageBackend (Предотвращение тихой потери невалидных задач)', () => {
  beforeEach(() => {
    TaskRepository.clearCorruptedNotices();
  });

  it('при наличии невалидных задач среди массива не отбрасывает их молча, а изолирует в corrupt-хранилище', () => {
    const mockStorage: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
        clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
      },
      writable: true,
      configurable: true,
    });

    const validTask = createSampleTask({ id: 'valid-1', title: 'Валидная задача' });
    const invalidTask = { id: 'bad-1', notATask: true }; // невалидная задача

    mockStorage[TASK_STORAGE_KEY] = JSON.stringify([validTask, invalidTask]);

    const backend = new LocalStorageBackend();
    const tasks = backend.getAll();

    // Возвращается только валидная задача
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('valid-1');

    // Проверяем, что невалидная задача сохранена в corrupt-ключ
    const corruptKeys = Object.keys(mockStorage).filter(k => k.startsWith('chronos_tasks_corrupt_'));
    expect(corruptKeys.length).toBeGreaterThan(0);

    const corruptSaved = JSON.parse(mockStorage[corruptKeys[0]]);
    expect(corruptSaved).toHaveLength(1);
    expect(corruptSaved[0].id).toBe('bad-1');

    // Зарегистрировано уведомление
    const notices = TaskRepository.getCorruptedNotices();
    expect(notices.length).toBeGreaterThan(0);
    expect(notices[0].reason).toContain('invalid tasks');
  });
});
