import React, { useState, useEffect } from 'react';
import {
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
  Bell,
  CheckCircle,
  CalendarCheck,
  ShieldCheck,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { syncEngine } from '../services/syncEngine';
import { alarmService } from '../services/alarmService';
import { SyncEngineStatus } from '../types';
import { clsx } from 'clsx';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenTodoList: () => void;
  onOpenImportModal: () => void;
  pendingTasksCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenTodoList,
  onOpenImportModal,
  pendingTasksCount,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.getStatus());
  const [hasNotifPermission, setHasNotifPermission] = useState(alarmService.hasNotificationPermission());

  useEffect(() => {
    const unsub = syncEngine.subscribeStatus((status) => {
      setSyncStatus(status);
    });
    return unsub;
  }, []);

  const handleRequestNotif = async () => {
    const perm = await alarmService.requestNotificationPermission();
    setHasNotifPermission(perm === 'granted');
    if (perm === 'granted') {
      alarmService.playChime();
    }
  };

  const handleManualSync = () => {
    syncEngine.triggerSync();
  };

  return (
    <header className="bg-white border-b border-slate-200/90 px-3 md:px-6 py-2.5 flex items-center justify-between gap-3 select-none z-30 safe-top">
      {/* Logo & Titre */}
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

      {/* Barre d'état de synchronisation & Actions */}
      <div className="flex items-center gap-2">
        {/* Pastille de synchronisation Local-First */}
        <button
          type="button"
          onClick={handleManualSync}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95',
            syncStatus.isSyncing
              ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
              : !syncStatus.isOnline
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : syncStatus.pendingCount > 0
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          )}
          title="Cliquez pour forcer la synchronisation"
        >
          {syncStatus.isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span className="hidden sm:inline">Synchronisation...</span>
            </>
          ) : !syncStatus.isOnline ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hors-ligne (Local-First)</span>
            </>
          ) : syncStatus.pendingCount > 0 ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{syncStatus.pendingCount} en attente</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Synchronisé</span>
            </>
          )}
        </button>

        {/* Bouton d'importation d'emploi du temps médical */}
        <button
          type="button"
          onClick={onOpenImportModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 border border-indigo-200/90 shadow-2xs active:scale-95 transition-all"
          title="Importer un planning universitaire (PDF, ADE, PASS Lille)"
        >
          <GraduationCap className="w-4 h-4 text-indigo-600 stroke-[2.2]" />
          <span className="hidden sm:inline">Importer Planning</span>
          <span className="inline sm:hidden">Planning</span>
          <span className="hidden md:inline-flex px-1.5 py-0.2 rounded-full bg-indigo-200/60 text-indigo-800 text-[10px]">
            S43
          </span>
        </button>

        {/* Bouton Permission Notifications */}
        {!hasNotifPermission && (
          <button
            type="button"
            onClick={handleRequestNotif}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-xl transition-colors"
            title="Activer les notifications système"
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>Activer Rappels</span>
          </button>
        )}

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
