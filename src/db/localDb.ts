import Dexie, { Table } from 'dexie';
import { EventItem, TaskItem } from '../types';
import { addDays, setHours, setMinutes, startOfWeek } from 'date-fns';

export class MedicalAppDatabase extends Dexie {
  events!: Table<EventItem, string>;
  tasks!: Table<TaskItem, string>;

  constructor() {
    super('MedicalAppDatabase');

    this.version(1).stores({
      events: 'id, user_id, start_time, end_time, updated_at, is_deleted, sync_status',
      tasks: 'id, user_id, is_completed, order_index, updated_at, is_deleted, sync_status',
    });
  }
}

export const db = new MedicalAppDatabase();

// Default local user ID when not authenticated with Supabase
export const LOCAL_USER_ID = 'local-practitioner-user';

/**
 * Helper to get current authenticated user or fallback local user
 */
export function getCurrentUserId(): string {
  try {
    const saved = localStorage.getItem('matapp_current_user') || localStorage.getItem('medagenda_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id) return parsed.id;
    }
  } catch (e) {
    console.warn('Erreur lecture utilisateur courant', e);
  }
  return LOCAL_USER_ID;
}

/**
 * Ajout ou modification instantanée d'un événement (0ms de latence)
 */
export async function saveLocalEvent(event: Omit<EventItem, 'sync_status' | 'updated_at' | 'is_deleted' | 'user_id' | 'id'> & { id?: string; user_id?: string }): Promise<EventItem> {
  const now = new Date().toISOString();
  const existing = event.id ? await db.events.get(event.id) : null;

  const eventToSave: EventItem = {
    id: event.id || crypto.randomUUID(),
    user_id: event.user_id || existing?.user_id || getCurrentUserId(),
    title: event.title.trim(),
    description: event.description || '',
    start_time: event.start_time,
    end_time: event.end_time,
    color: event.color,
    alarms: event.alarms || [],
    updated_at: now,
    is_deleted: false,
    sync_status: existing ? 'pending_update' : 'pending_create',
  };

  await db.events.put(eventToSave);
  return eventToSave;
}

/**
 * Suppression douce (soft-delete) d'un événement pour synchronisation
 */
export async function deleteLocalEvent(id: string): Promise<void> {
  const existing = await db.events.get(id);
  if (!existing) return;

  const now = new Date().toISOString();
  if (existing.sync_status === 'pending_create') {
    // S'il n'a jamais été synchronisé au serveur, suppression directe
    await db.events.delete(id);
  } else {
    // Marquer pour synchronisation de suppression
    await db.events.put({
      ...existing,
      is_deleted: true,
      updated_at: now,
      sync_status: 'pending_delete',
    });
  }
}

/**
 * Ajout ou modification instantanée d'une tâche To-Do
 */
export async function saveLocalTask(task: {
  id?: string;
  user_id?: string;
  title: string;
  color?: string;
  is_completed?: boolean;
  order_index?: number;
  alarm_time?: string | null;
}): Promise<TaskItem> {
  const now = new Date().toISOString();
  const existing = task.id ? await db.tasks.get(task.id) : null;

  let orderIndex = task.order_index;
  if (orderIndex === undefined) {
    if (existing) {
      orderIndex = existing.order_index;
    } else {
      const highest = await db.tasks.orderBy('order_index').last();
      orderIndex = highest ? highest.order_index + 1 : 0;
    }
  }

  const taskToSave: TaskItem = {
    id: task.id || crypto.randomUUID(),
    user_id: task.user_id || existing?.user_id || getCurrentUserId(),
    title: task.title.trim(),
    color: task.color || '#10B981',
    is_completed: task.is_completed ?? (existing ? existing.is_completed : false),
    order_index: orderIndex,
    alarm_time: task.alarm_time !== undefined ? task.alarm_time : (existing?.alarm_time || null),
    updated_at: now,
    is_deleted: false,
    sync_status: existing ? 'pending_update' : 'pending_create',
  };

  await db.tasks.put(taskToSave);
  return taskToSave;
}

/**
 * Basculer l'état complété d'une tâche avec micro-animation
 */
export async function toggleTaskCompletion(id: string): Promise<boolean> {
  const existing = await db.tasks.get(id);
  if (!existing) return false;

  const newStatus = !existing.is_completed;
  const now = new Date().toISOString();

  await db.tasks.put({
    ...existing,
    is_completed: newStatus,
    updated_at: now,
    sync_status: 'pending_update',
  });

  return newStatus;
}

/**
 * Suppression douce d'une tâche
 */
export async function deleteLocalTask(id: string): Promise<void> {
  const existing = await db.tasks.get(id);
  if (!existing) return;

  const now = new Date().toISOString();
  if (existing.sync_status === 'pending_create') {
    await db.tasks.delete(id);
  } else {
    await db.tasks.put({
      ...existing,
      is_deleted: true,
      updated_at: now,
      sync_status: 'pending_delete',
    });
  }
}

/**
 * Réorganiser les tâches
 */
export async function reorderTasks(tasks: TaskItem[]): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.tasks, async () => {
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (t.order_index !== i) {
        await db.tasks.update(t.id, {
          order_index: i,
          updated_at: now,
          sync_status: 'pending_update',
        });
      }
    }
  });
}

/**
 * Compter les modifications en attente de synchronisation
 */
export async function getPendingChangesCount(): Promise<number> {
  const pendingEvents = await db.events
    .where('sync_status')
    .anyOf('pending_create', 'pending_update', 'pending_delete')
    .count();

  const pendingTasks = await db.tasks
    .where('sync_status')
    .anyOf('pending_create', 'pending_update', 'pending_delete')
    .count();

  return pendingEvents + pendingTasks;
}

/**
 * Chaque compte commence avec un emploi du temps propre et vide
 */
export async function seedInitialMedicalDataIfEmpty(): Promise<void> {
  return;
}
