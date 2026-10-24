import React from 'react';
import { EventItem } from '../../types';
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
  setMinutes
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';
import { Bell } from 'lucide-react';

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
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lundi
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.month-event-pill')) {
      return;
    }
    // Création par défaut à 09:00 sur le jour cliqué
    const start = setMinutes(setHours(day, 9), 0);
    const end = setMinutes(setHours(day, 10), 0);
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
                'min-h-[85px] md:min-h-[105px] p-1.5 flex flex-col justify-between transition-colors cursor-pointer group',
                !isCurrentMonth && 'bg-slate-50/60 opacity-50',
                today && 'bg-indigo-50/20'
              )}
            >
              {/* Numéro du jour */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    today
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/40'
                      : isCurrentMonth
                      ? 'text-slate-800 group-hover:text-indigo-600'
                      : 'text-slate-400'
                  )}
                >
                  {format(day, 'd')}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-semibold text-slate-400">
                    {dayEvents.length} {dayEvents.length > 1 ? 'act.' : 'act.'}
                  </span>
                )}
              </div>

              {/* Pastilles d'événements */}
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
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
                      <span className="truncate" style={{ color: theme.textColor }}>
                        {format(parseISO(event.start_time), 'HH:mm')} {event.title}
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
    </div>
  );
};
