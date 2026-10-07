import { Task } from '../types';
import { getTodayDate, getDateDaysAgo } from '../utils/date';

export function getInitialTasks(): Task[] {
  const todayStr = getTodayDate();
  const yesterdayStr = getDateDaysAgo(todayStr, 1);
  const tomorrowStr = getDateDaysAgo(todayStr, -1);

  return [
    // Today's Timed Schedule
    {
      id: 'task-1',
      title: 'Пары: Прикладной системный анализ',
      type: 'timed',
      date: todayStr,
      startTime: '09:00',
      endTime: '10:30',
      priority: 'high',
      status: 'in_progress',
      notes: `# 📚 Лекция: Моделирование бизнес-процессов

### План занятия
- [x] Диаграммы потоков данных (DFD)
- [x] Ролевые матрицы (RACI)
- [ ] Практическое моделирование в Draw.io

> **Заметка:** Преподаватель просил сдать курсовой проект до 25 числа.`,
      reminderTime: '08:45',
      pomodoroCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      title: 'Пары: Архитектура вычислительных систем',
      type: 'timed',
      date: todayStr,
      startTime: '10:45',
      endTime: '12:15',
      priority: 'medium',
      status: 'todo',
      notes: `# Лабораторная работа №3
Исследование многопоточности и кэш-памяти CPU.

- [ ] Запустить бенчмарк
- [ ] Собрать логи
- [ ] Оформить выводы`,
      reminderTime: '10:35',
      pomodoroCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-3',
      title: 'Созвон по проекту расписания',
      type: 'timed',
      date: todayStr,
      startTime: '16:00',
      endTime: '17:00',
      priority: 'medium',
      status: 'todo',
      notes: `Обсуждение интеграции SQLite с локальной синхронизацией через OneDrive.`,
      reminderTime: '15:50',
      pomodoroCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },

    // Today's Floating Tasks
    {
      id: 'task-4',
      title: 'Сделать блины в свободное время',
      type: 'floating',
      date: todayStr,
      priority: 'low',
      status: 'todo',
      notes: `# 🥞 Классический рецепт блинов

### Ингредиенты
- [ ] Молоко — 500 мл
- [ ] Яйца — 3 шт
- [ ] Мука — 200 г
- [ ] Сахар — 2 ст. л.
- [ ] Соль — 0.5 ч. л.
- [ ] Растительное масло — 3 ст. л.

### Порядок действий
1. Взбить яйца с сахаром и солью.
2. Влить часть молока, всыпать муку, перемешать без комочков.
3. Добавить остаток молока и масло. Дать постоять 15 минут.
4. Выпекать на раскаленной сковороде с двух сторон!`,
      pomodoroCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-5',
      title: 'Сверить синхронизацию tasks.db между ПК и ноутбуком',
      type: 'floating',
      date: todayStr,
      priority: 'high',
      status: 'todo',
      notes: `Проверить, чтобы файл БД в OneDrive не получал конфликтных копий (\`tasks-conflicted.db\`). Режим WAL в SQLite решает большинство блокировок.`,
      pomodoroCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },

    // Escalated Rollover Task (from Yesterday)
    {
      id: 'task-6',
      title: 'Доработать техническое задание (ТЗ v1.0)',
      type: 'floating',
      date: todayStr,
      priority: 'critical',
      status: 'todo',
      notes: `# ⚠️ Срочный долг со вчерашнего дня!
Задача была автоматически перенесена со вчера с повышением приоритета:
**Высокий ➔ Критический**

### Чек-лист согласования
- [x] Ролевая модель (Аналитик ↔ Заказчик)
- [x] Архитектура хранения SQLite + OneDrive
- [x] Pomodoro таймер и Markdown
- [ ] Финальное утверждение у Заказчика`,
      isEscalated: true,
      escalationReason: 'Авто-перенос со вчерашнего дня (не выполнено в срок)',
      rolloverCount: 1,
      pomodoroCount: 3,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },

    // Tomorrow task
    {
      id: 'task-7',
      title: 'Планирование спринта и бэклога',
      type: 'floating',
      date: tomorrowStr,
      priority: 'medium',
      status: 'todo',
      notes: `Распределить задачи по модулям Tauri + React.`,
      pomodoroCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
