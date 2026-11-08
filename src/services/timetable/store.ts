import { EventItem } from '../../types';
import { db, getCurrentUserId } from '../../db/localDb';
import { syncEngine } from '../syncEngine';
import { parseISO, addDays, startOfWeek } from 'date-fns';
import { ParsedCourseEvent } from './types';

/**
 * Convertit n'importe quelle chaîne en UUID v4 déterministe pour Supabase
 */
export function stringToUuid(str: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x811c9dc5, h4 = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  const hex = [
    (h1 >>> 0).toString(16).padStart(8, '0'),
    (h2 >>> 0).toString(16).padStart(8, '0'),
    (h3 >>> 0).toString(16).padStart(8, '0'),
    (h4 >>> 0).toString(16).padStart(8, '0'),
  ].join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Nettoie les doublons stricts pour l'utilisateur actuel
 */
export async function cleanUserDuplicateEvents(): Promise<number> {
  const userId = getCurrentUserId();
  const userEvents = await db.events.where('user_id').equals(userId).toArray();
  const seenKeys = new Set<string>();
  const toDeleteIds: string[] = [];

  for (const ev of userEvents) {
    if (ev.is_deleted) continue;
    const dateKey = ev.start_time ? ev.start_time.slice(0, 16) : '';
    const normTitle = ev.title.trim().toLowerCase();
    const key = `${dateKey}_${normTitle}`;

    if (seenKeys.has(key)) {
      toDeleteIds.push(ev.id);
    } else {
      seenKeys.add(key);
    }
  }

  if (toDeleteIds.length > 0) {
    await db.events.bulkDelete(toDeleteIds);
  }

  return toDeleteIds.length;
}

/**
 * Enregistre les cours importés dans IndexedDB et synchronise vers Supabase
 * Remplace uniquement les anciens cours de cette semaine pour CET utilisateur
 */
export async function saveCoursesToDatabase(
  courses: ParsedCourseEvent[],
  cleanExistingWeek: boolean = true
): Promise<number> {
  const userId = getCurrentUserId();
  const now = new Date().toISOString();

  // 1. Si demandé, supprimer les anciens cours de cet utilisateur sur cette semaine
  if (cleanExistingWeek && courses.length > 0) {
    const allStartTimes = courses.map((c) => parseISO(c.startTime).getTime());
    const minTime = Math.min(...allStartTimes);
    const weekStart = startOfWeek(new Date(minTime), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);

    const userEvents = await db.events.where('user_id').equals(userId).toArray();
    const toDeleteIds: string[] = [];

    for (const ev of userEvents) {
      try {
        const evTime = parseISO(ev.start_time).getTime();
        if (evTime >= weekStart.getTime() && evTime < weekEnd.getTime()) {
          toDeleteIds.push(ev.id);
        }
      } catch {}
    }

    if (toDeleteIds.length > 0) {
      await db.events.bulkDelete(toDeleteIds);
    }
  }

  // 2. Nettoyage des éventuels doublons stricts
  await cleanUserDuplicateEvents();

  // 3. Transformation en EventItem avec UUID déterministe
  const eventsToInsert: EventItem[] = courses.map((c) => {
    const safeTitleSlug = c.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20).toLowerCase();
    const rawId = c.id || `pass-${c.startTime.slice(0, 13)}-${safeTitleSlug}`;
    const deterministicUuid = stringToUuid(`${userId}-${rawId}`);

    return {
      id: deterministicUuid,
      user_id: userId,
      title: c.title,
      description: [c.subject, c.professor, c.room].filter(Boolean).join(' • '),
      start_time: c.startTime,
      end_time: c.endTime,
      color: c.color || 'cours',
      alarms: [15],
      updated_at: now,
      is_deleted: false,
      sync_status: 'pending_create',
    };
  });

  await db.events.bulkPut(eventsToInsert);

  // Synchronisation automatique vers Supabase
  try {
    syncEngine.triggerSync();
  } catch {}

  return eventsToInsert.length;
}
