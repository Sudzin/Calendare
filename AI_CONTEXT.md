# AI Context & Architectural Map — Chronos-Task

This document provides a concise architectural overview and navigation map for AI coding assistants and code review agents.

---

## Component Hierarchy & Data Flow

```text
[App.tsx] — Root Controller
 │
 ├── State:
 │    ├── tasks: Task[] (saved in localStorage 'chronos_tasks')
 │    ├── settings: AppSettings (saved in localStorage 'chronos_settings')
 │    ├── currentDate: Date (Calendar view navigation)
 │    ├── activeDateStr: string (Target date for modal views)
 │    ├── toasts: ToastNotification[] (Bottom-right notification queue)
 │    └── isMinimized: boolean (Windows tray simulation)
 │
 ├── Header
 │    ├── Brand: "Chronos-Task"
 │    ├── Action: "Перенос долгов (+1 приоритет)" -> runs runRollover()
 │    └── Right cluster: "Синхронизация & Настройки" + Windows Controls (—, ✕)
 │
 ├── View: [CalendarView.tsx]
 │    ├── Month Matrix / Week View
 │    ├── Workload Indicators (0/N tasks, critical flames, completed checkmarks)
 │    ├── Single Click -> opens [DayPreviewModal.tsx]
 │    └── Double Click -> opens [DayWorkspaceModal.tsx]
 │
 ├── Modals & Overlays:
 │    ├── [DayPreviewModal.tsx]   — Compact summary popover with "Открыть полный день" CTA
 │    ├── [DayWorkspaceModal.tsx] — Master-Detail Day Workspace
 │    │    ├── Left (Master):
 │    │    │    ├── Timed Schedule (Sorted HH:MM)
 │    │    │    ├── Floating Tasks
 │    │    │    └── Quick Add Task Form
 │    │    └── Right (Detail):
 │    │         ├── Status Selector (todo / in_progress / done / postponed)
 │    │         ├── Priority Selector (low / medium / high / critical)
 │    │         ├── [PomodoroTimer.tsx] (25m work / 5m break countdown)
 │    │         └── [MarkdownWorkspace.tsx] (Editor + Clickable Checklist Preview)
 │    ├── [SettingsModal.tsx]     — SQLite path, custom weekends, JSON backup/restore
 │    ├── [RolloverAlertModal.tsx]— Rollover report showing old -> escalated priorities
 │    └── [WindowsTraySimulator.tsx] — System tray flyout + Toast notification stack
```

---

## Key Invariants for AI Reviewers

1. **Date Serialization:** Always use ISO date string `YYYY-MM-DD` for `Task.date`.
2. **Priority Ladder:** Escalation order is strictly:
   `low` -> `medium` -> `high` -> `critical`.
   Tasks at `critical` stay `critical` with `isEscalated = true`.
3. **Sound:** Do not add external `.mp3` dependencies. Always use `sound.ts` (`sound.playSuccess()`, `sound.playAlert()`, `sound.playClick()`).
4. **Offline Local Storage:** Keep all updates client-side; sync is mediated by the user's filesystem (OneDrive / Syncthing) via the file path configured in `SettingsModal.tsx`.

---

## Quick Verification Scenarios

* **Scenario 1: Rollover Check**
  1. Click "Перенос долгов (+1 приоритет)" in the top bar.
  2. Verify that uncompleted past tasks are moved to today with +1 priority.
  3. Verify the `RolloverAlertModal` appears with the before/after breakdown.
* **Scenario 2: Master-Detail Workflow**
  1. Double click on today's date in the calendar.
  2. Select "Сделать блины в свободное время".
  3. Click a checkbox in the Markdown checklist on the right.
  4. Verify the checkbox toggles state and persists in notes.
* **Scenario 3: Pomodoro Focus Session**
  1. Select any task in the Master-Detail view.
  2. Click "Старт" on the Pomodoro widget.
  3. Click the skip icon `>>` to advance through work/break cycles and verify audio chime + toast notification.
