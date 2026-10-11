# Chronos-Task (Calendare) — Claude AI Codebase & Review Guide

This guide is designed for Anthropic Claude (Claude Code, Claude Projects, and AI Reviewers) to understand the architecture, data models, conventions, and review criteria of **Calendare (Chronos-Task)**.

---

## 1. Project Overview & Philosophy

**Calendare** is a local-first, personal desktop calendar and task manager designed for Windows 10/11 powered by Tauri 2.
* **Core Philosophy:** 100% offline autonomy. No remote telemetry, no mandatory cloud backends, no user tracking.
* **Storage Architecture:** 
  1. Individual JSON task files (`task-<id>.json`) with atomic writes (`.tmp` → rename) and corrupted file isolation (`corrupt/`).
  2. Optional encrypted Vault mode: AES-256-GCM authenticated encryption, Argon2id key derivation, recovery key phrase, SHA-256 manifest integrity validation, and Windows Credential Manager caching.
  3. Soft deletion via tombstones (`deletedAt`) with automatic/manual 30-day purge.
* **Sync Strategy:** Designed to reside in a user-chosen synced folder (e.g. Google Drive, OneDrive, Syncthing) for multi-device sync (PC ↔ Laptop).
  - Deterministic conflict resolution: latest `updatedAt` wins; canonical content tie-breaker guarantees identical state regardless of read order.
  - Multi-device reminder coordination: «Напоминания только на этом устройстве» (`remindersThisDeviceOnly`) avoids duplicate notifications and audio alerts when multiple PCs run concurrently.
* **Desktop Shell & Native Capabilities:**
  - Tauri 2 Rust desktop backend.
  - System Tray: persistent tray icon, context menu («Открыть Calendare», «Выход»).
  - Close-to-Tray: closing the window (`WindowEvent::CloseRequested`) hides the window without stopping the background task scheduler.
  - Native Windows Notifications: WinRT Action Center Toast alerts fire even when the app is minimized or hidden in the tray.
  - Windows Autostart: toggle manages `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
  - Native Folder Picker: system folder dialog for data directory selection.
* **UI/UX Paradigm:**
  1. Google Calendar-style month & week grid with workload indicators and customizable weekend days.
  2. Two-tier day interaction: 1 click = quick preview popover; 2 clicks = full-screen Master-Detail day workspace.
  3. Master-Detail workspace: Left panel = Timed schedule (hours) + Floating to-do items; Right panel = Execution space (status, priority, Pomodoro focus timer, interactive Markdown notes with subtask checklists).
  4. Idempotent automatic rollover with priority escalation (+1 tier) for overdue tasks.

---

## 2. Tech Stack & Commands

* **Shell:** Tauri 2 (Rust core)
* **Frontend:** React 19 + TypeScript (Strict mode) + Vite 8
* **Styling:** Tailwind CSS v4 (`@import "tailwindcss";`), lightweight dark glassmorphism aesthetic, Source Serif 4 headings, Inter UI, JetBrains Mono numbers, zero blue colors.
* **Icons:** `lucide-react`
* **Audio:** Web Audio API synthesizer (`src/utils/sound.ts`) — zero external audio asset dependencies.
* **Testing:** Vitest (12 test suites, 170+ tests covering storage, vault, sync, rollover, and native scheduling)

### Key Commands
```bash
npm run dev        # Start development server on port 3000
npm run build      # Production build via Vite
npm run lint       # Type-check with TypeScript (tsc --noEmit)
npm run test:run   # Run full Vitest test suite
npm run tauri build # Build production desktop installer (NSIS)
```

---

## 3. Codebase File Map

```
/
├── CLAUDE.md                    # This file (AI instructions and review guide)
├── AI_CONTEXT.md                # Architectural summary & component hierarchy
├── PROJECT_MAP.md               # Detailed directory & module reference
├── index.html                   # HTML entry point (local fonts, CSP security policy)
├── metadata.json                # Applet configuration
├── package.json                 # Dependencies and npm scripts (package: calendare)
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite configuration with Tailwind CSS plugin
├── src-tauri/                   # Tauri 2 Desktop Shell (Rust)
│   ├── Cargo.toml               # Rust dependencies (tauri, aes-gcm, argon2, sha2, zeroize)
│   ├── tauri.conf.json          # Tauri configuration (CSP, windows, security, tray)
│   └── src/
│       ├── lib.rs               # Tauri entry point, tray icon builder, window events, invoke handlers
│       ├── storage.rs           # Atomic file storage, tombstones, corrupt quarantine, migration
│       ├── vault.rs             # Encrypted vault lifecycle, Argon2id, recovery key, key zeroize
│       ├── crypto.rs            # AES-256-GCM cipher and key derivation primitives
│       ├── manifest.rs          # SHA-256 manifest integrity checker & rollback protection
│       ├── credential_manager.rs # Windows Credential Manager integration
│       └── autostart.rs         # Windows registry HKCU Run autostart controller
└── src/
    ├── main.tsx                 # React DOM mount point
    ├── App.tsx                  # Root composition & modal orchestrator
    ├── index.css                # Tailwind @theme, design tokens, local font faces
    ├── types.ts                 # TypeScript domain entities and contracts
    ├── hooks/
    │   ├── useTasks.ts          # State synchronization with TaskRepository
    │   ├── useSettings.ts       # Settings persistence + OS autostart/dataDir synchronization
    │   ├── useRollover.ts       # Idempotent priority escalation (+1 tier) & overdue rollover
    │   ├── usePomodoro.ts       # Focus timer countdown, sessions, audio/notifications
    │   ├── useNotifications.ts  # In-app toast stack & native/browser notification bridge
    │   └── useReminderScheduler.ts # Hook integration for background reminderScheduler
    ├── repositories/
    │   └── TaskRepository.ts    # Centralized storage abstraction (Tauri file storage / localStorage)
    ├── services/
    │   ├── tauriBridge.ts       # Type-safe IPC bridge to Tauri 2 commands & events
    │   ├── notificationService.ts # Dual-engine notifications (WinRT Toast in Tauri / Browser API)
    │   ├── reminderScheduler.ts # Autonomous background scheduler for task reminderTime
    │   └── deviceCoordination.ts# Single-device reminder coordination across multiple PCs
    ├── utils/
    │   ├── date.ts              # Local calendar date calculations (YYYY-MM-DD)
    │   ├── taskMerge.ts         # Deterministic multi-device task merging & tie-breaking
    │   ├── rollover.ts          # Pure idempotent rollover and escalation business logic
    │   ├── reminder.ts          # Local reminder timestamp calculation
    │   ├── priorityUtils.ts     # Priority ladder logic and semantic token styles
    │   ├── workloadUtils.ts     # Workload density calculation for calendar cells
    │   ├── backupValidation.ts  # JSON backup structure & safe ID validation
    │   └── sound.ts             # Web Audio API synthesizer for chimes & alerts
    └── components/              # Modular UI components (Calendar, Day, Markdown, Pomodoro, Common)
```

---

## 4. Domain Data Entities (`src/types.ts`)

### `Task`
| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Safe task identifier (`task-<timestamp>` or uuid, `[A-Za-z0-9_-]`) |
| `title` | `string` | Name of the task |
| `type` | `'timed' \| 'floating'` | Fixed time slot vs. flexible daily task |
| `date` | `string` | Target date in ISO format: `YYYY-MM-DD` |
| `startTime` | `string?` | Optional start time (`HH:mm`) for `timed` tasks |
| `endTime` | `string?` | Optional end time (`HH:mm`) for `timed` tasks |
| `priority` | `TaskPriority` | `'low' \| 'medium' \| 'high' \| 'critical'` |
| `status` | `TaskStatus` | `'todo' \| 'in_progress' \| 'done' \| 'postponed'` |
| `notes` | `string` | Markdown text content with subtasks (`- [ ]`) |
| `reminderTime` | `string?` | Optional notification trigger time (`HH:mm`) |
| `isEscalated` | `boolean?` | Flag indicating priority was escalated during rollover |
| `escalationReason`| `string?` | Explanation for priority escalation |
| `rolloverCount` | `number?` | Total times this task has rolled over |
| `lastRolloverDate`| `string?` | `YYYY-MM-DD` of last executed rollover (prevents re-escalation) |
| `deletedAt` | `string?` | ISO 8601 timestamp for tombstone soft-deletion |
| `pomodoroCount` | `number?` | Completed 25-minute Pomodoro sessions |
| `createdAt` | `string` | Full ISO 8601 timestamp |
| `updatedAt` | `string` | Full ISO 8601 timestamp (drives deterministic merge) |

### `AppSettings`
* `dataDir`: String path to the task data directory on disk (e.g. `C:\Users\User\Google Drive\CalendareData`).
* `remindersThisDeviceOnly`: Boolean flag ensuring notifications only fire on this designated machine.
* `startWithWindows`: Boolean flag synchronizing with Windows HKCU registry autostart.
* `customWeekends`: Number array of weekend day indices (`0` = Sunday, `6` = Saturday).
* `pomodoroWorkMinutes`: Work session duration (default: `25`).
* `pomodoroBreakMinutes`: Break session duration (default: `5`).
* `soundEnabled`: Boolean for Web Audio synthesizer chimes.
* `autoRollover`: Boolean for automatic rollover check on startup.
* `notificationsEnabled`: Boolean for task reminders.
* `theme`: Active theme preset (`'midnight-gold'`, `'emerald-frosted'`, `'solar-glass'`).
* `blurStrength`: Background glass blur intensity in pixels.

---

## 5. Critical Invariants & Business Logic

### A. The Rollover & Priority Escalation Rule
1. Uncompleted tasks (`status !== 'done'` and `status !== 'postponed'`) whose `date < today` move to `today`.
2. Tasks with `status === 'postponed'` or `status === 'done'` are excluded from rollover.
3. Priority escalates by exactly +1 tier:
   $$\text{low} \longrightarrow \text{medium} \longrightarrow \text{high} \longrightarrow \text{critical}$$
4. Tasks already at `critical` stay `critical`, but receive `isEscalated = true`.
5. Rollover is strictly idempotent: `lastRolloverDate` prevents double-escalation on the same target day across multiple devices.

### B. Deterministic Sync & Tombstones
1. Deletion sets `deletedAt: new Date().toISOString()`; physical files remain as tombstones until purged (>30 days).
2. When merging versions from a synced folder, the higher `updatedAt` wins. If timestamps are identical, a deterministic canonical tie-breaker is applied.
3. Tombstone tasks never resurrect during sync.

### C. Desktop Background Persistence
1. Window close intercepts `WindowEvent::CloseRequested` to hide the window to the system tray.
2. `reminderScheduler` continues ticking in the background.
3. Native WinRT Toast notifications display above other desktop windows.

---

## 6. AI Code Review Checklist

1. **Safety & Zero Clutter:** Keep UI free of fake telemetry, mock logs, or blue color accents.
2. **Atomic Writes:** Any file modifications in Rust must use temporary file renaming (`.tmp` → `.json`).
3. **No Direct Mutex Leaks:** Master keys must zeroize on drop and never be printed in logs.
4. **Platform Safety:** Web fallbacks (`localStorage`, browser Notification) must operate cleanly when running outside Tauri or in headless test suites.
