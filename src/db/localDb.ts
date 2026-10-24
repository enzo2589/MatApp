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
    const saved = localStorage.getItem('medagenda_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id) return parsed.id;
    }
  } catch (e) {
    console.warn('Erreur lecture medagenda_current_user', e);
  }
  return LOCAL_USER_ID;
}

/**
 * Ajout ou modification instantanée d'un événement (0ms de latence)
 */
export async function saveLocalEvent(event: Omit<EventItem, 'sync_status' | 'updated_at' | 'is_deleted'> & { id?: string }): Promise<EventItem> {
  const now = new Date().toISOString();
  const existing = event.id ? await db.events.get(event.id) : null;

  const eventToSave: EventItem = {
    id: event.id || crypto.randomUUID(),
    user_id: event.user_id || getCurrentUserId(),
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
    user_id: task.user_id || getCurrentUserId(),
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
 * Initialisation de données médicales réalistes de démonstration si la base est vide
 */
export async function seedInitialMedicalDataIfEmpty(): Promise<void> {
  const eventsCount = await db.events.count();
  const tasksCount = await db.tasks.count();

  if (eventsCount > 0 || tasksCount > 0) return;

  const userId = getCurrentUserId();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Lundi

  // Événements d'exemple pour une semaine type d'un étudiant en médecine
  const sampleEvents: EventItem[] = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Stage Hospitalier : Visite en Médecine Interne',
      description: 'Présentation des dossiers patients et observations cliniques avec l’interne.',
      start_time: setMinutes(setHours(addDays(weekStart, 0), 8), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 0), 12), 30).toISOString(),
      color: 'stage',
      alarms: [15],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Pause Déj Carabin & Café',
      description: 'Déjeuner avec la promo au resto U.',
      start_time: setMinutes(setHours(addDays(weekStart, 0), 12), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 0), 13), 30).toISOString(),
      color: 'pause',
      alarms: [],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Cours Magistral : Pharmacologie & Infectio',
      description: 'Amphi Pasteur - Antibiothérapie et résistances.',
      start_time: setMinutes(setHours(addDays(weekStart, 0), 13), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 0), 16), 30).toISOString(),
      color: 'cours',
      alarms: [15],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'BU Santé : Fiches EDN & Anki Quotidien',
      description: 'Items 228 (Syndrome coronarien) et 150 cartes Anki.',
      start_time: setMinutes(setHours(addDays(weekStart, 0), 17), 0).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 0), 19), 30).toISOString(),
      color: 'bu',
      alarms: [10],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Stage Chirurgie : Aide au Bloc Opératoire',
      description: 'Lavage des mains chirurgical, cœlioscopie digestive.',
      start_time: setMinutes(setHours(addDays(weekStart, 1), 8), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 1), 12), 30).toISOString(),
      color: 'stage',
      alarms: [15],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Tutorat & ED : Anatomie du Rachis',
      description: 'Salle TD 4 - Schémas et coupes scanner.',
      start_time: setMinutes(setHours(addDays(weekStart, 1), 14), 0).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 1), 16), 30).toISOString(),
      color: 'tutorat',
      alarms: [10],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Sport & Running Décompression',
      description: 'Parc ou salle de sport pour évacuer le stress des cours.',
      start_time: setMinutes(setHours(addDays(weekStart, 1), 17), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 1), 19), 0).toISOString(),
      color: 'sport',
      alarms: [],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Cours Magistral : Neurologie Clinique',
      description: 'Amphi B - AVC, céphalées et examen neurologique.',
      start_time: setMinutes(setHours(addDays(weekStart, 2), 9), 0).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 2), 12), 0).toISOString(),
      color: 'cours',
      alarms: [15],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Session Révisions EDN & QCM en binôme',
      description: 'Dossiers progressifs et annales de cardiologie.',
      start_time: setMinutes(setHours(addDays(weekStart, 2), 13), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 2), 17), 0).toISOString(),
      color: 'revisions',
      alarms: [10],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Stage Hospitalier : Accueil Urgences Externe',
      description: 'Tri des patients, ECG d’accueil et sutures simples.',
      start_time: setMinutes(setHours(addDays(weekStart, 3), 8), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 3), 13), 0).toISOString(),
      color: 'stage',
      alarms: [15],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'BU Santé : Focus Pathologies Respiratoires',
      description: 'Collège de Pneumologie et spirométrie.',
      start_time: setMinutes(setHours(addDays(weekStart, 3), 14), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 3), 18), 0).toISOString(),
      color: 'bu',
      alarms: [10],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Soirée Carabin / Pause Potes',
      description: 'Dîner et déconnexion complète des cours !',
      start_time: setMinutes(setHours(addDays(weekStart, 3), 19), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 3), 23), 0).toISOString(),
      color: 'pause',
      alarms: [],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Concours Blanc / Partiels d’entraînement',
      description: 'Épreuve de 3h en conditions réelles avec QCM et dossiers.',
      start_time: setMinutes(setHours(addDays(weekStart, 4), 9), 0).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 4), 12), 0).toISOString(),
      color: 'examen',
      alarms: [30],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Sieste & Repos Récupérateur',
      description: 'Recharger les batteries après la semaine intense.',
      start_time: setMinutes(setHours(addDays(weekStart, 4), 15), 0).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 4), 17), 0).toISOString(),
      color: 'repos',
      alarms: [],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Flashcards Anki & Fiches Synthèses',
      description: 'Révision espacée des cours de la semaine.',
      start_time: setMinutes(setHours(addDays(weekStart, 5), 14), 0).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 5), 17), 0).toISOString(),
      color: 'revisions',
      alarms: [10],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Grasse Matinée & Repos Total',
      description: 'Dormir sans réveil pour attaquer la semaine en forme.',
      start_time: setMinutes(setHours(addDays(weekStart, 6), 9), 30).toISOString(),
      end_time: setMinutes(setHours(addDays(weekStart, 6), 12), 30).toISOString(),
      color: 'repos',
      alarms: [],
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
  ];

  // Tâches To-Do médicales persistantes pour étudiants
  const sampleTasks: TaskItem[] = [
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Valider 150 cartes Anki du jour (Cardio & Infectio)',
      color: '#10B981',
      is_completed: false,
      order_index: 0,
      alarm_time: null,
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Faire signer le carnet de stage par le chef de clinique',
      color: '#06B6D4',
      is_completed: false,
      order_index: 1,
      alarm_time: null,
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Télécharger le polycopié d’Anatomie pour l’ED de mardi',
      color: '#4F46E5',
      is_completed: false,
      order_index: 2,
      alarm_time: null,
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Réserver une table de travail à la BU Santé',
      color: '#F59E0B',
      is_completed: false,
      order_index: 3,
      alarm_time: null,
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
    {
      id: crypto.randomUUID(),
      user_id: userId,
      title: 'Acheter un carnet de poche pour noter les constantes au lit du patient',
      color: '#84CC16',
      is_completed: true,
      order_index: 4,
      alarm_time: null,
      updated_at: now.toISOString(),
      is_deleted: false,
      sync_status: 'pending_create',
    },
  ];

  await db.events.bulkPut(sampleEvents);
  await db.tasks.bulkPut(sampleTasks);
}
