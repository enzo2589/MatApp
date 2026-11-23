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
  startOfDay,
  getISOWeek,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';
import { Bell, Palette, ArrowRight, Sparkles } from 'lucide-react';
import { getDayHighlights, subscribePreferences } from '../../services/studentPreferences';
import { DayColorPickerModal } from './DayColorPickerModal';

interface MonthGridProps {
  currentDate: Date;
  events: EventItem[];
  onSelectDay: (date: Date) => void;
  onSelectEvent?: (event: EventItem) => void;
}

export const MonthGrid: React.FC<MonthGridProps> = ({
  currentDate,
  events,
  onSelectDay,
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
  const weekDayNames = [
    { short: 'Lun', long: 'Lundi' },
    { short: 'Mar', long: 'Mardi' },
    { short: 'Mer', long: 'Mercredi' },
    { short: 'Jeu', long: 'Jeudi' },
    { short: 'Ven', long: 'Vendredi' },
    { short: 'Sam', long: 'Samedi' },
    { short: 'Dim', long: 'Dimanche' },
  ];
  const todayStart = startOfDay(new Date());

  // Regrouper les jours par semaines de 7 jours (Lundi -> Dimanche)
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  // Semaine courante sélectionnée pour repère visuel
  const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100/60 select-none">
      {/* Barre d'aide discrète pour le repérage */}
      <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-1.5 flex items-center justify-between text-xs text-indigo-900 font-medium">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            Vue Globale du Mois • Cliquez sur un <strong>numéro de semaine</strong> ou un <strong>jour</strong> pour ouvrir l'emploi du temps détaillé.
          </span>
        </div>
        <span className="text-[11px] text-indigo-600 font-bold hidden md:inline">
          {format(currentDate, 'MMMM yyyy', { locale: fr }).toUpperCase()}
        </span>
      </div>

      {/* En-tête des colonnes (Semaine + Jours Lundi à Dimanche) */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] border-b border-slate-200 bg-white text-center py-2 z-10 shadow-2xs">
        {/* Colonne Numéro de Semaine */}
        <div className="text-[10px] sm:text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center justify-center border-r border-slate-100">
          Sem.
        </div>

        {/* 7 Jours de la semaine */}
        {weekDayNames.map((name, i) => (
          <div
            key={name.short}
            className={clsx(
              'text-[11px] sm:text-xs font-bold uppercase tracking-wider',
              i >= 5 ? 'text-slate-400 bg-slate-50/40' : 'text-slate-700'
            )}
          >
            <span className="hidden sm:inline">{name.long}</span>
            <span className="sm:hidden">{name.short}</span>
          </div>
        ))}
      </div>

      {/* Grille des Semaines & Cellules du mois */}
      <div className="flex-1 flex flex-col divide-y divide-slate-200 overflow-y-auto bg-slate-200/50">
        {weeks.map((weekDays) => {
          const rowWeekStart = weekDays[0];
          const isoWeek = getISOWeek(rowWeekStart);
          const isSelectedWeek =
            currentDate >= rowWeekStart &&
            currentDate <= weekDays[6];
          const isCurrentRealWeek =
            todayStart >= rowWeekStart &&
            todayStart <= weekDays[6];

          return (
            <div
              key={isoWeek}
              className={clsx(
                'grid grid-cols-[48px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] bg-white min-h-[95px] md:min-h-[120px] transition-colors',
                isSelectedWeek && 'ring-1 ring-inset ring-indigo-400/40 bg-indigo-50/10'
              )}
            >
              {/* Colonne latérale : Numéro de la semaine (clic = ouvre la semaine en grand) */}
              <div
                onClick={() => onSelectDay(rowWeekStart)}
                className={clsx(
                  'flex flex-col items-center justify-center p-1 sm:p-2 border-r border-slate-200/80 cursor-pointer group transition-all',
                  isSelectedWeek
                    ? 'bg-indigo-600 text-white shadow-inner'
                    : isCurrentRealWeek
                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'bg-slate-50/80 text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-700'
                )}
                title={`Cliquer pour ouvrir la Semaine ${isoWeek}`}
              >
                <span
                  className={clsx(
                    'text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest',
                    isSelectedWeek ? 'text-indigo-100' : 'text-slate-400 group-hover:text-indigo-600'
                  )}
                >
                  Sem.
                </span>
                <span className="text-xs sm:text-sm font-black tracking-tight">
                  {isoWeek}
                </span>
                <ArrowRight
                  className={clsx(
                    'w-3 h-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity',
                    isSelectedWeek ? 'text-white' : 'text-indigo-600'
                  )}
                />
              </div>

              {/* 7 Cellules de Jours de la semaine */}
              {weekDays.map((day, dayIndex) => {
                const isCurrentMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const dayKey = format(day, 'yyyy-MM-dd');
                const highlight = dayHighlights[dayKey];
                const isWeekend = dayIndex >= 5;

                // Événements pour ce jour
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
                    onClick={() => onSelectDay(day)}
                    className={clsx(
                      'p-1 sm:p-2 border-r border-slate-100 flex flex-col justify-between transition-all cursor-pointer group relative hover:bg-indigo-50/40',
                      !isCurrentMonth && 'bg-slate-50/60 text-slate-400',
                      isCurrentMonth && isWeekend && 'bg-slate-50/30',
                      today && 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-500/30'
                    )}
                    style={{
                      backgroundColor: highlight ? `${highlight.color}15` : undefined,
                      borderTop: highlight ? `3px solid ${highlight.color}` : undefined,
                    }}
                    title={`Cliquer pour afficher la semaine du ${format(day, 'd MMMM yyyy', { locale: fr })}`}
                  >
                    {/* En-tête de la cellule du jour */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={clsx(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                              today
                                ? 'bg-indigo-600 text-white shadow-xs font-black ring-2 ring-indigo-200'
                                : isCurrentMonth
                                ? 'text-slate-800 group-hover:text-indigo-600'
                                : 'text-slate-300 font-normal'
                            )}
                          >
                            {format(day, 'd')}
                          </span>

                          {today && (
                            <span className="hidden xl:inline text-[9px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-100/80 px-1 py-0.5 rounded">
                              Auj.
                            </span>
                          )}

                          {/* Badge de coloration personnalisée (Examen, Stage, Férié, etc.) */}
                          {highlight && (
                            <span
                              style={{
                                backgroundColor: highlight.color,
                              }}
                              className="px-1.5 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider shadow-2xs truncate max-w-[90px]"
                            >
                              {highlight.label}
                            </span>
                          )}
                        </div>

                        {/* Bouton palette discret pour changer la couleur du jour */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setColorPickerDate(day);
                          }}
                          className="day-palette-btn opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded-md transition-all cursor-pointer"
                          title="Colorer ce jour (Examen, Stage, Férié...)"
                        >
                          <Palette className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Liste des cours & activités du jour */}
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const theme = getColorTheme(event.color);

                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectEvent) {
                                onSelectEvent(event);
                              } else {
                                onSelectDay(day);
                              }
                            }}
                            style={{
                              backgroundColor: theme.bgPastel || '#EEF2FF',
                              borderLeftColor: theme.borderAccent || '#6366F1',
                            }}
                            className="month-event-pill px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border-l-[3px] truncate shadow-2xs hover:brightness-95 transition-all flex items-center justify-between gap-1 cursor-pointer"
                          >
                            <span className="truncate flex items-center gap-1 text-slate-800">
                              <span className="font-bold text-slate-900 shrink-0">
                                {format(parseISO(event.start_time), 'HH:mm')}
                              </span>
                              <span className="truncate">{event.title}</span>
                            </span>

                            {event.alarms && event.alarms.length > 0 && (
                              <Bell className="w-2.5 h-2.5 text-red-500 shrink-0" />
                            )}
                          </div>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <div className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded text-center">
                          +{dayEvents.length - 3} autre{dayEvents.length - 3 > 1 ? 's' : ''} (cliquer)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
