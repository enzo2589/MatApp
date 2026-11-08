import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getCurrentUserId } from './db/localDb';
import { syncEngine } from './services/syncEngine';
import { alarmService } from './services/alarmService';
import { getAuthUser, onAuthStateChange, signOutUser } from './services/supabaseClient';
import { AuthPage } from './components/Auth/AuthPage';
import { Header } from './components/Header';
import { CalendarView } from './components/Calendar/CalendarView';
import { PersistentTodoList } from './components/TodoList/PersistentTodoList';
import { MiniMonthPicker } from './components/Calendar/MiniMonthPicker';
import { CustomImageWidget } from './components/StudentWidget/CustomImageWidget';
import { SettingsModal } from './components/SettingsModal';
import { TimetableImportModal } from './components/TimetableImportModal';
import { purgeCorruptedGhostEvents } from './services/timetable/store';
import { AlarmBanner } from './components/AlarmBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarCheck, CalendarDays, CheckSquare, Sparkles, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { User } from '@supabase/supabase-js';

// Récupération instantanée de la session sauvegardée en local (aucun besoin de se reconnecter)
function getInitialAuth(): { state: 'authenticated' | 'unauthenticated' | 'loading'; user: User | null } {
  try {
    const saved =
      localStorage.getItem('matapp_user') ||
      localStorage.getItem('matapp_current_user') ||
      localStorage.getItem('medagenda_current_user');

    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id) {
        return { state: 'authenticated', user: parsed as User };
      }
    }
  } catch {}
  return { state: 'unauthenticated', user: null };
}

export function App() {
  const initialAuth = getInitialAuth();
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>(initialAuth.state);
  const [currentUser, setCurrentUser] = useState<User | null>(initialAuth.user);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isMobileTodoOpen, setIsMobileTodoOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'calendar' | 'sidebar' | 'todo'>('calendar');

  // Initialisation et vérification de la session en arrière-plan
  useEffect(() => {
    alarmService.startAlarmLoop();
    purgeCorruptedGhostEvents().catch(() => {});

    // Vérifier la session Supabase active en arrière-plan
    getAuthUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        setAuthState('authenticated');
        const userObj = { id: user.id, email: user.email };
        localStorage.setItem('matapp_user', JSON.stringify(userObj));
        localStorage.setItem('matapp_current_user', JSON.stringify(userObj));
        syncEngine.init();
      } else {
        const saved =
          localStorage.getItem('matapp_user') ||
          localStorage.getItem('matapp_current_user') ||
          localStorage.getItem('medagenda_current_user');

        if (!saved) {
          setAuthState('unauthenticated');
        } else {
          syncEngine.init();
        }
      }
    });

    // Écouter les changements d'authentification en direct (uniquement les connexions et rafraîchissements)
    const unsub = onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setAuthState('authenticated');
        const userObj = { id: session.user.id, email: session.user.email };
        localStorage.setItem('matapp_user', JSON.stringify(userObj));
        localStorage.setItem('matapp_current_user', JSON.stringify(userObj));
        syncEngine.setupRealtimeSubscription();
        syncEngine.triggerSync();
      }
      // Note : On n'écoute pas l'événement passif SIGNED_OUT généré automatiquement par Supabase au démarrage
      // La déconnexion est gérée de manière intentionnelle et explicite par la fonction handleSignOut()
    });

    return () => {
      alarmService.stopAlarmLoop();
      unsub();
    };
  }, []);

  // Décompte réactif des tâches non terminées pour le badge (strictement isolé par utilisateur)
  const currentUserId = currentUser?.id || getCurrentUserId();

  const pendingTasksCount = useLiveQuery(
    () => db.tasks.where('user_id').equals(currentUserId).filter((t) => !t.is_deleted && !t.is_completed).count(),
    [currentUserId]
  ) || 0;

  // Tous les événements pour les indicateurs de jours du MiniMonth (strictement isolé par utilisateur)
  const allEvents = useLiveQuery(
    () => db.events.where('user_id').equals(currentUserId).filter((e) => !e.is_deleted).toArray(),
    [currentUserId]
  );

  const handleAuthSuccess = async (user: User) => {
    setCurrentUser(user);
    setAuthState('authenticated');
    const userObj = { id: user.id, email: user.email };
    localStorage.setItem('matapp_user', JSON.stringify(userObj));
    localStorage.setItem('matapp_current_user', JSON.stringify(userObj));
    localStorage.setItem('medagenda_current_user', JSON.stringify(userObj));

    syncEngine.init();
    syncEngine.setupRealtimeSubscription();
    syncEngine.triggerSync();
  };

  const handleSignOut = async () => {
    await signOutUser();
    localStorage.removeItem('matapp_user');
    localStorage.removeItem('matapp_current_user');
    localStorage.removeItem('medagenda_current_user');
    setCurrentUser(null);
    setAuthState('unauthenticated');
  };

  // 1. Écran de chargement ultra-court
  if (authState === 'loading') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 select-none">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 animate-pulse mb-3">
          <Calendar className="w-6 h-6 stroke-[2.2]" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Chargement de MatApp...</p>
      </div>
    );
  }

  // 2. Écran de Connexion / Inscription sobre pour les étudiants
  if (authState === 'unauthenticated') {
    return <AuthPage onSuccess={handleAuthSuccess} />;
  }

  // 3. Application principale MatApp
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100/80 overflow-hidden font-sans">
      {/* Bannière d'Alarme Prioritaire Flottante */}
      <AlarmBanner />

      {/* En-tête Global avec État de Sync & Titre Étudiant */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTodoList={() => setIsMobileTodoOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        pendingTasksCount={pendingTasksCount}
        userEmail={currentUser?.email || null}
        onSignOut={handleSignOut}
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

      {/* Zone Principale Responsive */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* PANNEAU GAUCHE (Desktop / iPad) */}
        <aside
          className={clsx(
            'w-full md:w-[330px] lg:w-[360px] xl:w-[380px] h-full flex flex-col p-3 gap-3 overflow-y-auto bg-slate-100/90 border-r border-slate-200/90 shrink-0 select-none scrollbar-thin',
            mobileTab === 'calendar' ? 'hidden md:flex' : 'flex'
          )}
        >
          {/* Bloc 1 : "MOIS" */}
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

          {/* Bloc 2 : "IMAGE QUE JE CHOISIS" */}
          <div className={clsx(mobileTab === 'todo' ? 'hidden md:block' : 'block')}>
            <CustomImageWidget />
          </div>

          {/* Bloc 3 : "TO DO LIST" */}
          <div className={clsx('flex-1 min-h-[240px]', mobileTab === 'sidebar' ? 'hidden md:flex' : 'flex')}>
            <PersistentTodoList isCompactInSidebar={true} userId={currentUserId} />
          </div>
        </aside>

        {/* PANNEAU DROIT (Grand agenda interactif de la SEMAINE) */}
        <div
          className={clsx(
            'flex-1 h-full flex flex-col overflow-hidden',
            mobileTab !== 'calendar' ? 'hidden md:flex' : 'flex'
          )}
        >
          <CalendarView
            userId={currentUserId}
            currentDate={currentDate}
            onSelectDate={setCurrentDate}
            onOpenTodoList={() => setIsMobileTodoOpen(true)}
            onOpenImportModal={() => setIsImportModalOpen(true)}
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
                <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 shrink-0" />
                <div className="flex-1 overflow-hidden flex flex-col">
                  <PersistentTodoList onCloseMobileDrawer={() => setIsMobileTodoOpen(false)} userId={currentUserId} />
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
        onSignOut={handleSignOut}
      />

      {/* Modal Import Automatique Emploi du Temps Étudiant */}
      <TimetableImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(targetDate) => {
          setCurrentDate(targetDate);
          setMobileTab('calendar');
        }}
      />
    </div>
  );
}

export default App;
