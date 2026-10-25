import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveLocalEvent, deleteLocalEvent } from '../../db/localDb';
import { EventItem, CalendarViewMode } from '../../types';
import { WeekGrid } from './WeekGrid';
import { MonthGrid } from './MonthGrid';
import { QuickEventModal } from '../QuickEventModal';
import {
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  startOfWeek,
  eachDayOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarCheck,
  Calendar as CalendarIcon,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { clsx } from 'clsx';

interface CalendarViewProps {
  currentDate?: Date;
  onSelectDate?: (date: Date) => void;
  onOpenTodoList?: () => void;
  onOpenImportModal?: () => void;
  pendingTasksCount?: number;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  currentDate: externalDate,
  onSelectDate: externalOnSelectDate,
  onOpenTodoList,
  onOpenImportModal,
  pendingTasksCount = 0,
}) => {
  const [internalDate, setInternalDate] = useState<Date>(new Date());
  const currentDate = externalDate || internalDate;

  const handleUpdateDate = (newDate: Date) => {
    if (externalOnSelectDate) {
      externalOnSelectDate(newDate);
    } else {
      setInternalDate(newDate);
    }
  };

  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Modal d'événement rapide
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventData, setSelectedEventData] = useState<Partial<EventItem> | null>(null);

  // Live Query Dexie réactif instantané (0 ms)
  const events = useLiveQuery(
    () => db.events.filter((e) => !e.is_deleted).toArray(),
    []
  );

  // Calcul des jours affichés (toujours sur 7 jours exacts : Lundi à Dimanche)
  const displayedDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({
      start: weekStart,
      end: addDays(weekStart, 6),
    });
  }, [currentDate]);

  // Actions de navigation
  const handlePrev = () => {
    setSlideDirection('left');
    if (viewMode === 'month') {
      handleUpdateDate(subMonths(currentDate, 1));
    } else {
      handleUpdateDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    setSlideDirection('right');
    if (viewMode === 'month') {
      handleUpdateDate(addMonths(currentDate, 1));
    } else {
      handleUpdateDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setSlideDirection(today > currentDate ? 'right' : 'left');
    handleUpdateDate(today);
  };

  // Support des Gestes Tactiles de Swipe (use-gesture)
  const bindGesture = useDrag(
    ({ swipe: [swipeX], movement: [mx], cancel }) => {
      if (Math.abs(mx) > 60 || swipeX !== 0) {
        if (mx < -50 || swipeX === -1) {
          handleNext();
        } else if (mx > 50 || swipeX === 1) {
          handlePrev();
        }
        cancel();
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      rubberband: true,
    }
  );

  // Gestion de la sélection de créneau
  const handleSelectSlot = (start: Date, end: Date) => {
    setSelectedEventData({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      color: 'cours',
      alarms: [15],
    });
    setIsModalOpen(true);
  };

  const handleSelectEvent = (event: EventItem) => {
    setSelectedEventData(event);
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (eventData: Partial<EventItem>) => {
    await saveLocalEvent(eventData as any);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteLocalEvent(id);
  };

  const formattedMonthYear = format(currentDate, 'MMMM yyyy', { locale: fr });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative select-none">
      {/* Barre de navigation supérieure de l'Agenda (style Apple) */}
      <div className="bg-white border-b border-slate-200/80 px-3 md:px-5 py-2.5 flex items-center justify-between gap-2 shadow-2xs z-20">
        {/* Date courante & navigation rapide */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200/80">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-colors active:scale-95"
              title="Précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition-colors"
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition-colors active:scale-95"
              title="Suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-sm md:text-base font-extrabold text-slate-900 capitalize tracking-tight ml-1">
            {formattedMonthYear}
          </h2>
        </div>

        {/* Contrôles de Vue (Semaine / Mois) + Boutons d'Action */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                viewMode === 'week'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Semaine
            </button>

            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all',
                viewMode === 'month'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Mois
            </button>
          </div>

          {/* Bouton To-Do mobile */}
          {onOpenTodoList && (
            <button
              type="button"
              onClick={onOpenTodoList}
              className="md:hidden flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors relative"
              title="To-Do List"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tâches</span>
              {pendingTasksCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                  {pendingTasksCount}
                </span>
              )}
            </button>
          )}

          {/* Bouton Import Emploi du Temps */}
          {onOpenImportModal && (
            <button
              type="button"
              onClick={onOpenImportModal}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-95 text-xs font-bold rounded-xl border border-indigo-200 transition-all"
              title="Importer un emploi du temps PDF ou ADE Campus"
            >
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Importer Planning</span>
            </button>
          )}

          {/* Bouton Nouvel Événement Rapide */}
          <button
            type="button"
            onClick={() => {
              setSelectedEventData(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Création Éclair</span>
          </button>
        </div>
      </div>

      {/* Conteneur avec transition tactile de glissement (Swipe Gesture) */}
      <div {...(bindGesture() as any)} className="flex-1 overflow-hidden relative touch-pan-y">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${viewMode}_${currentDate.toISOString().slice(0, 10)}`}
            initial={{ opacity: 0, x: slideDirection === 'right' ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideDirection === 'right' ? -30 : 30 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full flex flex-col"
          >
            {viewMode === 'month' ? (
              <MonthGrid
                currentDate={currentDate}
                events={events || []}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
              />
            ) : (
              <WeekGrid
                days={displayedDays}
                events={events || []}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modal d'édition/création d'événement rapide */}
      <QuickEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedEventData}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
};
