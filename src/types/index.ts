export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';

export interface EventItem {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  start_time: string; // ISO 8601 string
  end_time: string;   // ISO 8601 string
  color: string;      // Hex color or palette key
  alarms: number[];   // Minutes before event: [0, 5, 10, 15, 30, 60]
  updated_at: string; // ISO 8601 string
  is_deleted: boolean;
  sync_status: SyncStatus;
}

export interface TaskItem {
  id: string;
  user_id: string;
  title: string;
  color: string;
  is_completed: boolean;
  order_index: number;
  alarm_time?: string | null; // ISO 8601 string or null
  updated_at: string;
  is_deleted: boolean;
  sync_status: SyncStatus;
}

export type CalendarViewMode = 'week' | 'month' | '3days' | 'day';

export interface ColorTheme {
  id: string;
  name: string;
  category: string;
  emoji?: string;
  hex: string;
  bgPastel: string;
  borderAccent: string;
  textColor: string;
  badgeBg: string;
}

export interface AlarmItem {
  id: string;
  itemId: string;
  itemType: 'event' | 'task';
  title: string;
  timeString: string;
  color: string;
  triggerTime: Date;
}

export interface FavoriteItem {
  id: string;
  title: string;
  color: string;
  durationMinutes: number;
  description?: string;
  alarms: number[];
  emoji?: string;
  category?: string;
}

export interface DayHighlight {
  date: string; // 'YYYY-MM-DD'
  color: string; // Hex color
  label: string; // e.g. 'Examen', 'Repos', 'Stage'
}

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  errorMessage?: string | null;
}
