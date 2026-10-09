# Project Map

## 1. Project purpose

Calendare (Chronos-Task) — персональный офлайн-планировщик задач и календарь в виде React SPA. Приложение предоставляет интерактивную сетку календаря (месяц/неделя) с расчетом нагрузки, тайм-слоты и гибкие задачи с Markdown-заметками, Pomodoro-таймер, автоматический перенос просроченных задач (rollover) с эскалацией приоритета, а также экспорт/импорт резервных копий в локальном хранилище браузера.

## 2. Stack

* **Framework**: React 19 (SPA)
* **Desktop shell**: Tauri 2 (Rust core, NSIS installer)
* **Language**: TypeScript + Rust
* **Build tool**: Vite 8 (+ `@tailwindcss/vite`)
* **Styling**: Tailwind CSS v4, Lucide React (иконки), Motion
* **Testing**: Vitest
* **Storage**: Browser `localStorage` (ключи `chronos_tasks`, `chronos_settings`)
* **Libraries**: `d3` (круговой прогресс-виджет в сайдбаре), `@tauri-apps/api`

## 3. Directory map

```
src-tauri/             # Оболочка Tauri 2 (Rust-бэкенд, конфигурация окна, иконки, NSIS)
src/
├── components/
│   ├── calendar/      # Сетка календаря (месяц/неделя), ячейки дней с индикацией нагрузки
│   ├── common/        # Модальные окна (превью дня, таймер, алерт переноса, настройки, тосты)
│   ├── day/           # Дневной воркспейс, списки задач, форма создания и детальный просмотр
│   ├── layout/        # Плавающий сайдбар-док и навигация
│   ├── markdown/      # Редактор и превью Markdown-заметок для задач
│   ├── pomodoro/      # Виджет и контроллеры Pomodoro-таймера
│   └── sidebar/       # Виджеты сайдбара (недельная сводка, D3-прогресс)
├── data/              # Демонстрационные стартовые задачи (initialTasks)
├── hooks/             # React hooks (задачи, настройки, rollover, уведомления, pomodoro)
├── repositories/      # Слой персистентности (TaskRepository с localStorage)
├── services/          # Изолированные сервисы браузерных API (notificationService)
└── utils/             # Чистые утилиты и бизнес-логика (даты, rollover, приоритеты, звук, валидация)
```

## 4. Core modules

| Module | Location | Responsibility |
| --- | --- | --- |
| Task storage | `src/repositories/TaskRepository.ts` | CRUD задач, поддержка бэкендов (`localStorage` / Tauri file storage) |
| Tauri storage engine | `src-tauri/src/storage.rs` | Атомарная запись задач (.tmp -> rename), изоляция битых файлов в `corrupt/`, tombstones, безопасные id |
| Tauri bridge & commands | `src/services/tauriBridge.ts`, `src-tauri/src/lib.rs` | Вызовы Tauri 2 (чтение, атомарная запись, удаление, выбор папки) |
| Rollover | `src/utils/rollover.ts` | Чистая бизнес-логика переноса просроченных задач и повышения приоритетов |
| Date/time | `src/utils/date.ts` | Локальные календарные даты (`YYYY-MM-DD`), смещения дней, ISO timestamp |
| Calendar grid utils | `src/utils/dateUtils.ts` | Матрицы месяца и недели, русские названия месяцев/дней недели |
| Notifications service | `src/services/notificationService.ts` | Изоляция Browser Notification API, проверка разрешений, отправка уведомлений |
| Reminder scheduler | `src/services/reminderScheduler.ts` | Планирование и отправка уведомлений задач по `reminderTime` |
| Reminder calculation | `src/utils/reminder.ts` | Чистый расчет локального момента напоминания задачи (`getReminderDateTime`) |
| Priority calculation | `src/utils/priorityUtils.ts` | Правила эскалации приоритета (`low` → `medium` → `high` → `critical`) и метаданные |
| Workload calculation | `src/utils/workloadUtils.ts` | Расчет плотности задач дня (`none`, `light`, `moderate`, `heavy`) |
| Sound effects | `src/utils/sound.ts` | Звуковые эффекты через Web Audio API (клики, алерты, таймер) |
| Backup validation | `src/utils/backupValidation.ts` | Валидация структуры задач и настроек при импорте JSON-бэкапа |
| Settings hook | `src/hooks/useSettings.ts` | Управление настройками, темами и их сохранение в `localStorage` |

## 5. Important files

* `src/types.ts` — TypeScript типы сущностей (`Task`, `AppSettings`, статусы, приоритеты).
* `src/repositories/TaskRepository.ts` — репозиторий задач; единственный модуль чтения/записи задач в хранилище.
* `src/utils/date.ts` — централизованный модуль работы с календарными датами и временем.
* `src/utils/rollover.ts` — чистая бизнес-функция переноса задач на целевую дату.
* `src/utils/reminder.ts` — чистый расчет локального момента напоминания задачи (`getReminderDateTime`).
* `src/services/notificationService.ts` — изолированный сервис вызова Browser Notification API.
* `src/services/reminderScheduler.ts` — сервис планирования и показа напоминаний по таймеру.
* `src/hooks/useTasks.ts` — React-хук состояния задач, связывающий UI с `TaskRepository`.
* `src/hooks/useRollover.ts` — React-хук оркестрации переноса (вызов `rolloverTasks`, тосты, модалка).
* `src/hooks/useNotifications.ts` — хук очереди in-app тостов и вызова `notificationService`.
* `src/hooks/useReminderScheduler.ts` — хук синхронизации задач со службой `reminderScheduler`.
* `src/hooks/useSettings.ts` — хук настроек приложения и переключения тем оформления.
* `src/App.tsx` — корневой компонент приложения, модальные окна и композиция провайдеров.
* `src/components/calendar/CalendarGrid.tsx` — основная сетка календаря (месячный и недельный вид).
* `src/components/day/DayWorkspaceModal.tsx` — рабочий экран выбранного дня со списком и формой задач.
* `src/components/day/TaskForm.tsx` — форма создания/редактирования задачи.
* `src/components/common/SettingsModal.tsx` — модальное окно настроек, экспорт/импорт бэкапа.
* `src/utils/backupValidation.ts` — парсинг и валидация импортируемых бэкапов.

## 6. Data flow

```
User Action
  → React Component (Modal, Button, Input)
  → React Hook (useTasks, useRollover, useSettings)
  → Pure Business Logic / Service (rolloverTasks, notificationService)
  → Repository (TaskRepository)
  → Browser Storage (localStorage)
  → State Update (useState)
  → UI Re-render
```

### Поток создания и изменения Task:
1. Пользователь сохраняет задачу в `TaskForm` или редактирует в `TaskDetailView`.
2. Компонент вызывает метод `addTask` / `updateTask` из `useTasks`.
3. `TaskRepository.create` генерирует ID (через `crypto.randomUUID()`, если не передан), проставляет `createdAt` и `updatedAt`.
4. `TaskRepository.update` автоматически обновляет поле `updatedAt` задачи.
5. Задачи синхронно сериализуются в `localStorage` (`chronos_tasks`).
6. Состояние `tasks` в `useTasks` обновляется, запуская перерендер сетки и воркспейса.

## 7. Task model

* **Определение**: `src/types.ts` (`interface Task`).
* **Ключевые поля**:
  * `id`: строка (правило: генерируется через `crypto.randomUUID()` функцией `generateTaskId()` в `TaskRepository`).
  * `title`: строка.
  * `type`: `'timed'` (привязанная ко времени) \| `'floating'` (гибкая задача дня).
  * `date`: календарная дата задачи (`YYYY-MM-DD`).
  * `startTime` / `endTime`: время (`HH:mm`), опционально.
  * `priority`: `'low'` \| `'medium'` \| `'high'` \| `'critical'`.
  * `status`: `'todo'` \| `'in_progress'` \| `'done'` \| `'postponed'`.
  * `notes`: текст заметки в формате Markdown.
  * `reminderTime`: строка времени напоминания (`HH:mm`), опционально.
  * `isEscalated`: флаг эскалации (`boolean`).
  * `escalationReason`: текстовое пояснение причины эскалации.
  * `rolloverCount`: количество переносов (`number`).
  * `pomodoroCount`: количество сессий фокуса (`number`).
  * `createdAt`: полный ISO 8601 timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`).
  * `updatedAt`: полный ISO 8601 timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`).

## 8. Date & time rules

* **Календарная дата**: строго `YYYY-MM-DD`.
* **Время**: строго `HH:mm`.
* **Timestamps**: полный ISO 8601 (через `getCurrentTimestamp()` из `src/utils/date.ts`).
* **Локальный часовой пояс**: все календарные даты (`today`, `yesterday`, дата задачи, rollover) работают исключительно в локальном времени пользователя.
* **Запрет UTC для дат**: запрещено определять локальный календарный день через UTC (`toISOString().slice(0, 10)`).
* **Сравнение дат**: календарные даты сравниваются лексикографически как строки `YYYY-MM-DD` (`isBeforeDate`, `isSameDate`, `isAfterDate`).
* **Единый источник**: вся работа с датами ведется строго через `src/utils/date.ts`.

## 9. Architecture rules

* **UI без бизнес-логики**: компоненты отвечают только за отображение и пользовательский ввод.
* **Изолированная бизнес-логика**: функции в `src/utils/` (например, `rolloverTasks`) чистые, не зависят от React, хуков, DOM или звуков.
* **Изоляция платформенных API**: работа с браузерными API (`Notification`) вынесена в `src/services/` и возвращает безопасные fallback-значения без падения приложения.
* **Ответственность репозитория**: `TaskRepository` полностью отвечает за сериализацию, валидацию и персистентность задач.
* **Централизованные даты**: отсутствие ручных манипуляций с `new Date()` для календарных дней внутри компонентов.

## 10. Dependency map

```
App
  ├── useSettings (управляет AppSettings, localStorage)
  ├── useTasks (управляет Task[], вызывает TaskRepository)
  │     └── TaskRepository (localStorage, validateBackup, initialTasks)
  ├── useNotifications (управляет in-app toasts, вызывает notificationService)
  │     ├── sound
  │     └── notificationService (Browser Notification API)
  ├── useRollover (оркестрирует перенос задач)
  │     ├── getTodayDate (src/utils/date.ts)
  │     ├── rolloverTasks (src/utils/rollover.ts)
  │     │     ├── isBeforeDate (src/utils/date.ts)
  │     │     ├── getNextPriority (src/utils/priorityUtils.ts)
  │     │     └── getCurrentTimestamp (src/utils/date.ts)
  │     └── sound
  └── useReminderScheduler (оркестрирует напоминания)
        └── reminderScheduler (src/services/reminderScheduler.ts)
              ├── getReminderDateTime (src/utils/reminder.ts)
              └── showNotification (src/services/notificationService.ts)
```

### Чувствительные зоны:
* `src/types.ts`: изменение схемы `Task` ломает `backupValidation`, `TaskRepository` и типы в десятке компонентов.
* `src/utils/date.ts`: изменение формата возврата сломает фильтрацию задач по дням и календарную сетку.
* `src/repositories/TaskRepository.ts`: синхронно пишет в `localStorage`; ошибки парсинга/записи могут повредить пользовательские данные.
* `src/utils/rollover.ts`: изменение условий отбора или полей эскалации влияет на модалку переноса и статус задач.

## 11. Where to start

* **Task CRUD** → `src/hooks/useTasks.ts`, `src/components/day/TaskForm.tsx`, `src/components/day/TaskDetailView.tsx`
* **Task persistence / storage** → `src/repositories/TaskRepository.ts`, `src/repositories/TaskRepository.test.ts`
* **Rollover** → `src/utils/rollover.ts`, `src/utils/rollover.test.ts`, `src/hooks/useRollover.ts`
* **Dates & formatting** → `src/utils/date.ts`, `src/utils/date.test.ts`, `src/utils/dateUtils.ts`
* **Notifications** → `src/services/notificationService.ts`, `src/services/notificationService.test.ts`, `src/hooks/useNotifications.ts`
* **Reminders & scheduler** → `src/services/reminderScheduler.ts`, `src/services/reminderScheduler.test.ts`, `src/utils/reminder.ts`, `src/hooks/useReminderScheduler.ts`
* **Calendar view** → `src/components/calendar/CalendarGrid.tsx`, `src/components/calendar/CalendarDayCell.tsx`
* **Settings & themes** → `src/hooks/useSettings.ts`, `src/components/common/SettingsModal.tsx`
* **Backup & export/import** → `src/utils/backupValidation.ts`, `src/utils/backupValidation.test.ts`, `src/components/common/SettingsModal.tsx`
* **Tests** → запуск всех тестов через `npm run test:run`

## 12. Known technical debt

* **Отсутствие системного фонового scheduler при закрытом приложении** → `src/services/reminderScheduler.ts` → Текущий scheduler работает в рантайме открытого SPA (setTimeout). Фоновые уведомления через Web Worker или нативные Windows/Tauri нотификации пока не реализованы.
* **Прямые вызовы `new Date().toISOString()` в TaskRepository** → `src/repositories/TaskRepository.ts:62, 89` → Репозиторий пока формирует timestamps напрямую вместо `getCurrentTimestamp()`.
* **Прямые вызовы `toISOString()` в initialTasks и SettingsModal** → `src/data/initialTasks.ts`, `src/components/common/SettingsModal.tsx:80` → Используется нативный метод Date вместо централизованной функции.

## 13. Agent navigation rule

> Перед началом задачи сначала прочитай `PROJECT_MAP.md`. Затем открывай только файлы, относящиеся к задаче. Не сканируй весь `src/` без необходимости.
> Если структура проекта изменилась существенно, обнови `PROJECT_MAP.md` отдельным коммитом.
