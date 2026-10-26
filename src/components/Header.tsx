import React, { useState } from 'react';
import {
  Activity,
  Settings,
  Bell,
  CalendarCheck,
  CheckCircle2,
} from 'lucide-react';
import { alarmService } from '../services/alarmService';
import { clsx } from 'clsx';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenTodoList: () => void;
  onOpenImportModal?: () => void;
  pendingTasksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenTodoList,
  pendingTasksCount,
}) => {
  const [hasNotifPermission, setHasNotifPermission] = useState(alarmService.hasNotificationPermission());
  const [justTested, setJustTested] = useState(false);

  // Activation & Test immédiat des Rappels avec retour sonore et visuel 0ms
  const handleToggleOrTestNotif = async () => {
    // 1. Toujours jouer le carillon immédiatement pour un retour sonore tangible
    alarmService.playChime();
    setJustTested(true);
    setTimeout(() => setJustTested(false), 2000);

    // 2. Vérifier ou demander la permission système
    try {
      const perm = await alarmService.requestNotificationPermission();
      const granted = perm === 'granted';
      setHasNotifPermission(granted);

      if (granted) {
        // Envoi d'une notification système de confirmation immédiate
        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            new Notification('🔔 Rappels MedAgenda Activés', {
              body: 'Vos alertes de cours, révisions et alarmes sonores sont prêtes !',
              icon: '/favicon.svg',
            });
          } catch {}
        }
      } else if (perm === 'denied') {
        // Notification bloquée par le navigateur : guider l'utilisateur
        alert(
          "ℹ️ Les notifications système sont bloquées par votre navigateur.\n\n" +
          "Pour les autoriser :\n" +
          "1. Cliquez sur l'icône de cadenas 🔒 ou de paramètres à gauche de l'URL.\n" +
          "2. Basculez « Notifications » sur Autoriser.\n\n" +
          "Note : Vos alarmes sonores et bannières visuelles dans l'application restent 100% actives !"
        );
      }
    } catch (err) {
      console.warn('Erreur lors de la demande de notifications:', err);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200/90 px-3 md:px-6 py-2.5 flex items-center justify-between gap-3 select-none z-30 safe-top">
      {/* Logo & Titre Études Santé */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
          <Activity className="w-5 h-5 stroke-[2.5]" />
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              MedAgenda
            </h1>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
              Études Santé
            </span>
          </div>
          <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
            Emploi du Temps Étudiant en Médecine • Cours, Révisions, Stages & Repos
          </p>
        </div>
      </div>

      {/* Actions de l'En-tête */}
      <div className="flex items-center gap-2">
        {/* Bouton de Rappels & Notifications (Réparé & Interactif) */}
        <button
          type="button"
          onClick={handleToggleOrTestNotif}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-2xs border',
            justTested
              ? 'bg-indigo-100 text-indigo-700 border-indigo-300 scale-98'
              : hasNotifPermission
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 animate-pulse'
          )}
          title={
            hasNotifPermission
              ? 'Rappels activés (cliquez pour tester le son et la notification)'
              : 'Cliquez pour activer les rappels sonores et système'
          }
        >
          {justTested ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Test Chime OK !</span>
            </>
          ) : hasNotifPermission ? (
            <>
              <Bell className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span className="hidden sm:inline">Rappels Actifs</span>
              <span className="inline sm:hidden">Rappels</span>
            </>
          ) : (
            <>
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>Activer Rappels</span>
            </>
          )}
        </button>

        {/* Bouton Mobile : Ouvrir la To-Do List */}
        <button
          type="button"
          onClick={onOpenTodoList}
          className="md:hidden relative p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center"
          title="Ouvrir la To-Do List"
        >
          <CalendarCheck className="w-5 h-5 text-indigo-600" />
          {pendingTasksCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
              {pendingTasksCount}
            </span>
          )}
        </button>

        {/* Bouton Paramètres & Compte */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          title="Paramètres & Compte"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
