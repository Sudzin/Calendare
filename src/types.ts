export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'postponed';
export type TaskType = 'timed' | 'floating';

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  priority: TaskPriority;
  status: TaskStatus;
  notes: string; // Markdown text
  reminderTime?: string;
  isEscalated?: boolean;
  escalationReason?: string;
  rolloverCount?: number;
  pomodoroCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type ThemePreset = 'midnight-gold' | 'emerald-frosted' | 'solar-glass';

export interface AppSettings {
  dbPath: string;
  customWeekends: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  soundEnabled: boolean;
  autoRollover: boolean;
  notificationsEnabled: boolean;
  startWithWindows: boolean;
  theme: ThemePreset | 'dark' | 'light';
  blurStrength?: number;
}

export interface DayWorkload {
  total: number;
  completed: number;
  hasCritical: boolean;
  hasOverdue: boolean;
  level: 'none' | 'light' | 'moderate' | 'heavy';
}
