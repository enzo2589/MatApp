import { db } from '../db/localDb';
import { EventItem, TaskItem } from '../types';
import { differenceInMinutes, parseISO, isAfter, isBefore, addMinutes } from 'date-fns';

export interface ActiveAlarm {
  id: string;
  itemId: string;
  itemType: 'event' | 'task';
  title: string;
  subtitle: string;
  timeString: string;
  color: string;
  timestamp: string;
}

type AlarmCallback = (alarm: ActiveAlarm) => void;

class AlarmService {
  private triggeredAlarms = new Set<string>();
  private listeners = new Set<AlarmCallback>();
  private checkInterval: number | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Démarrage de la vérification toutes les 15 secondes
      this.startAlarmLoop();
    }
  }

  public subscribe(cb: AlarmCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(alarm: ActiveAlarm) {
    this.playChime();
    this.showSystemNotification(alarm);
    this.listeners.forEach((cb) => {
      try {
        cb(alarm);
      } catch (e) {
        console.error('Erreur callback alarme:', e);
      }
    });
  }

  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch {
      return 'denied';
    }
  }

  public hasNotificationPermission(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
  }

  private showSystemNotification(alarm: ActiveAlarm) {
    if (this.hasNotificationPermission()) {
      try {
        const notif = new Notification(alarm.title, {
          body: `${alarm.subtitle} - ${alarm.timeString}`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: alarm.id,
          requireInteraction: true,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.warn('Erreur affichage notification système:', err);
      }
    }
  }

  /**
   * Synthèse sonore d'une double tonalité douce et claire (Web Audio API 100% hors-ligne)
   */
  public playChime() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Premier bip (La 880Hz)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Second bip harmonieux (Do# 1108Hz)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1108.73, now + 0.18);
      gain2.gain.setValueAtTime(0, now + 0.18);
      gain2.gain.linearRampToValueAtTime(0.35, now + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('AudioContext non accessible:', e);
    }
  }

  public startAlarmLoop() {
    if (this.checkInterval) return;

    // Première passe immédiate
    this.checkAlarms();

    this.checkInterval = window.setInterval(() => {
      this.checkAlarms();
    }, 15000); // 15 secondes
  }

  public stopAlarmLoop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Vérification de toutes les alarmes échues
   */
  public async checkAlarms() {
    try {
      const now = new Date();

      // 1. Événements de l'agenda
      const events = await db.events.filter((e) => !e.is_deleted).toArray();

      for (const event of events) {
        if (!event.alarms || event.alarms.length === 0) continue;

        const startTime = parseISO(event.start_time);

        for (const minutesBefore of event.alarms) {
          const alarmTriggerTime = addMinutes(startTime, -minutesBefore);
          const key = `event_${event.id}_${minutesBefore}`;

          // Vérifier si l'alarme doit sonner (dans une fenêtre de 3 minutes max après son heure et non encore sonnée)
          const diffMinutes = (now.getTime() - alarmTriggerTime.getTime()) / (60 * 1000);

          if (diffMinutes >= 0 && diffMinutes <= 3.5) {
            if (!this.triggeredAlarms.has(key)) {
              this.triggeredAlarms.add(key);

              const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
              const subtitle = minutesBefore === 0
                ? "C'est l'heure !"
                : `Débute dans ${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`;

              this.notify({
                id: key,
                itemId: event.id,
                itemType: 'event',
                title: `📅 ${event.title}`,
                subtitle,
                timeString: `Prévu à ${timeStr}`,
                color: event.color,
                timestamp: now.toISOString(),
              });
            }
          }
        }
      }

      // 2. Tâches To-Do avec rappel
      const tasks = await db.tasks.filter((t) => !t.is_deleted && !t.is_completed && !!t.alarm_time).toArray();

      for (const task of tasks) {
        if (!task.alarm_time) continue;

        const alarmTime = parseISO(task.alarm_time);
        const key = `task_${task.id}_${task.alarm_time}`;

        const diffMinutes = (now.getTime() - alarmTime.getTime()) / (60 * 1000);

        if (diffMinutes >= 0 && diffMinutes <= 3.5) {
          if (!this.triggeredAlarms.has(key)) {
            this.triggeredAlarms.add(key);

            this.notify({
              id: key,
              itemId: task.id,
              itemType: 'task',
              title: `✅ Rappel Tâche : ${task.title}`,
              subtitle: 'Échéance atteinte',
              timeString: 'À faire maintenant',
              color: task.color,
              timestamp: now.toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('Erreur vérification des alarmes:', err);
    }
  }

  /**
   * Répéter une alarme (Snooze) de X minutes
   */
  public snoozeAlarm(alarm: ActiveAlarm, minutes: number = 5) {
    const key = `${alarm.id}_snooze_${Date.now()}`;
    const triggerAt = Date.now() + minutes * 60 * 1000;

    setTimeout(() => {
      this.notify({
        ...alarm,
        id: key,
        subtitle: `Rappel reporté (+${minutes} min)`,
      });
    }, minutes * 60 * 1000);
  }
}

export const alarmService = new AlarmService();
