import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { EventItem } from '../../types';
import { MEDICAL_COLORS, getColorTheme } from '../../constants/colors';
import {
  format,
  isSameDay,
  isToday,
  differenceInMinutes,
  parseISO,
  setHours,
  setMinutes,
  addMinutes,
  addDays
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bell,
  Clock,
  Edit2,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  GripHorizontal,
  MoveVertical,
  Copy,
  Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { saveLocalEvent, deleteLocalEvent } from '../../db/localDb';

interface WeekGridProps {
  days: Date[];
  events: EventItem[];
  onSelectSlot: (startTime: Date, endTime: Date) => void;
  onSelectEvent: (event: EventItem) => void;
}

const TOTAL_HOURS = 24;

interface LayoutEvent {
  event: EventItem;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
}

// Hauteurs de ligne par défaut pour le zoom tactile iPad
const ZOOM_LEVELS = [
  { label: 'Compact', height: 56 },
  { label: 'Normal', height: 72 },
  { label: 'Grand (Pencil)', height: 94 },
];

export const WeekGrid: React.FC<WeekGridProps> = ({
  days,
  events,
  onSelectSlot,
  onSelectEvent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  // Niveau de zoom / hauteur d'heure réglable tactilement
  const [hourHeight, setHourHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('medagenda_hour_height');
      return saved ? parseInt(saved, 10) : 72;
    } catch {
      return 72;
    }
  });

  const handleSetHourHeight = (h: number) => {
    setHourHeight(h);
    try {
      localStorage.setItem('medagenda_hour_height', h.toString());
    } catch {}
  };

  // Inspecteur rapide Apple pour événement cliqué
  const [quickInspectEvent, setQuickInspectEvent] = useState<EventItem | null>(null);

  // État de création tactile par glissement (Touch-and-Drag)
  const [dragCreation, setDragCreation] = useState<{
    day: Date;
    startMinutes: number;
    currentMinutes: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  // État de redimensionnement tactile d'un événement (Bottom Handle Drag)
  const [resizingEvent, setResizingEvent] = useState<{
    event: EventItem;
    initialEndMinutes: number;
    currentEndMinutes: number;
    startY: number;
  } | null>(null);

  // Défilement automatique au chargement vers 07:30
  useEffect(() => {
    if (containerRef.current) {
      const scrollPosition = 7.5 * hourHeight;
      containerRef.current.scrollTop = scrollPosition;
    }
  }, [hourHeight]);

  // Calcul mathématique précis des positions d'événements et des chevauchements
  const eventsByDay = useMemo(() => {
    const map = new Map<string, LayoutEvent[]>();

    days.forEach((day) => {
      const dayKey = format(day, 'yyyy-MM-dd');

      const dayEvents = events.filter((e) => {
        try {
          const s = parseISO(e.start_time);
          return isSameDay(s, day);
        } catch {
          return false;
        }
      });

      const rawLayouts = dayEvents.map((event) => {
        const start = parseISO(event.start_time);
        const end = parseISO(event.end_time);

        const startMinutes = start.getHours() * 60 + Math.round(start.getMinutes() / 5) * 5;
        let totalMinutes = Math.max(15, differenceInMinutes(end, start));

        // Si cet événement est en cours de redimensionnement tactile live
        if (resizingEvent && resizingEvent.event.id === event.id) {
          totalMinutes = Math.max(15, resizingEvent.currentEndMinutes - startMinutes);
        }

        const top = (startMinutes / 60) * hourHeight;
        const height = Math.max(26, (totalMinutes / 60) * hourHeight);

        return {
          event,
          startMinutes,
          endMinutes: startMinutes + totalMinutes,
          top,
          height,
          column: 0,
          totalColumns: 1,
        };
      });

      rawLayouts.sort((a, b) => a.startMinutes - b.startMinutes || b.height - a.height);

      // Algorithme de placement sans chevauchement visuel
      const clusters: (typeof rawLayouts)[] = [];
      rawLayouts.forEach((item) => {
        let placed = false;
        for (const cluster of clusters) {
          const hasOverlap = cluster.some(
            (c) => item.startMinutes < c.endMinutes && item.endMinutes > c.startMinutes
          );
          if (hasOverlap) {
            cluster.push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          clusters.push([item]);
        }
      });

      clusters.forEach((cluster) => {
        const columns: (typeof rawLayouts)[] = [];
        cluster.forEach((ev) => {
          let colIdx = 0;
          while (
            columns[colIdx] &&
            columns[colIdx].some((c) => ev.startMinutes < c.endMinutes && ev.endMinutes > c.startMinutes)
          ) {
            colIdx++;
          }
          if (!columns[colIdx]) columns[colIdx] = [];
          columns[colIdx].push(ev);
          ev.column = colIdx;
        });

        const totalCols = columns.length;
        cluster.forEach((ev) => {
          ev.totalColumns = totalCols;
        });
      });

      map.set(dayKey, rawLayouts);
    });

    return map;
  }, [days, events, hourHeight, resizingEvent]);

  // --------------------------------------------------------------------------
  // GESTION TACTILE IPAD : CRÉATION AU DOIGT / APPLE PENCIL PAR GLISSER (DRAG)
  // --------------------------------------------------------------------------
  const handleSlotPointerDown = (e: React.PointerEvent<HTMLDivElement>, day: Date) => {
    // Si clic sur carte d'événement ou poignée, laisser faire l'événement
    if ((e.target as HTMLElement).closest('.event-card') || (e.target as HTMLElement).closest('.quick-inspector')) {
      return;
    }

    setQuickInspectEvent(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const exactMinutes = (clickY / hourHeight) * 60;
    const snappedMinutes = Math.min(1435, Math.max(0, Math.floor(exactMinutes / 5) * 5));

    // Capture du pointeur pour iPad
    e.currentTarget.setPointerCapture(e.pointerId);

    setDragCreation({
      day,
      startMinutes: snappedMinutes,
      currentMinutes: snappedMinutes + 60, // 1h par défaut
      startY: e.clientY,
      isDragging: false,
    });
  };

  const handleSlotPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragCreation) return;

    const deltaY = e.clientY - dragCreation.startY;
    const isDrag = Math.abs(deltaY) > 8 || dragCreation.isDragging;

    const rect = e.currentTarget.getBoundingClientRect();
    const currentY = Math.max(0, e.clientY - rect.top);
    const exactMinutes = (currentY / hourHeight) * 60;
    const snappedMinutes = Math.min(1435, Math.max(0, Math.floor(exactMinutes / 5) * 5));

    const endMins = Math.max(dragCreation.startMinutes + 15, snappedMinutes);

    setDragCreation({
      ...dragCreation,
      currentMinutes: endMins,
      isDragging: isDrag,
    });
  };

  const handleSlotPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragCreation) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const { day, startMinutes, currentMinutes, isDragging } = dragCreation;
    setDragCreation(null);

    const startHours = Math.floor(startMinutes / 60);
    const startMins = startMinutes % 60;
    const startTime = setMinutes(setHours(day, startHours), startMins);

    let endTime: Date;
    if (isDragging && currentMinutes > startMinutes) {
      const endHours = Math.floor(currentMinutes / 60);
      const endMins = currentMinutes % 60;
      endTime = setMinutes(setHours(day, endHours), endMins);
    } else {
      // Tap simple : 1h30 par défaut
      endTime = addMinutes(startTime, 90);
    }

    onSelectSlot(startTime, endTime);
  };

  // --------------------------------------------------------------------------
  // GESTION TACTILE IPAD : REDIMENSIONNEMENT PAR POIGNÉE BASSE (RESIZE HANDLE)
  // --------------------------------------------------------------------------
  const handleResizePointerDown = (e: React.PointerEvent, event: EventItem) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    const initialEndMinutes = end.getHours() * 60 + Math.round(end.getMinutes() / 5) * 5;

    setResizingEvent({
      event,
      initialEndMinutes,
      currentEndMinutes: initialEndMinutes,
      startY: e.clientY,
    });
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!resizingEvent) return;

    const deltaY = e.clientY - resizingEvent.startY;
    const deltaMinutes = Math.round((deltaY / hourHeight) * 60 / 5) * 5;
    const start = parseISO(resizingEvent.event.start_time);
    const startMinutes = start.getHours() * 60 + Math.round(start.getMinutes() / 5) * 5;

    const newEndMinutes = Math.max(startMinutes + 15, resizingEvent.initialEndMinutes + deltaMinutes);

    setResizingEvent({
      ...resizingEvent,
      currentEndMinutes: newEndMinutes,
    });
  };

  const handleResizePointerUp = async (e: React.PointerEvent) => {
    if (!resizingEvent) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { event, currentEndMinutes } = resizingEvent;
    setResizingEvent(null);

    const endHours = Math.floor(currentEndMinutes / 60);
    const endMins = currentEndMinutes % 60;
    const startDate = parseISO(event.start_time);
    const newEndDate = setMinutes(setHours(startDate, endHours), endMins);

    const updated = {
      ...event,
      end_time: newEndDate.toISOString(),
    };

    await saveLocalEvent(updated);
  };

  // --------------------------------------------------------------------------
  // ACTIONS RAPIDES DE MODIFICATION
  // --------------------------------------------------------------------------
  const handleNudgeDuration = async (event: EventItem, deltaMinutes: number) => {
    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    const newEnd = addMinutes(end, deltaMinutes);

    if (differenceInMinutes(newEnd, start) >= 15) {
      const updated = {
        ...event,
        end_time: newEnd.toISOString(),
      };
      await saveLocalEvent(updated);
      setQuickInspectEvent(updated);
    }
  };

  const handleChangeCategory = async (event: EventItem, colorId: string) => {
    const updated = {
      ...event,
      color: colorId,
    };
    await saveLocalEvent(updated);
    setQuickInspectEvent(updated);
  };

  const handleDeleteCurrent = async (id: string) => {
    await deleteLocalEvent(id);
    setQuickInspectEvent(null);
  };

  // Duplication éclair d'un événement
  const handleDuplicateEvent = async (event: EventItem, daysOffset: number = 1) => {
    const start = addDays(parseISO(event.start_time), daysOffset);
    const end = addDays(parseISO(event.end_time), daysOffset);

    const newEvent = {
      title: `${event.title} (Copie)`,
      description: event.description || '',
      color: event.color,
      alarms: event.alarms || [],
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };
    await saveLocalEvent(newEvent);
    setQuickInspectEvent(null);
  };

  // Déplacement tactile rapide (avancer ou reculer de 30 min ou 1h)
  const handleShiftEventTime = async (event: EventItem, deltaMinutes: number) => {
    const start = addMinutes(parseISO(event.start_time), deltaMinutes);
    const end = addMinutes(parseISO(event.end_time), deltaMinutes);

    const updated = {
      ...event,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };
    await saveLocalEvent(updated);
    setQuickInspectEvent(updated);
  };

  // Déplacement d'un jour vers la gauche ou la droite
  const handleShiftEventDay = async (event: EventItem, daysDelta: number) => {
    const start = addDays(parseISO(event.start_time), daysDelta);
    const end = addDays(parseISO(event.end_time), daysDelta);

    const updated = {
      ...event,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    };
    await saveLocalEvent(updated);
    setQuickInspectEvent(updated);
  };

  // Indicateur de l'heure courante (Ligne rouge live)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = (currentMinutes / 60) * hourHeight;

  // Lettres des jours fidèles au croquis : L M M J V S D
  const getDayInitial = (date: Date): string => {
    const dayIndex = date.getDay();
    const letters = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    return letters[dayIndex];
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white select-none relative touch-manipulation">
      {/* En-tête des jours : L M M J V S D (comme sur le croquis) */}
      <div className="flex border-b border-slate-200/90 bg-white/95 backdrop-blur-md z-20 sticky top-0 shadow-xs">
        {/* Colonne heure vide */}
        <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200/80 p-2 flex flex-col items-center justify-center">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            Sem.
          </span>
        </div>

        {/* Colonnes des jours L M M J V S D */}
        <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-slate-100">
          {days.map((day) => {
            const today = isToday(day);
            const initial = getDayInitial(day);

            return (
              <div
                key={day.toISOString()}
                className={clsx(
                  'py-2 px-1 text-center transition-colors relative',
                  today ? 'bg-indigo-50/70' : 'hover:bg-slate-50/70'
                )}
              >
                <p className="text-sm font-extrabold text-slate-800 tracking-tight">
                  {initial}
                </p>
                <div
                  className={clsx(
                    'w-7 h-7 mx-auto mt-0.5 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    today
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400/40'
                      : 'text-slate-600'
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grille horaire défilable avec support tactile iPad */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden relative flex divide-x divide-slate-100 touch-pan-y"
      >
        {/* Colonne latérale des heures (1h, 2h... comme sur le croquis) */}
        <div className="w-14 sm:w-16 shrink-0 bg-slate-50/50 border-r border-slate-200/80 select-none">
          {Array.from({ length: TOTAL_HOURS }).map((_, hour) => (
            <div
              key={hour}
              style={{ height: hourHeight }}
              className="relative text-right pr-2 text-xs font-bold text-slate-400 border-b border-slate-100"
            >
              <span className="-top-2.5 relative">{hour}h</span>
            </div>
          ))}
        </div>

        {/* Grille principale des jours */}
        <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-slate-100 relative">
          {days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayLayouts = eventsByDay.get(dayKey) || [];
            const today = isToday(day);
            const isCreatingHere = dragCreation && isSameDay(dragCreation.day, day);

            return (
              <div
                key={dayKey}
                onPointerDown={(e) => handleSlotPointerDown(e, day)}
                onPointerMove={handleSlotPointerMove}
                onPointerUp={handleSlotPointerUp}
                className={clsx(
                  'relative h-full transition-colors cursor-crosshair group/cell touch-none',
                  today ? 'bg-indigo-50/15' : 'hover:bg-slate-50/40'
                )}
                style={{ height: TOTAL_HOURS * hourHeight }}
              >
                {/* Lignes d'heures et demi-heures */}
                {Array.from({ length: TOTAL_HOURS }).map((_, hour) => (
                  <div
                    key={hour}
                    style={{ height: hourHeight }}
                    className="border-b border-slate-100 relative pointer-events-none"
                  >
                    <div
                      className="absolute inset-x-0 border-b border-dashed border-slate-100/80"
                      style={{ top: hourHeight / 2 }}
                    />
                  </div>
                ))}

                {/* Indicateur temps réel de l'heure */}
                {today && (
                  <div
                    className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm -ml-1 ring-2 ring-white animate-pulse" />
                    <div className="flex-1 h-0.5 bg-red-500 shadow-xs" />
                  </div>
                )}

                {/* RECTANGLE VISUEL DE CRÉATION EN TEMPS RÉEL (Touch-and-Drag sur iPad) */}
                {isCreatingHere && dragCreation && (
                  <div
                    style={{
                      top: `${(dragCreation.startMinutes / 60) * hourHeight}px`,
                      height: `${Math.max(26, ((dragCreation.currentMinutes - dragCreation.startMinutes) / 60) * hourHeight)}px`,
                    }}
                    className="absolute inset-x-1 z-30 rounded-xl bg-indigo-500/20 border-2 border-dashed border-indigo-600 shadow-md flex flex-col justify-between p-2 pointer-events-none animate-pulse"
                  >
                    <div className="flex items-center gap-1.5 text-indigo-900 font-extrabold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Nouveau créneau...</span>
                    </div>
                    <div className="text-[10px] font-bold text-indigo-800 bg-white/90 px-2 py-0.5 rounded-md self-start shadow-xs">
                      {Math.floor(dragCreation.startMinutes / 60).toString().padStart(2, '0')}:{(dragCreation.startMinutes % 60).toString().padStart(2, '0')} →{' '}
                      {Math.floor(dragCreation.currentMinutes / 60).toString().padStart(2, '0')}:{(dragCreation.currentMinutes % 60).toString().padStart(2, '0')} (
                      {dragCreation.currentMinutes - dragCreation.startMinutes}m)
                    </div>
                  </div>
                )}

                {/* Cartes d'événements */}
                {dayLayouts.map(({ event, top, height, column, totalColumns }) => {
                  const theme = getColorTheme(event.color);
                  const widthPercent = 100 / totalColumns;
                  const leftPercent = column * widthPercent;
                  const durationMins = differenceInMinutes(parseISO(event.end_time), parseISO(event.start_time));
                  const isInspected = quickInspectEvent?.id === event.id;

                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickInspectEvent(event);
                      }}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent - 1.5}%`,
                        backgroundColor: theme.bgPastel,
                        borderLeftColor: theme.borderAccent,
                      }}
                      className={clsx(
                        'event-card absolute z-10 rounded-xl p-2 shadow-xs border-l-4 transition-all duration-100',
                        'hover:shadow-md hover:scale-[1.01] hover:z-20 cursor-pointer overflow-hidden flex flex-col justify-between select-none',
                        isInspected && 'ring-2 ring-indigo-500 shadow-apple-lg z-30'
                      )}
                    >
                      {/* Corps supérieur de l'événement */}
                      <div className="min-w-0 pointer-events-none">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className="text-xs font-extrabold truncate leading-tight tracking-tight flex items-center gap-1"
                            style={{ color: theme.textColor }}
                          >
                            <span>{theme.emoji || '📌'}</span>
                            <span className="truncate">{event.title}</span>
                          </h4>

                          {event.alarms && event.alarms.length > 0 && (
                            <Bell className="w-3 h-3 text-red-500 shrink-0" />
                          )}
                        </div>

                        {height >= 38 && (
                          <p className="text-[10px] font-bold text-slate-600 truncate mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-slate-400" />
                            <span>
                              {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                            </span>
                            <span className="opacity-60 text-[9px]">({durationMins}m)</span>
                          </p>
                        )}
                      </div>

                      {height >= 75 && event.description && (
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-snug font-medium pointer-events-none">
                          {event.description}
                        </p>
                      )}

                      {/* POIGNÉE DE REDIMENSIONNEMENT TACTILE IPAD (RESIZE HANDLE EN BAS) */}
                      <div
                        onPointerDown={(e) => handleResizePointerDown(e, event)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        className="touch-none w-full h-3.5 -mb-1 flex items-center justify-center cursor-ns-resize hover:bg-black/10 active:bg-black/20 rounded-b transition-colors group/resize"
                        title="Glissez avec le doigt ou Apple Pencil pour ajuster la durée"
                      >
                        <div className="w-8 h-1 rounded-full bg-slate-400/50 group-hover/resize:bg-indigo-600 group-hover/resize:w-12 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTRÔLEUR DE ZOOM TACTILE FLOTTANT (Idéal pour iPad) */}
      <div className="absolute bottom-4 left-4 z-40 bg-white/90 backdrop-blur-md rounded-2xl shadow-apple border border-slate-200/80 p-1 flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleSetHourHeight(Math.max(50, hourHeight - 12))}
          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors active:scale-95"
          title="Zoom arrière (vue dense)"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <span className="text-[10px] font-extrabold text-slate-600 px-1.5 uppercase tracking-wider">
          {hourHeight <= 58 ? 'Compact' : hourHeight >= 85 ? 'Pencil' : 'Normal'}
        </span>

        <button
          type="button"
          onClick={() => handleSetHourHeight(Math.min(100, hourHeight + 12))}
          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors active:scale-95"
          title="Zoom avant (confort Apple Pencil)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* INSPECTEUR RAPIDE APPLE (Quand on clique sur un événement pour modification éclair) */}
      <AnimatePresence>
        {quickInspectEvent && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="quick-inspector absolute bottom-4 right-4 z-40 bg-white/95 backdrop-blur-md rounded-2xl shadow-apple-lg border border-slate-200/90 p-3.5 w-80 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  Modification Éclair
                </span>
                <h4 className="text-xs font-bold text-slate-900 truncate mt-1">
                  {quickInspectEvent.title}
                </h4>
                <p className="text-[10px] text-slate-500 font-medium">
                  {format(parseISO(quickInspectEvent.start_time), 'EEEE d MMMM à HH:mm', { locale: fr })}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setQuickInspectEvent(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Ajustements de durée rapides (+15m, +30m, -15m) */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Ajuster la durée :
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNudgeDuration(quickInspectEvent, -15)}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors active:scale-95"
                >
                  -15 min
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeDuration(quickInspectEvent, 15)}
                  className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors active:scale-95"
                >
                  +15 min
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeDuration(quickInspectEvent, 30)}
                  className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors active:scale-95"
                >
                  +30 min
                </button>
              </div>
            </div>

            {/* Changer de catégorie en 1 tap */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Changer de matière / activité :
              </span>
              <div className="grid grid-cols-4 gap-1">
                {MEDICAL_COLORS.slice(0, 8).map((c) => {
                  const isCur = quickInspectEvent.color === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleChangeCategory(quickInspectEvent, c.id)}
                      className={clsx(
                        'py-1.5 px-1.5 rounded-lg text-[10px] font-bold truncate flex items-center justify-center gap-1 transition-all',
                        isCur
                          ? 'ring-2 ring-indigo-500 shadow-2xs font-extrabold'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      )}
                      style={{ backgroundColor: c.bgPastel, color: c.textColor }}
                      title={c.name}
                    >
                      <span>{c.emoji}</span>
                      <span className="truncate text-[9px]">{c.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Déplacer l'événement sur l'emploi du temps */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Déplacer l’activité sur la grille :
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleShiftEventTime(quickInspectEvent, -30)}
                    className="flex-1 py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors active:scale-95"
                    title="Reculer de 30 min"
                  >
                    -30 min
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftEventTime(quickInspectEvent, 30)}
                    className="flex-1 py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors active:scale-95"
                    title="Avancer de 30 min"
                  >
                    +30 min
                  </button>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleShiftEventDay(quickInspectEvent, -1)}
                    className="flex-1 py-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors active:scale-95"
                    title="Déplacer vers le jour précédent"
                  >
                    ← Jour -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftEventDay(quickInspectEvent, 1)}
                    className="flex-1 py-1 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors active:scale-95"
                    title="Déplacer vers le jour suivant"
                  >
                    Jour +1 →
                  </button>
                </div>
              </div>
            </div>

            {/* Dupliquer l'événement */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Copy className="w-3 h-3 text-indigo-600" />
                Dupliquer l’activité :
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleDuplicateEvent(quickInspectEvent, 1)}
                  className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 active:scale-95"
                >
                  <Copy className="w-3 h-3" />
                  Demain (+1j)
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateEvent(quickInspectEvent, 7)}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 active:scale-95"
                >
                  <Copy className="w-3 h-3" />
                  Semaine (+7j)
                </button>
              </div>
            </div>

            {/* Actions Modifier / Supprimer */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleDeleteCurrent(quickInspectEvent.id)}
                className="text-[11px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectEvent(quickInspectEvent);
                  setQuickInspectEvent(null);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1 transition-all active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Édition Complète
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
