import React, { useState, useEffect, useMemo } from 'react';
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
  startOfDay,
  isBefore,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { clsx } from 'clsx';
import { EventItem, DayHighlight } from '../../types';
import { getDayHighlights, subscribePreferences } from '../../services/studentPreferences';
import { DayColorPickerModal } from './DayColorPickerModal';

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
  const [viewMonth, setViewMonth] = useState<Date>(currentDate);
  const [dayHighlights, setDayHighlights] = useState<Record<string, DayHighlight>>(getDayHighlights());
  const [colorPickerDate, setColorPickerDate] = useState<Date | null>(null);

  useEffect(() => {
    setViewMonth(currentDate);
  }, [currentDate]);

  useEffect(() => {
    setDayHighlights(getDayHighlights());
    const unsub = subscribePreferences(() => {
      setDayHighlights(getDayHighlights());
    });
    return unsub;
  }, []);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lundi
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  // Semaine courante sélectionnée
  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Map des dates qui ont des événements
  const eventDaysSet = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (!e.is_deleted) {
        const dStr = e.start_time.slice(0, 10);
        set.add(dStr);
      }
    });
    return set;
  }, [events]);

  const todayStart = startOfDay(new Date());

  return (
    <div className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200/80 select-none">
      {/* En-tête : "MOIS" avec Navigation & Bouton Colorer */}
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
          {/* Bouton pour colorer le jour actuellement sélectionné */}
          <button
            type="button"
            onClick={() => setColorPickerDate(currentDate)}
            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors mr-1"
            title="Colorer ce jour (Examen, Repos, Stage...)"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

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
          const isPast = isBefore(startOfDay(day), todayStart);
          const highlight = dayHighlights[dayKey];

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              onContextMenu={(e) => {
                e.preventDefault();
                setColorPickerDate(day);
              }}
              className={clsx(
                'relative h-7 w-full flex flex-col items-center justify-center rounded-lg text-[11px] font-medium transition-all touch-manipulation group',
                inSelectedWeek && !isSelected && 'bg-indigo-50/50',
                isSelected && 'font-bold scale-105 z-10',
                !isCurrentMonth && 'text-slate-300 opacity-40',
                isCurrentMonth && !isSelected && 'text-slate-700 hover:bg-slate-100'
              )}
              title={highlight ? `${format(day, 'd MMMM')} : ${highlight.label}` : undefined}
            >
              {/* Cercle avec couleur personnalisée ou sélection */}
              <span
                style={{
                  backgroundColor: highlight ? `${highlight.color}25` : undefined,
                  borderColor: highlight ? highlight.color : undefined,
                }}
                className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all relative',
                  highlight && 'border-2 font-extrabold',
                  isSelected
                    ? 'ring-2 ring-pink-500 bg-pink-500/15 text-pink-700 font-extrabold shadow-xs'
                    : today
                    ? 'bg-indigo-600 text-white font-bold'
                    : ''
                )}
              >
                {/* Numéro du jour */}
                <span className={clsx(isPast && !today && 'line-through text-slate-400 opacity-60')}>
                  {format(day, 'd')}
                </span>

                {/* Trait diagonal strikethrough (comme sur le croquis où les jours passés sont barrés d'une croix !) */}
                {isPast && !today && (
                  <span className="absolute inset-x-1 h-[1.5px] bg-slate-400 rotate-45 pointer-events-none opacity-50" />
                )}
              </span>

              {/* Indicateur d'événement (petit point coloré discret) */}
              {hasEvents && !isSelected && (
                <span
                  style={{ backgroundColor: highlight ? highlight.color : '#6366F1' }}
                  className="absolute bottom-0.5 w-1 h-1 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Modal de coloration de journée */}
      <DayColorPickerModal
        isOpen={Boolean(colorPickerDate)}
        date={colorPickerDate}
        onClose={() => setColorPickerDate(null)}
      />
    </div>
  );
};
