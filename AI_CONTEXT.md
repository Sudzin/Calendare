# AI Context & Architectural Map — Calendare (Chronos-Task)

This document provides a concise architectural overview and navigation map for AI coding assistants and code review agents.

---

## Component Hierarchy & Data Flow

```text
[App.tsx] — Composition Root
 │
 ├── Custom Hooks & Services:
 │    ├── useSettings()            -> localStorage 'chronos_settings' + Tauri OS autostart/dataDir sync
 │    ├── useTasks()               -> TaskRepository (Tauri encrypted file storage / localStorage fallback)
 │    ├── useNotifications()       -> In-app toasts + Tauri native WinRT Toast notifications
 │    ├── useReminderScheduler()   -> Background scheduler with single-device coordination
 │    ├── useRollover()            -> Idempotent overdue detection & +1 priority escalation
 │    └── usePomodoro()            -> 25/5 timer state, audio and notification triggers
 │
 ├── Desktop Native Layer (src-tauri/):
 │    ├── System Tray & Menu       -> Tray icon, "Открыть Calendare" / "Выход", close-to-tray window intercept
 │    ├── Windows Autostart        -> HKCU\Software\Microsoft\Windows\CurrentVersion\Run
 │    ├── Native Notifications     -> WinRT Toast Manager (even when minimized to tray)
 │    ├── Native Folder Picker     -> System folder browser dialog for data directory
 │    └── Storage & Vault Engine   -> Atomic file I/O, AES-256-GCM, Argon2id, SHA-256 manifest, tombstones
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
 └── Modals (Max 640px, Internal Scroll, Esc Support):
      ├── [DayPreviewModal.tsx]     — Quick summary popover (<540px)
      ├── [DayWorkspaceModal.tsx]   — Master-Detail Day Workspace (<640px)
      │    ├── [DayHeader.tsx]      — Navigation & day stats
      │    ├── [TaskList.tsx]       — Timed & floating tasks
      │    ├── [TaskForm.tsx]       — Inline task creator
      │    └── [TaskDetailView.tsx] — Status, priority, markdown notes
      │         └── [MarkdownWorkspace.tsx] — Notes with interactive checkboxes (- [ ])
      ├── [SettingsModal.tsx]       — Data folder picker, themes, weekends, autostart, device reminders, vault
      ├── [VaultSetupModal.tsx]     — Encryption setup (password, Argon2id, recovery key)
      ├── [VaultUnlockModal.tsx]    — Unlock vault on startup or after lock
      ├── [RolloverAlertModal.tsx]  — Summary of rolled-over tasks (+1 priority)
      ├── [MigrationBannerModal.tsx]— One-click migration from legacy localStorage to files
      └── [ToastContainer.tsx]      — Bottom-right minimal toast notifications
```

---

## Key Invariants for AI Reviewers

1. **Storage Invariant:** Individual JSON files per task (`task-<id>.json`). Atomic write via temporary file (`.tmp` → rename). Corrupt files isolated in `corrupt/`.
2. **Encryption Invariant:** AES-256-GCM authenticated encryption with Argon2id KDF. Recovery key (BIP39-style words) for emergency restore. Zeroize sensitive keys in memory.
3. **Multi-Device Sync Invariant:** Transparent file sync via Google Drive / OneDrive / Syncthing. Deterministic conflict resolution (higher `updatedAt`, deterministic tie-breaker). Tombstone deletion with 30-day purge.
4. **Device Coordination Invariant:** Single-device reminder toggle (`remindersThisDeviceOnly`) prevents duplicate audio chimes and notifications when two PCs run simultaneously on the same synced folder.
5. **Zero Blue Discipline:** No blue colors across accents, hovers, focus rings, links, or selections.
6. **Design Tokens:** All colors derive from `--color-*` variables in `src/index.css` via Tailwind v4 `@theme`.
7. **Line Limit & Modularity:** Component files remain strictly modular (~200 lines max).
8. **Keyboard Support:** `Esc` closes any modal; `N` creates a task; `←` / `→` navigates calendar.
9. **Pure Utilities:** Functions in `src/utils/` (`date`, `taskMerge`, `priorityUtils`, `rollover`, `sound`) are pure and independent of React.
