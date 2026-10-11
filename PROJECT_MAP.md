# Project Map

## 1. Project purpose

Calendare (Chronos-Task) — персональный локальный десктопный планировщик задач и календарь на базе Tauri 2 и React. 
Приложение хранит данные в виде отдельных атомарных JSON-файлов задач с поддержкой шифрования (AES-256-GCM, Argon2id, SHA-256 манифест) в пользовательской папке (Google Drive, OneDrive, Syncthing) для прозрачной синхронизации между компьютерами. 
Включает интерактивную сетку календаря с расчетом нагрузки, тайм-слоты и гибкие задачи с Markdown-заметками, Pomodoro-таймер, автоматический идемпотентный перенос просроченных задач (rollover) с эскалацией приоритета, системный трей, нативные уведомления Windows Action Center (работающие при скрытом окне), автозапуск и координацию напоминаний для двух ПК.

## 2. Stack

* **Framework**: React 19 (SPA)
* **Desktop shell**: Tauri 2 (Rust core, NSIS installer)
* **Language**: TypeScript + Rust
* **Build tool**: Vite 8 (+ `@tailwindcss/vite`)
* **Styling**: Tailwind CSS v4, Lucide React (иконки), Motion
* **Testing**: Vitest (12 тест-сьютов, 174+ тестов)
* **Storage**: Атомарные JSON-файлы на диске + зашифрованный Vault (Tauri 2/Rust); fallback к `localStorage` в веб-окружении
* **Security & Crypto**: AES-256-GCM, Argon2id KDF, SHA-256 manifest integrity, Windows Credential Manager
* **Libraries**: `d3` (круговой прогресс-виджет в сайдбаре), `@tauri-apps/api`

## 3. Directory map

```
src-tauri/             # Оболочка Tauri 2 (Rust-бэкенд, трей, автозапуск, шифрование, файловый слой)
│   ├── Cargo.toml     # Зависимости Rust (tauri, aes-gcm, argon2, sha2, zeroize)
│   ├── tauri.conf.json# Конфигурация Tauri (окна, CSP, трей, сборка)
│   └── src/
│       ├── lib.rs     # Главный модуль Tauri, трей, перехват закрытия в трей, команды
│       ├── storage.rs # Атомарная запись (.tmp -> rename), карантин corrupt/, tombstones
│       ├── vault.rs   # Жизненный цикл зашифрованного Vault, Argon2id, мастер-ключ
│       ├── crypto.rs  # Криптографические примитивы AES-256-GCM
│       ├── manifest.rs# SHA-256 манифест целостности файлов и защита от отката
│       ├── credential_manager.rs # Кэширование производного ключа в Windows Credential Manager
│       └── autostart.rs# Управление автозапуском в реестре Windows (HKCU Run)
src/
├── components/
│   ├── calendar/      # Сетка календаря (месяц/неделя), ячейки дней с индикацией нагрузки
│   ├── common/        # Модальные окна (превью дня, таймер, настройки, шифрование, тосты)
│   ├── day/           # Дневной воркспейс, списки задач, форма создания и детальный просмотр
│   ├── layout/        # Плавающий сайдбар-док и навигация
│   ├── markdown/      # Редактор и превью Markdown-заметок для задач
│   ├── pomodoro/      # Виджет и контроллеры Pomodoro-таймера
│   └── sidebar/       # Виджеты сайдбара (недельная сводка, D3-прогресс)
├── data/              # Демонстрационные стартовые задачи (initialTasks)
├── hooks/             # React hooks (задачи, настройки, rollover, уведомления, pomodoro)
├── repositories/      # Слой персистентности (TaskRepository: Tauri file storage / localStorage)
├── services/          # Сервисы ОС и платформы (tauriBridge, notificationService, reminderScheduler, deviceCoordination)
└── utils/             # Чистые утилиты и бизнес-логика (даты, taskMerge, rollover, приоритеты, звук, валидация)
```

## 4. Core modules

| Module | Location | Responsibility |
| --- | --- | --- |
| Task storage | `src/repositories/TaskRepository.ts` | CRUD задач, поддержка бэкендов (`localStorage` / Tauri file storage), слияние, слежение за внешними изменениями, очистка надгробий |
| Deterministic task merge | `src/utils/taskMerge.ts` | Чистая логика детерминированного слияния версий задач (updatedAt, канонический tie-breaker) и фильтрация надгробий |
| Tauri storage engine | `src-tauri/src/storage.rs` | Атомарная запись задач (.tmp -> rename), изоляция битых файлов в `corrupt/`, tombstones, очистка >30 дней, детерминированное слияние версий |
| Vault encryption | `src-tauri/src/vault.rs`, `src-tauri/src/crypto.rs` | Аутентифицированное шифрование AES-256-GCM, деривация ключа Argon2id, фраза восстановления, очистка памяти zeroize |
| Manifest integrity | `src-tauri/src/manifest.rs` | Контрольные суммы SHA-256 для защиты от отката версий и незаметной модификации файлов |
| Windows Credential Manager | `src-tauri/src/credential_manager.rs` | Безопасное хранение ключа разблокировки в защищенном системном хранилище учетных данных Windows |
| Tauri bridge & commands | `src/services/tauriBridge.ts`, `src-tauri/src/lib.rs` | Вызовы Tauri 2 (чтение/запись, выбор папки, очистка надгробий, нативные уведомления, автозапуск, трей) |
| Rollover | `src/utils/rollover.ts` | Чистая идемпотентная бизнес-логика переноса просроченных задач и повышения приоритетов (с исключением надгробий и postponed) |
| Date/time | `src/utils/date.ts` | Локальные календарные даты (`YYYY-MM-DD`), смещения дней, ISO timestamp |
| Calendar grid utils | `src/utils/dateUtils.ts` | Матрицы месяца и недели, русские названия месяцев/дней недели |
| Notifications service | `src/services/notificationService.ts` | Изоляция нативных уведомлений Tauri (WinRT Toast) и Browser Notification API |
| Reminder scheduler | `src/services/reminderScheduler.ts` | Планирование и отправка уведомлений задач по `reminderTime` даже при свёрнутом в трей окне |
| Device coordination | `src/services/deviceCoordination.ts` | Координация показа напоминаний на одном устройстве при двух включенных ПК для исключения дублирования |
| Native autostart & tray | `src-tauri/src/autostart.rs`, `src-tauri/src/lib.rs` | Нативный автозапуск Windows в реестре HKCU, системный трей, сворачивание в трей при закрытии окна |
| Reminder calculation | `src/utils/reminder.ts` | Чистый расчет локального момента напоминания задачи (`getReminderDateTime`) |
| Priority calculation | `src/utils/priorityUtils.ts` | Правила эскалации приоритета (`low` → `medium` → `high` → `critical`) и метаданные |
| Workload calculation | `src/utils/workloadUtils.ts` | Расчет плотности задач дня (`none`, `light`, `moderate`, `heavy`) |
| Sound effects | `src/utils/sound.ts` | Звуковые эффекты через Web Audio API (клики, алерты, таймер) |
| Backup validation | `src/utils/backupValidation.ts` | Валидация структуры задач, настроек и безопасных ID (`[A-Za-z0-9_-]`) при импорте JSON-бэкапа |
| Settings hook | `src/hooks/useSettings.ts` | Управление настройками, темами и синхронизация с системным автозапуском и папкой данных |

## 5. Important files

* `src/types.ts` — TypeScript типы сущностей (`Task`, `AppSettings`, статусы, приоритеты).
* `src/repositories/TaskRepository.ts` — репозиторий задач; модуль чтения/записи задач в файловое хранилище / localStorage.
* `src/utils/date.ts` — централизованный модуль работы с календарными датами и временем.
* `src/utils/taskMerge.ts` — чистое детерминированное слияние задач из синхронизируемой папки.
* `src/utils/rollover.ts` — чистая идемпотентная бизнес-функция переноса задач на целевую дату.
* `src/utils/reminder.ts` — чистый расчет локального момента напоминания задачи (`getReminderDateTime`).
* `src/services/notificationService.ts` — сервис вызова WinRT Toast / Browser Notification API.
* `src/services/reminderScheduler.ts` — сервис планирования и показа напоминаний по таймеру.
* `src/services/deviceCoordination.ts` — сервис координации единственного активного хоста напоминаний.
* `src/hooks/useTasks.ts` — React-хук состояния задач, связывающий UI с `TaskRepository`.
* `src/hooks/useRollover.ts` — React-хук оркестрации переноса (вызов `rolloverTasks`, тосты, модалка).
* `src/hooks/useNotifications.ts` — хук очереди in-app тостов и вызова `notificationService`.
* `src/hooks/useReminderScheduler.ts` — хук синхронизации задач со службой `reminderScheduler`.
* `src/hooks/useSettings.ts` — хук настроек приложения, тем и автозапуска.
* `src/App.tsx` — корневой компонент приложения, модальные окна и композиция провайдеров.
* `src/components/calendar/CalendarGrid.tsx` — основная сетка календаря (месячный и недельный вид).
* `src/components/day/DayWorkspaceModal.tsx` — рабочий экран выбранного дня со списком и формой задач.
* `src/components/day/TaskForm.tsx` — форма создания/редактирования задачи.
* `src/components/common/SettingsModal.tsx` — модальное окно настроек (выбор папки данных, автозапуск, напоминания на этом ПК, бэкап, шифрование).
* `src/components/common/VaultSetupModal.tsx`, `VaultUnlockModal.tsx` — интерфейс шифрования хранилища.
* `src/utils/backupValidation.ts` — парсинг и валидация импортируемых бэкапов.

## 6. Data flow

```
User Action
  → React Component (Modal, Button, Input)
  → React Hook (useTasks, useRollover, useSettings)
  → Pure Business Logic / Service (rolloverTasks, taskMerge, reminderScheduler)
  → Repository (TaskRepository)
  → Storage Layer:
      ├── Tauri Desktop: Atomic JSON Files / AES-256-GCM Vault (Rust engine)
      └── Web / Tests: Browser localStorage
  → State Update (useState)
  → UI Re-render
```

### Поток синхронизации и слияния задач:
1. Задачи хранятся в отдельных файлах `task-<id>.json` в выбранной папке пользователя (Google Drive / OneDrive / Syncthing).
2. При внешнем изменении файлов другим ПК или ручном чтении `TaskRepository` выполняет детерминированное слияние через `mergeTaskLists`.
3. Версия с более свежим `updatedAt` побеждает; при равенстве используется канонический tie-breaker.
4. Задачи с `deletedAt` (надгробия) гарантированно не воскресают.

## 7. Task model

* **Определение**: `src/types.ts` (`interface Task`).
* **Ключевые поля**:
  * `id`: строка (безопасный ID: `[A-Za-z0-9_-]`, 1..128 символов, без служебных имён ОС).
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
  * `lastRolloverDate`: дата последнего переноса (`YYYY-MM-DD`), исключающая повторную эскалацию в тот же день.
  * `deletedAt`: отметка времени удаления для надгробия (ISO 8601).
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
* **Изолированная бизнес-логика**: функции в `src/utils/` чистые, не зависят от React, хуков, DOM или звуков.
* **Изоляция платформенных API**: работа с Tauri и браузерными API вынесена в `src/services/` и возвращает безопасные fallback-значения без падения приложения.
* **Ответственность репозитория**: `TaskRepository` полностью отвечает за сериализацию, валидацию и персистентность задач.
* **Безопасность файловой системы**: атомарная запись файлов через временные файлы (`.tmp` -> переименование), изоляция битых файлов в `corrupt/`.

## 10. Dependency map

```
App
  ├── useSettings (управляет AppSettings, localStorage, OS autostart)
  ├── useTasks (управляет Task[], вызывает TaskRepository)
  │     └── TaskRepository (Tauri file storage, vault, localStorage, backupValidation)
  ├── useNotifications (управляет in-app toasts, вызывает notificationService)
  │     ├── sound
  │     └── notificationService (Tauri WinRT Toast / Browser Notification API)
  ├── useRollover (оркестрирует перенос задач)
  │     ├── getTodayDate (src/utils/date.ts)
  │     ├── rolloverTasks (src/utils/rollover.ts)
  │     └── sound
  └── useReminderScheduler (оркестрирует напоминания)
        └── reminderScheduler (src/services/reminderScheduler.ts)
              ├── deviceCoordination (src/services/deviceCoordination.ts)
              ├── getReminderDateTime (src/utils/reminder.ts)
              └── showNotification (src/services/notificationService.ts)
```

## 11. Where to start

* **Task CRUD** → `src/hooks/useTasks.ts`, `src/components/day/TaskForm.tsx`, `src/components/day/TaskDetailView.tsx`
* **Task persistence / storage** → `src/repositories/TaskRepository.ts`, `src-tauri/src/storage.rs`
* **Encryption / Vault** → `src-tauri/src/vault.rs`, `src-tauri/src/crypto.rs`, `src/components/common/VaultSetupModal.tsx`
* **Multi-device merge** → `src/utils/taskMerge.ts`, `src/services/deviceCoordination.ts`
* **Rollover** → `src/utils/rollover.ts`, `src/utils/rollover.test.ts`, `src/hooks/useRollover.ts`
* **Dates & formatting** → `src/utils/date.ts`, `src/utils/date.test.ts`, `src/utils/dateUtils.ts`
* **Notifications & Desktop Native** → `src/services/notificationService.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/autostart.rs`
* **Settings & themes** → `src/hooks/useSettings.ts`, `src/components/common/SettingsModal.tsx`
* **Backup & export/import** → `src/utils/backupValidation.ts`, `src/components/common/SettingsModal.tsx`
* **Tests** → запуск всех тестов через `npm run test:run`

## 12. Known technical debt

* **Прямые вызовы `new Date().toISOString()` в TaskRepository** → `src/repositories/TaskRepository.ts:62, 89` → Репозиторий пока формирует timestamps напрямую вместо `getCurrentTimestamp()`.
* **Прямые вызовы `toISOString()` в initialTasks** → `src/data/initialTasks.ts` → Используется нативный метод Date вместо централизованной функции.

## 13. Agent navigation rule

> Перед началом задачи сначала прочитай `PROJECT_MAP.md`. Затем открывай только файлы, относящиеся к задаче. Не сканируй весь `src/` без необходимости.
> Если структура проекта изменилась существенно, обнови `PROJECT_MAP.md` отдельным коммитом.
