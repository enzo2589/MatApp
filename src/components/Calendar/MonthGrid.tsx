import React, { useState, useEffect } from 'react';
import { EventItem, DayHighlight } from '../../types';
import { getColorTheme } from '../../constants/colors';
import {
  format,
  isSameMonth,
  isSameDay,
  isToday,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  isBefore,
} from 'date-fns';
import { clsx } from 'clsx';
import { Bell, Palette } from 'lucide-react';
import { getDayHighlights, subscribePreferences } from '../../services/studentPreferences';
import { DayColorPickerModal } from './DayColorPickerModal';

interface MonthGridProps {
  currentDate: Date;
  events: EventItem[];
  onSelectSlot: (startTime: Date, endTime: Date) => void;
  onSelectEvent: (event: EventItem) => void;
}

export const MonthGrid: React.FC<MonthGridProps> = ({
  currentDate,
  events,
  onSelectSlot,
  onSelectEvent,
}) => {
  const [dayHighlights, setDayHighlights] = useState<Record<string, DayHighlight>>(getDayHighlights());
  const [colorPickerDate, setColorPickerDate] = useState<Date | null>(null);

  useEffect(() => {
    setDayHighlights(getDayHighlights());
    const unsub = subscribePreferences(() => {
      setDayHighlights(getDayHighlights());
    });
    return unsub;
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lundi
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const todayStart = startOfDay(new Date());

  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.month-event-pill') || (e.target as HTMLElement).closest('.day-palette-btn')) {
      return;
    }
    // Création par défaut à 09:00 sur le jour cliqué
    const start = setMinutes(setHours(day, 9), 0);
    const end = setMinutes(setHours(day, 10), 30);
    onSelectSlot(start, end);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white select-none">
      {/* En-tête des jours de la semaine */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center py-2 z-10 shadow-xs">
        {weekDayNames.map((name) => (
          <div key={name} className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {name}
          </div>
        ))}
      </div>

      {/* Grille des cellules du mois */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 md:grid-rows-6 divide-x divide-y divide-slate-100 overflow-y-auto">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const isPast = isBefore(startOfDay(day), todayStart);
          const dayKey = format(day, 'yyyy-MM-dd');
          const highlight = dayHighlights[dayKey];

          // Filtrer les événements pour ce jour
          const dayEvents = events.filter((e) => {
            try {
              const start = parseISO(e.start_time);
              return isSameDay(start, day);
            } catch {
              return false;
            }
          });

          return (
            <div
              key={day.toISOString()}
              onClick={(e) => handleDayClick(day, e)}
              className={clsx(
                'min-h-[90px] md:min-h-[115px] p-1.5 flex flex-col justify-between transition-colors cursor-pointer group relative',
                !isCurrentMonth && 'bg-slate-50/60 opacity-40',
                today && 'bg-indigo-50/25',
                highlight && 'border-t-2'
              )}
              style={{
                backgroundColor: highlight ? `${highlight.color}15` : undefined,
                borderTopColor: highlight ? highlight.color : undefined,
              }}
            >
              {/* Ligne strikethrough discrète pour les jours passés */}
              {isPast && !today && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
                  <div className="w-[150%] h-[1px] bg-slate-500 rotate-12 origin-top-left mt-6" />
                </div>
              )}

              {/* En-tête de la cellule (Numéro, Badge highlight, Bouton palette) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all relative',
                        today
                          ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/40'
                          : isCurrentMonth
                          ? 'text-slate-800 group-hover:text-indigo-600'
                          : 'text-slate-400',
                        isPast && !today && 'line-through opacity-70'
                      )}
                    >
                      {format(day, 'd')}
                    </span>

                    {/* Badge de couleur personnalisée (Examen, Repos, Stage...) */}
                    {highlight && (
                      <span
                        style={{ backgroundColor: highlight.color }}
                        className="px-1.5 py-0.5 rounded text-[9px] font-extrabold text-white uppercase tracking-wider shadow-2xs truncate max-w-[80px]"
                      >
                        {highlight.label}
                      </span>
                    )}
                  </div>

                  {/* Bouton palette pour changer la couleur du jour */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPickerDate(day);
                    }}
                    className="day-palette-btn opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded-md transition-opacity"
                    title="Changer la couleur de ce jour"
                  >
                    <Palette className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Pastilles d'événements du jour */}
              <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-0.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const theme = getColorTheme(event.color);

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(event);
                      }}
                      style={{
                        backgroundColor: theme.bgPastel,
                        borderLeftColor: theme.borderAccent,
                      }}
                      className="month-event-pill px-1.5 py-0.5 rounded text-[11px] font-semibold border-l-2 truncate shadow-2xs hover:scale-[1.02] transition-transform flex items-center justify-between gap-1"
                    >
                      <span className="truncate flex items-center gap-1" style={{ color: theme.textColor }}>
                        <span>{theme.emoji || '📌'}</span>
                        <span className="font-bold">{format(parseISO(event.start_time), 'HH:mm')}</span>
                        <span className="truncate">{event.title}</span>
                      </span>

                      {event.alarms && event.alarms.length > 0 && (
                        <Bell className="w-2.5 h-2.5 text-red-500 shrink-0" />
                      )}
                    </div>
                  );
                })}

                {dayEvents.length > 3 && (
                  <div className="text-[10px] font-bold text-slate-500 pl-1">
                    +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de coloration du jour */}
      <DayColorPickerModal
        isOpen={Boolean(colorPickerDate)}
        date={colorPickerDate}
        onClose={() => setColorPickerDate(null)}
      />
    </div>
  );
};
