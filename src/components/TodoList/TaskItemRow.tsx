import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Circle, Clock, Trash2, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TaskItem } from '../../types';
import { getColorTheme } from '../../constants/colors';

interface TaskItemRowProps {
  task: TaskItem;
  isExpandedFull: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: TaskItem) => void;
}

const SWIPE_THRESHOLD = 105; // Doit être glissé franchement tout au fond (> 105px) pour déclencher

export const TaskItemRow: React.FC<TaskItemRowProps> = ({
  task,
  isExpandedFull,
  onToggle,
  onDelete,
  onEdit,
}) => {
  const [swipeStatus, setSwipeStatus] = useState<'none' | 'delete' | 'edit'>('none');
  const isDraggingRef = useRef(false);
  const theme = getColorTheme(task.color);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDrag = (_: any, info: any) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      if (swipeStatus !== 'delete') {
        setSwipeStatus('delete');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      if (swipeStatus !== 'edit') {
        setSwipeStatus('edit');
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }
    } else {
      if (swipeStatus !== 'none') {
        setSwipeStatus('none');
      }
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    setSwipeStatus('none');
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);

    // Déclenchement STRICTEMENT si glissé tout au fond au-delà du seuil franc
    if (info.offset.x < -SWIPE_THRESHOLD) {
      onDelete(task.id);
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      onEdit(task);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.stopPropagation();
      return;
    }
    onToggle(task.id);
  };

  return (
    <div className="relative overflow-hidden rounded-xl md:rounded-2xl select-none touch-pan-y">
      {/* Arrière-plan d'action (Révélé lors du glissement) */}
      <div className="absolute inset-0 flex items-stretch rounded-xl md:rounded-2xl overflow-hidden pointer-events-none">
        {/* Action Gauche : Révélée quand la carte va TOUT AU FOND À DROITE -> MODIFIER */}
        <div
          className={clsx(
            "w-1/2 flex items-center justify-start px-3.5 transition-colors duration-150",
            swipeStatus === 'edit'
              ? "bg-indigo-600 text-white shadow-inner"
              : "bg-indigo-500/85 text-indigo-50"
          )}
        >
          <div
            className={clsx(
              "flex items-center gap-2 font-bold transition-transform duration-150",
              swipeStatus === 'edit' ? "scale-105" : "scale-95 opacity-80"
            )}
          >
            <Pencil
              className={clsx(
                "stroke-[2.2]",
                isExpandedFull ? "w-5 h-5" : "w-4 h-4",
                swipeStatus === 'edit' && "animate-bounce"
              )}
            />
            <span className={clsx(isExpandedFull ? "text-xs md:text-sm" : "text-[11px]")}>
              {swipeStatus === 'edit' ? "Relâcher pour modifier" : "Glisser à fond pour modifier"}
            </span>
          </div>
        </div>

        {/* Action Droite : Révélée quand la carte va TOUT AU FOND À GAUCHE -> SUPPRIMER */}
        <div
          className={clsx(
            "w-1/2 flex items-center justify-end px-3.5 ml-auto transition-colors duration-150",
            swipeStatus === 'delete'
              ? "bg-red-600 text-white shadow-inner"
              : "bg-red-500/85 text-red-50"
          )}
        >
          <div
            className={clsx(
              "flex items-center gap-2 font-bold transition-transform duration-150",
              swipeStatus === 'delete' ? "scale-105" : "scale-95 opacity-80"
            )}
          >
            <span className={clsx(isExpandedFull ? "text-xs md:text-sm" : "text-[11px]")}>
              {swipeStatus === 'delete' ? "Relâcher pour supprimer" : "Glisser à fond pour supprimer"}
            </span>
            <Trash2
              className={clsx(
                "stroke-[2.2]",
                isExpandedFull ? "w-5 h-5" : "w-4 h-4",
                swipeStatus === 'delete' && "animate-bounce"
              )}
            />
          </div>
        </div>
      </div>

      {/* Carte Draggable au premier plan */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.25}
        dragSnapToOrigin
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        className={clsx(
          "group relative flex items-start bg-slate-50/95 hover:bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-colors cursor-pointer touch-pan-y active:scale-[0.99]",
          isExpandedFull ? "p-3.5 md:p-4 rounded-2xl gap-3.5" : "p-2 rounded-xl gap-2"
        )}
        style={{
          borderLeftWidth: isExpandedFull ? '4px' : '3px',
          borderLeftColor: theme.borderAccent || theme.hex,
        }}
      >
        {/* Case à cocher circulaire */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className={clsx(
            "mt-0.5 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0",
            isExpandedFull ? "p-0.5" : ""
          )}
          title="Marquer comme terminée"
        >
          <Circle className={clsx(isExpandedFull ? "w-5 h-5 stroke-[2]" : "w-4 h-4 stroke-[1.8]")} />
        </button>

        {/* Corps de la tâche */}
        <div className="flex-1 min-w-0 pr-14 select-none">
          <p
            className={clsx(
              "leading-snug break-words text-slate-800",
              isExpandedFull ? "text-sm md:text-base font-semibold" : "text-xs font-medium"
            )}
          >
            {task.title}
          </p>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Badge catégorie en mode grand */}
            {isExpandedFull && theme.name && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.hex }} />
                {theme.name}
              </span>
            )}

            {task.alarm_time && (
              <div
                className={clsx(
                  "flex items-center gap-1 text-amber-700 font-semibold",
                  isExpandedFull
                    ? "text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70"
                    : "text-[10px]"
                )}
              >
                <Clock className={clsx(isExpandedFull ? "w-3 h-3 text-amber-600" : "w-2.5 h-2.5 text-amber-600")} />
                <span>{format(parseISO(task.alarm_time), 'HH:mm dd/MM', { locale: fr })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Boutons d'action visibles (Modifier & Supprimer) */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5">
          {/* Bouton Modifier */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className={clsx(
              "transition-all text-slate-300 hover:text-indigo-600 rounded-lg cursor-pointer",
              isExpandedFull ? "opacity-60 hover:opacity-100 p-1.5 hover:bg-indigo-50" : "opacity-40 hover:opacity-100 p-1 hover:bg-indigo-50"
            )}
            title="Modifier la tâche (ou glisser à fond vers la droite)"
          >
            <Pencil className={clsx(isExpandedFull ? "w-4 h-4" : "w-3 h-3")} />
          </button>

          {/* Bouton Supprimer */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className={clsx(
              "transition-all text-slate-300 hover:text-red-500 rounded-lg cursor-pointer",
              isExpandedFull ? "opacity-60 hover:opacity-100 p-1.5 hover:bg-red-50" : "opacity-40 hover:opacity-100 p-1 hover:bg-red-50"
            )}
            title="Supprimer la tâche (ou glisser à fond vers la gauche)"
          >
            <Trash2 className={clsx(isExpandedFull ? "w-4 h-4" : "w-3 h-3")} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
