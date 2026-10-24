import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedInitialMedicalDataIfEmpty } from './db/localDb';
import { syncEngine } from './services/syncEngine';
import { alarmService } from './services/alarmService';
import { Header } from './components/Header';
import { CalendarView } from './components/Calendar/CalendarView';
import { PersistentTodoList } from './components/TodoList/PersistentTodoList';
import { MiniMonthPicker } from './components/Calendar/MiniMonthPicker';
import { CustomImageWidget } from './components/StudentWidget/CustomImageWidget';
import { SettingsModal } from './components/SettingsModal';
import { AlarmBanner } from './components/AlarmBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, CalendarDays, CheckSquare, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

export function App() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileTodoOpen, setIsMobileTodoOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'calendar' | 'sidebar' | 'todo'>('calendar');

  // Initialisation au premier chargement
  useEffect(() => {
    seedInitialMedicalDataIfEmpty();
    syncEngine.init();
    alarmService.startAlarmLoop();

    return () => {
      alarmService.stopAlarmLoop();
    };
  }, []);

  // Décompte réactif des tâches non terminées pour le badge
  const pendingTasksCount = useLiveQuery(
    () => db.tasks.filter((t) => !t.is_deleted && !t.is_completed).count(),
    []
  ) || 0;

  // Tous les événements pour les indicateurs de jours du MiniMonth
  const allEvents = useLiveQuery(
    () => db.events.filter((e) => !e.is_deleted).toArray(),
    []
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100/80 overflow-hidden font-sans">
      {/* Bannière d'Alarme Prioritaire Flottante */}
      <AlarmBanner />

      {/* En-tête Global avec État de Sync & Titre Étudiant */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTodoList={() => setIsMobileTodoOpen(true)}
        pendingTasksCount={pendingTasksCount}
      />

      {/* Barre d'onglets mobile (sur iPhone / petits écrans) */}
      <div className="md:hidden flex border-b border-slate-200 bg-white px-2 py-1 gap-1">
        <button
          type="button"
          onClick={() => setMobileTab('calendar')}
          className={clsx(
            'flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
            mobileTab === 'calendar'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Semaine</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('sidebar')}
          className={clsx(
            'flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
            mobileTab === 'sidebar'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Mois & Widget</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('todo')}
          className={clsx(
            'flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative',
            mobileTab === 'todo'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>To Do List</span>
          {pendingTasksCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {pendingTasksCount}
            </span>
          )}
        </button>
      </div>

      {/* Zone Principale Responsive (conforme au croquis de l'utilisateur !) */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* =========================================================================
            PANNEAU GAUCHE (Desktop / iPad : colonne permanente de 350px)
            Contient exactement les 3 blocs du dessin :
            1. "MOIS" (MiniMonthPicker avec cercle rose)
            2. "IMAGE QUE JE CHOISIS" (CustomImageWidget)
            3. "TO DO LIST" (PersistentTodoList)
           ========================================================================= */}
        <aside
          className={clsx(
            'w-full md:w-[330px] lg:w-[360px] xl:w-[380px] h-full flex flex-col p-3 gap-3 overflow-y-auto bg-slate-100/90 border-r border-slate-200/90 shrink-0 select-none scrollbar-thin',
            // Sur mobile : visible uniquement si tab 'sidebar' ou 'todo'
            mobileTab === 'calendar' ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* Bloc 1 : "MOIS" (Croquis haut gauche) */}
          {(mobileTab === 'sidebar' || typeof window === 'undefined' || true) && (
            <div className={clsx(mobileTab === 'todo' ? 'hidden md:block' : 'block')}>
              <MiniMonthPicker
                currentDate={currentDate}
                onSelectDate={(newDate) => {
                  setCurrentDate(newDate);
                  setMobileTab('calendar');
                }}
                events={allEvents || []}
              />
            </div>
          )}

          {/* Bloc 2 : "IMAGE QUE JE CHOISIS" (Croquis milieu gauche) */}
          <div className={clsx(mobileTab === 'todo' ? 'hidden md:block' : 'block')}>
            <CustomImageWidget />
          </div>

          {/* Bloc 3 : "TO DO LIST" (Croquis bas gauche) */}
          <div className={clsx('flex-1 min-h-[240px]', mobileTab === 'sidebar' ? 'hidden md:flex' : 'flex')}>
            <PersistentTodoList isCompactInSidebar={true} />
          </div>
        </aside>

        {/* =========================================================================
            PANNEAU DROIT (Grand agenda interactif de la "SEMAINE")
            Prend 70% ou tout le reste de l'écran, avec timeline horaire 1h, 2h...
            et colonnes L M M J V S D
           ========================================================================= */}
        <div
          className={clsx(
            'flex-1 h-full flex flex-col overflow-hidden',
            mobileTab !== 'calendar' ? 'hidden md:flex' : 'flex'
          )}
        >
          <CalendarView
            currentDate={currentDate}
            onSelectDate={setCurrentDate}
            onOpenTodoList={() => setIsMobileTodoOpen(true)}
            pendingTasksCount={pendingTasksCount}
          />
        </div>

        {/* Bouton Flottant Accessible au Pouce sur iPhone */}
        <div className="md:hidden fixed bottom-5 right-5 z-40 safe-bottom">
          <button
            type="button"
            onClick={() => setIsMobileTodoOpen(true)}
            className="w-13 h-13 rounded-full bg-indigo-600 text-white shadow-apple-active flex items-center justify-center hover:bg-indigo-700 active:scale-90 transition-all relative"
            title="Ouvrir la To-Do List"
          >
            <CalendarCheck className="w-6 h-6" />
            {pendingTasksCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white">
                {pendingTasksCount}
              </span>
            )}
          </button>
        </div>

        {/* Tiroir Coulissant / Bottom Sheet Rapide sur iPhone */}
        <AnimatePresence>
          {isMobileTodoOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileTodoOpen(false)}
                className="flex-1"
              />

              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="h-[80vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t border-slate-200 safe-bottom"
              >
                {/* Poignée tactile de fermeture */}
                <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 shrink-0" />
                <div className="flex-1 overflow-hidden flex flex-col">
                  <PersistentTodoList onCloseMobileDrawer={() => setIsMobileTodoOpen(false)} />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal Paramètres & Synchronisation Cloud */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
