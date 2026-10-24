import { db, getCurrentUserId } from '../db/localDb';
import { getSupabaseClient } from './supabaseClient';
import { EventItem, TaskItem, SyncEngineStatus } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

type StatusListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private statusListeners: Set<StatusListener> = new Set();
  private isSyncing = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastSyncedAt: Date | null = null;
  private pendingCount = 0;
  private lastError: string | null = null;
  private syncTimer: number | null = null;
  private realtimeChannel: RealtimeChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyStatus();
        this.triggerSync();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyStatus();
      });

      // Synchronisation périodique toutes les 30 secondes en tâche de fond
      setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.triggerSync();
        }
      }, 30000);
    }
  }

  public init() {
    this.refreshPendingCount();
    this.setupRealtimeSubscription();
    // Lancer une première sync après démarrage
    setTimeout(() => {
      this.triggerSync();
    }, 1500);
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public getStatus(): SyncEngineStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      errorMessage: this.lastError,
    };
  }

  private notifyStatus() {
    const status = this.getStatus();
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('Erreur dans un listener de sync:', err);
      }
    });
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const pendingEvents = await db.events
        .where('sync_status')
        .anyOf('pending_create', 'pending_update', 'pending_delete')
        .count();

      const pendingTasks = await db.tasks
        .where('sync_status')
        .anyOf('pending_create', 'pending_update', 'pending_delete')
        .count();

      this.pendingCount = pendingEvents + pendingTasks;
      this.notifyStatus();
      return this.pendingCount;
    } catch {
      return 0;
    }
  }

  /**
   * Déclenche un cycle de synchronisation complet (Push des pending puis Pull des nouveautés)
   */
  public async triggerSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      await this.refreshPendingCount();
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      // Supabase non configuré : l'application fonctionne parfaitement en mode Local-First isolé
      await this.refreshPendingCount();
      return;
    }

    const userId = getCurrentUserId();
    if (!userId || userId === 'local-practitioner-user') {
      // Utilisateur invité en local, pas de compte distant pour push
      await this.refreshPendingCount();
      return;
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifyStatus();

    try {
      // 1. PUSH : Envoi des modifications locales en attente vers Supabase
      await this.pushLocalEventsToRemote(client, userId);
      await this.pushLocalTasksToRemote(client, userId);

      // 2. PULL : Récupération des nouveautés distantes depuis Supabase
      await this.pullRemoteEvents(client, userId);
      await this.pullRemoteTasks(client, userId);

      this.lastSyncedAt = new Date();
      await this.refreshPendingCount();
    } catch (error: any) {
      console.warn('Erreur lors du cycle de synchronisation:', error);
      this.lastError = error.message || 'Erreur de synchronisation réseau';
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }
  }

  /**
   * PUSH Events
   */
  private async pushLocalEventsToRemote(client: any, userId: string) {
    const pendingEvents = await db.events
      .where('sync_status')
      .anyOf('pending_create', 'pending_update', 'pending_delete')
      .toArray();

    for (const evt of pendingEvents) {
      try {
        if (evt.sync_status === 'pending_delete' || evt.is_deleted) {
          // Soft delete sur Supabase
          const { error } = await client
            .from('events')
            .update({
              is_deleted: true,
              updated_at: evt.updated_at,
            })
            .eq('id', evt.id)
            .eq('user_id', userId);

          if (!error) {
            // Nettoyage local définitif une fois supprimé distant
            await db.events.delete(evt.id);
          }
        } else {
          // Upsert dans Supabase
          const { error } = await client.from('events').upsert({
            id: evt.id,
            user_id: userId,
            title: evt.title,
            description: evt.description,
            start_time: evt.start_time,
            end_time: evt.end_time,
            color: evt.color,
            alarms: evt.alarms,
            updated_at: evt.updated_at,
            is_deleted: false,
          });

          if (!error) {
            await db.events.update(evt.id, { sync_status: 'synced' });
          }
        }
      } catch (e) {
        console.warn('Échec envoi event:', evt.id, e);
      }
    }
  }

  /**
   * PUSH Tasks
   */
  private async pushLocalTasksToRemote(client: any, userId: string) {
    const pendingTasks = await db.tasks
      .where('sync_status')
      .anyOf('pending_create', 'pending_update', 'pending_delete')
      .toArray();

    for (const t of pendingTasks) {
      try {
        if (t.sync_status === 'pending_delete' || t.is_deleted) {
          const { error } = await client
            .from('tasks')
            .update({
              is_deleted: true,
              updated_at: t.updated_at,
            })
            .eq('id', t.id)
            .eq('user_id', userId);

          if (!error) {
            await db.tasks.delete(t.id);
          }
        } else {
          const { error } = await client.from('tasks').upsert({
            id: t.id,
            user_id: userId,
            title: t.title,
            color: t.color,
            is_completed: t.is_completed,
            order_index: t.order_index,
            alarm_time: t.alarm_time,
            updated_at: t.updated_at,
            is_deleted: false,
          });

          if (!error) {
            await db.tasks.update(t.id, { sync_status: 'synced' });
          }
        }
      } catch (e) {
        console.warn('Échec envoi task:', t.id, e);
      }
    }
  }

  /**
   * PULL Events
   */
  private async pullRemoteEvents(client: any, userId: string) {
    const { data: remoteEvents, error } = await client
      .from('events')
      .select('*')
      .eq('user_id', userId);

    if (error || !remoteEvents) return;

    for (const remote of remoteEvents) {
      const local = await db.events.get(remote.id);

      if (!local) {
        if (!remote.is_deleted) {
          await db.events.put({
            ...remote,
            sync_status: 'synced',
          });
        }
      } else {
        // Résolution de conflit par Last-Write-Wins
        const remoteDate = new Date(remote.updated_at).getTime();
        const localDate = new Date(local.updated_at).getTime();

        if (remoteDate > localDate) {
          if (remote.is_deleted) {
            await db.events.delete(remote.id);
          } else {
            await db.events.put({
              ...remote,
              sync_status: 'synced',
            });
          }
        }
      }
    }
  }

  /**
   * PULL Tasks
   */
  private async pullRemoteTasks(client: any, userId: string) {
    const { data: remoteTasks, error } = await client
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (error || !remoteTasks) return;

    for (const remote of remoteTasks) {
      const local = await db.tasks.get(remote.id);

      if (!local) {
        if (!remote.is_deleted) {
          await db.tasks.put({
            ...remote,
            sync_status: 'synced',
          });
        }
      } else {
        const remoteDate = new Date(remote.updated_at).getTime();
        const localDate = new Date(local.updated_at).getTime();

        if (remoteDate > localDate) {
          if (remote.is_deleted) {
            await db.tasks.delete(remote.id);
          } else {
            await db.tasks.put({
              ...remote,
              sync_status: 'synced',
            });
          }
        }
      }
    }
  }

  /**
   * Abonnement Realtime Supabase pour synchronisation instantanée entre appareils
   */
  public setupRealtimeSubscription() {
    const client = getSupabaseClient();
    if (!client) return;

    if (this.realtimeChannel) {
      client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }

    try {
      this.realtimeChannel = client
        .channel('medagenda_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
          this.triggerSync();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          this.triggerSync();
        })
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription non disponible:', err);
    }
  }
}

export const syncEngine = new SyncEngine();
