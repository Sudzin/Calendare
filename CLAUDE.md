# Chronos-Task — Claude AI Codebase & Review Guide

This guide is designed for Anthropic Claude (Claude Code, Claude Projects, and AI Reviewers) to understand the architecture, data models, conventions, and review criteria of **Chronos-Task**.

---

## 1. Project Overview & Philosophy

**Chronos-Task** is a local-first, personal desktop calendar and task manager designed for Windows 10/11.
* **Core Philosophy:** 100% offline autonomy. No remote telemetry, no mandatory cloud backends, no user tracking.
* **Sync Strategy:** Single database file (SQLite WAL mode / JSON) designed to reside in a user-chosen synced folder (e.g., OneDrive, Syncthing, Google Drive) for transparent multi-device sync (PC ↔ Laptop).
* **UI/UX Paradigm:**
  1. Google Calendar-style month & week grid with workload indicators and customizable weekend days.
  2. Two-tier day interaction: 1 click = quick preview popover; 2 clicks = full-screen Master-Detail day workspace.
  3. Master-Detail workspace: Left panel = Timed schedule (hours) + Floating to-do items; Right panel = Execution space (status, priority, Pomodoro focus timer, interactive Markdown notes with subtask checklists).
  4. Automatic rollover with priority escalation for uncompleted tasks.

---

## 2. Tech Stack & Commands

* **Framework:** React 19 + TypeScript (Strict mode) + Vite 8
* **Styling:** Tailwind CSS v4 (`@import "tailwindcss";`), Windows 11 Fluent aesthetic
* **Icons:** `lucide-react`
* **Audio:** Web Audio API synthesizer (`src/utils/sound.ts`) — zero external audio asset dependencies.

### Key Commands
```bash
npm run dev      # Start development server on port 3000
npm run build    # Production build via Vite
npm run lint     # Type-check with TypeScript (tsc --noEmit)
npm run preview  # Preview production build locally
```

---

## 3. Codebase File Map

```
/
├── CLAUDE.md                    # This file (AI instructions and review guide)
├── AI_CONTEXT.md                # Quick architectural summary & component hierarchy
├── index.html                   # HTML entry point (Plus Jakarta Sans, JetBrains Mono)
├── metadata.json                # AI Studio application metadata
├── package.json                 # Dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler configuration (bundler resolution)
├── vite.config.ts               # Vite configuration with Tailwind CSS plugin
└── src/
    ├── main.tsx                 # React DOM mount point
    ├── App.tsx                  # Root controller, state management, modal router, toast stack
    ├── index.css                # Tailwind import, base typography, Windows scrollbar styles
    ├── types.ts                 # TypeScript domain entities and contracts
    ├── data/
    │   └── initialTasks.ts      # Seed demo tasks (reflects student/engineer daily workflow)
    ├── utils/
    │   ├── dateUtils.ts         # Russian calendar matrix, day calculations, formatting
    │   └── sound.ts             # Web Audio API synthesizer for chimes & alerts
    └── components/
        ├── CalendarView.tsx     # Month/Week calendar grid with workload dots and chips
        ├── DayPreviewModal.tsx  # Popover preview on single-click
        ├── DayWorkspaceModal.tsx# Master-Detail split-screen day workspace
        ├── MarkdownWorkspace.tsx# Markdown editor & viewer with bidirectional checklist sync
        ├── PomodoroTimer.tsx    # 25/5 Pomodoro focus timer with progress and notifications
        ├── SettingsModal.tsx    # SQLite sync path, custom weekends, backup export/import
        ├── RolloverAlertModal.tsx# Modal summary showing escalated tasks (+1 priority)
        └── WindowsTraySimulator.tsx # Windows 11 taskbar simulation, tray flyout, and toasts
```

---

## 4. Domain Data Entities (`src/types.ts`)

### `Task`
| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique task identifier (`task-<timestamp>` or uuid) |
| `title` | `string` | Name of the task |
| `type` | `'timed' \| 'floating'` | Fixed time slot vs. flexible daily task |
| `date` | `string` | Target date in ISO format: `YYYY-MM-DD` |
| `startTime` | `string?` | Optional start time (`HH:MM`) for `timed` tasks |
| `endTime` | `string?` | Optional end time (`HH:MM`) for `timed` tasks |
| `priority` | `TaskPriority` | `'low' \| 'medium' \| 'high' \| 'critical'` |
| `status` | `TaskStatus` | `'todo' \| 'in_progress' \| 'done' \| 'postponed'` |
| `notes` | `string` | Markdown text content with subtasks (`- [ ]`) |
| `reminderTime` | `string?` | Optional notification trigger time |
| `isEscalated` | `boolean?` | Flag indicating priority was escalated during rollover |
| `escalationReason`| `string?` | Explanation for priority escalation |
| `rolloverCount` | `number?` | Total times this task has rolled over |
| `pomodoroCount` | `number?` | Completed 25-minute Pomodoro sessions |

### `AppSettings`
* `dbPath`: String path to the SQLite file (e.g. `C:\Users\User\OneDrive\ChronosTask\tasks.db`).
* `customWeekends`: Number array of weekend day indices (`0` = Sunday, `6` = Saturday).
* `pomodoroWorkMinutes`: Work session duration (default: `25`).
* `pomodoroBreakMinutes`: Break session duration (default: `5`).
* `soundEnabled`: Boolean for synthesizer chimes.
* `autoRollover`: Boolean for automatic rollover check on startup.

---

## 5. Critical Invariants & Business Logic

When reviewing or writing code, ensure these invariants are strictly preserved:

### A. The Rollover & Priority Escalation Rule
1. Uncompleted tasks (`status !== 'done'`) whose `date < today` must be moved to `today`.
2. Priority MUST escalate by exactly +1 tier:
   $$\text{low} \longrightarrow \text{medium} \longrightarrow \text{high} \longrightarrow \text{critical}$$
3. Tasks already at `critical` stay `critical`, but MUST receive `isEscalated = true` and display the **«Срочный долг» (Urgent debt)** badge.
4. Tasks with `status === 'done'` must NEVER be rolled over.

### B. Interactive Markdown Reverse-Sync
* In `MarkdownWorkspace.tsx`, clicking on an interactive checkbox in the preview view (`- [ ]` / `- [x]`) must mutate the exact line in the raw markdown source string via regex matching, maintaining character fidelity.

### C. Web Audio Zero-Asset Rule
* Audio alerts (`sound.playSuccess()`, `sound.playAlert()`, `sound.playClick()`) use Web Audio API oscillators. Do not introduce external `.mp3` or `.wav` URL dependencies, which fail in offline or sandboxed environments.

### D. Date Conventions
* Internal date string format is always `YYYY-MM-DD`.
* In Russian calendar conventions, weeks start on Monday (index `1`). Sunday is index `0`.
* The calendar matrix in `dateUtils.ts` must generate a consistent 35- or 42-cell grid padded with trailing/leading days.

---

## 6. AI Code Review Checklist (For Claude PR Reviews)

When performing a code review, check the following points:

1. **State Mutation Discipline:**
   - Are tasks updated immutably using `prev.map(...)` or `[...prev]`?
   - Is `updatedAt: new Date().toISOString()` updated when modifying task properties?
2. **Tabular Numerals & Time Formatting:**
   - Are digital counters, timer digits, and timestamps styled with `font-mono tabular-nums` to prevent horizontal jitter?
3. **Accessibility & Contrast:**
   - Do priority badges have clear text labels and not rely solely on color?
   - Do interactive controls include `aria` attributes or descriptive `title` tooltips?
4. **Performance & Audio Safety:**
   - Does `AudioContext` handle browser autoplay policies gracefully (`state === 'suspended'` check)?
   - Are timer intervals in `PomodoroTimer.tsx` properly cleaned up in `useEffect` return functions?
5. **No AI Clutter:**
   - Keep interfaces free of fake version tickers, static badge sandwiches, or ornamental telemetry bars.
