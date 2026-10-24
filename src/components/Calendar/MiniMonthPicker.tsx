import React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { EventItem } from '../../types';

interface MiniMonthPickerProps {
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  events?: EventItem[];
}

export const MiniMonthPicker: React.FC<MiniMonthPickerProps> = ({
  currentDate,
  onSelectDate,
  events = [],
}) => {
  const [viewMonth, setViewMonth] = React.useState<Date>(currentDate);

  // Synchroniser le mois affiché si la date sélectionnée change
  React.useEffect(() => {
    setViewMonth(currentDate);
  }, [currentDate]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lundi
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  // Semaine courante sélectionnée (pour surligner la ligne de la semaine active)
  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Map des dates qui ont des événements
  const eventDaysSet = React.useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (!e.is_deleted) {
        const dStr = e.start_time.slice(0, 10);
        set.add(dStr);
      }
    });
    return set;
  }, [events]);

  return (
    <div className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200/80 select-none">
      {/* En-tête : "MOIS" avec Navigation */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
            Mois
          </span>
          <h3 className="text-xs font-bold text-slate-800 capitalize">
            {format(viewMonth, 'MMMM yyyy', { locale: fr })}
          </h3>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const today = new Date();
              setViewMonth(today);
              onSelectDate(today);
            }}
            className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-slate-100"
            title="Aujourd'hui"
          >
            Auj.
          </button>
          <button
            type="button"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Mois suivant"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Jours de la semaine : L M M J V S D (comme sur le croquis) */}
      <div className="grid grid-cols-7 text-center mb-1">
        {weekDayHeaders.map((d, i) => (
          <span key={i} className="text-[10px] font-bold text-slate-400 py-0.5">
            {d}
          </span>
        ))}
      </div>

      {/* Grille des cellules de jours */}
      <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center">
        {days.map((day) => {
          const isSelected = isSameDay(day, currentDate);
          const isCurrentMonth = isSameMonth(day, viewMonth);
          const today = isToday(day);
          const inSelectedWeek = day >= currentWeekStart && day <= currentWeekEnd;
          const dayKey = format(day, 'yyyy-MM-dd');
          const hasEvents = eventDaysSet.has(dayKey);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={clsx(
                'relative h-7 w-full flex flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-all touch-manipulation group',
                inSelectedWeek && !isSelected && 'bg-indigo-50/50',
                isSelected && 'font-bold scale-105 z-10',
                !isCurrentMonth && 'text-slate-300',
                isCurrentMonth && !isSelected && 'text-slate-700 hover:bg-slate-100'
              )}
            >
              {/* Cercle rose/violet comme sur le croquis de l'utilisateur ! */}
              <span
                className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                  isSelected
                    ? 'ring-2 ring-pink-500 bg-pink-500/10 text-pink-700 font-extrabold shadow-xs'
                    : today
                    ? 'bg-indigo-600 text-white font-bold'
                    : ''
                )}
              >
                {format(day, 'd')}
              </span>

              {/* Indicateur d'événement (petit point coloré discret) */}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
