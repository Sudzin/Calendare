# AI Context & Architectural Map — Chronos-Task

This document provides a concise architectural overview and navigation map for AI coding assistants and code review agents.

---

## Component Hierarchy & Data Flow

```text
[App.tsx] — Composition Root (~120 lines)
 │
 ├── Custom Hooks:
 │    ├── useSettings()      -> localStorage 'chronos_settings' (merged with DEFAULT_SETTINGS)
 │    ├── useTasks()         -> localStorage 'chronos_tasks' (CRUD methods)
 │    ├── useNotifications() -> in-app toasts & browser notification dispatch
 │    ├── useRollover()      -> overdue detection & +1 priority escalation
 │    └── usePomodoro()      -> 25/5 timer state, audio and notification triggers
 │
 ├── Layout & Views:
 │    ├── [Sidebar.tsx] (~64px Icon Rail)
 │    │    ├── Brand Mark: "C" (Source Serif 4)
 │    │    ├── Primary Action: "+" (Hotkey: N)
 │    │    ├── Active Tab: Calendar / Tasks / Pomodoro
 │    │    ├── Action: "Перенос долгов (+1)"
 │    │    └── Bottom Controls: Settings & Theme Switcher (Dark/Light)
 │    │
 │    └── [CalendarGrid.tsx] (Center Viewport)
 │         ├── Month / Week View Mode
 │         ├── Arrow Navigation (← / → keyboard support)
 │         └── [CalendarDayCell.tsx]
 │              ├── Day Number (Source Serif 4)
 │              ├── Thin 2px Workload Indicator Line (DayWorkload)
 │              ├── 1 Click -> opens [DayPreviewModal.tsx]
 │              └── 2 Clicks -> opens [DayWorkspaceModal.tsx]
 │
 ├── Modals (Max 640px, Internal Scroll, Esc Support):
 │    ├── [DayPreviewModal.tsx]   — Quick summary popover (<540px)
 │    ├── [DayWorkspaceModal.tsx] — Master-Detail Day Workspace (<640px, <180 lines)
 │    │    ├── [DayHeader.tsx]    — Navigation & day stats (<90 lines)
 │    │    ├── [TaskList.tsx]     — Timed & floating tasks (<150 lines)
 │    │    ├── [TaskForm.tsx]     — Inline task creator (<120 lines)
 │    │    └── [TaskDetailView.tsx] — Status, priority, markdown (<180 lines)
 │    │         └── [MarkdownWorkspace.tsx] — Notes with interactive checkboxes (- [ ])
 │    ├── [SettingsModal.tsx]     — Theme toggle, weekends, backup JSON, web notice (<560px)
 │    ├── [RolloverAlertModal.tsx]— Rollover report showing old -> escalated priorities (<500px)
 │    └── [ToastContainer.tsx]    — Bottom-right minimal toast notifications
```

---

## Key Invariants for AI Reviewers

1. **Format Invariant:** `localStorage` keys `chronos_tasks` and `chronos_settings` MUST remain backward-compatible.
2. **Zero Blue Discipline:** No blue colors across accents, hovers, focus rings, links, or selections.
3. **Design Tokens:** All colors derive from `--color-*` variables in `src/index.css` via Tailwind v4 `@theme`.
4. **Line Limit:** Component files remain strictly modular (~200 lines max).
5. **Keyboard Support:** `Esc` closes any modal; `N` creates a task; `←` / `→` navigates calendar.
6. **Pure Utilities:** Functions in `src/utils/` (`dateUtils`, `workloadUtils`, `priorityUtils`, `sound`) are pure and independent of React.
