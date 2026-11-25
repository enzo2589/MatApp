import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Clock, Trash2, Pencil } from 'lucide-react';
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
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const theme = getColorTheme(task.color);

  // Valeur de mouvement pour le drag horizontal
  const x = useMotionValue(0);

  // Opacité progressive des actions : strictement à 0 au repos ou lors de l'animation
  const editOpacity = useTransform(x, [0, 15, 75], [0, 0.4, 1]);
  const deleteOpacity = useTransform(x, [-75, -15, 0], [1, 0.4, 0]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
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
    setIsDragging(false);
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className="relative overflow-hidden rounded-2xl select-none touch-pan-y shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
    >
      {/* Arrière-plan d'action (Style iOS Reminders natif) */}
      <div
        className={clsx(
          "absolute inset-0 flex items-stretch rounded-2xl overflow-hidden pointer-events-none transition-opacity duration-100",
          isDragging ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Action Gauche : Révélée quand la carte va TOUT AU FOND À DROITE -> MODIFIER */}
        <motion.div
          style={{ opacity: editOpacity }}
          className={clsx(
            "w-1/2 flex items-center justify-start px-4 transition-colors duration-150",
            swipeStatus === 'edit'
              ? "bg-[#007AFF] text-white shadow-inner"
              : "bg-[#007AFF]/85 text-white"
          )}
        >
          <div
            className={clsx(
              "flex items-center gap-2 font-semibold transition-transform duration-150",
              swipeStatus === 'edit' ? "scale-105" : "scale-95 opacity-90"
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
              {swipeStatus === 'edit' ? "Relâcher pour modifier" : "Modifier"}
            </span>
          </div>
        </motion.div>

        {/* Action Droite : Révélée quand la carte va TOUT AU FOND À GAUCHE -> SUPPRIMER */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className={clsx(
            "w-1/2 flex items-center justify-end px-4 ml-auto transition-colors duration-150",
            swipeStatus === 'delete'
              ? "bg-[#FF3B30] text-white shadow-inner"
              : "bg-[#FF3B30]/85 text-white"
          )}
        >
          <div
            className={clsx(
              "flex items-center gap-2 font-semibold transition-transform duration-150",
              swipeStatus === 'delete' ? "scale-105" : "scale-95 opacity-90"
            )}
          >
            <span className={clsx(isExpandedFull ? "text-xs md:text-sm" : "text-[11px]")}>
              {swipeStatus === 'delete' ? "Relâcher pour supprimer" : "Supprimer"}
            </span>
            <Trash2
              className={clsx(
                "stroke-[2.2]",
                isExpandedFull ? "w-5 h-5" : "w-4 h-4",
                swipeStatus === 'delete' && "animate-bounce"
              )}
            />
          </div>
        </motion.div>
      </div>

      {/* Carte au premier plan : Design raffiné Apple Reminders */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.25}
        dragSnapToOrigin
        style={{ x }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className={clsx(
          "group relative flex items-center bg-white hover:bg-slate-50/70 border border-slate-200/70 hover:border-slate-300/80 transition-all touch-pan-y",
          isExpandedFull ? "p-3.5 md:p-4 rounded-2xl gap-3.5" : "p-2.5 rounded-xl gap-2.5"
        )}
      >
        {/* Pilule colorée élégante sur le côté gauche (Style Apple) */}
        <div
          className={clsx(
            "rounded-full shrink-0 self-stretch my-0.5",
            isExpandedFull ? "w-1" : "w-0.5"
          )}
          style={{ backgroundColor: theme.hex }}
        />

        {/* Case à cocher circulaire Apple Reminders */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          className={clsx(
            "group/check relative rounded-full border-[1.8px] border-slate-300 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center justify-center shrink-0 cursor-pointer active:scale-85 focus:outline-none",
            isExpandedFull ? "w-5 h-5" : "w-4.5 h-4.5"
          )}
          title="Marquer comme terminée"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-0 group-hover/check:opacity-60 transition-opacity" />
        </button>

        {/* Corps de la tâche : Typographie claire et contrastée */}
        <div className="flex-1 min-w-0 pr-12 select-none">
          <p
            className={clsx(
              "leading-snug break-words text-slate-850 font-medium tracking-tight",
              isExpandedFull ? "text-[14.5px] md:text-[15px]" : "text-[12.5px]"
            )}
          >
            {task.title}
          </p>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {/* Badge catégorie sobre Apple */}
            {theme.name && (
              <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.hex }} />
                <span>{theme.name}</span>
              </span>
            )}

            {task.alarm_time && (
              <div
                className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60"
              >
                <Clock className="w-2.5 h-2.5 text-amber-600" />
                <span>{format(parseISO(task.alarm_time), 'HH:mm dd/MM', { locale: fr })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Boutons d'action subtils (Style Apple SF Buttons) */}
        <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-0.5">
          {/* Bouton Modifier */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className={clsx(
              "text-slate-400 hover:text-indigo-600 rounded-lg transition-all cursor-pointer flex items-center justify-center",
              isExpandedFull
                ? "w-7 h-7 hover:bg-slate-100 opacity-60 hover:opacity-100"
                : "w-6 h-6 hover:bg-slate-100 opacity-40 hover:opacity-100"
            )}
            title="Modifier (ou glisser à fond vers la droite)"
          >
            <Pencil className={clsx(isExpandedFull ? "w-3.5 h-3.5" : "w-3 h-3")} />
          </button>

          {/* Bouton Supprimer */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className={clsx(
              "text-slate-400 hover:text-[#FF3B30] rounded-lg transition-all cursor-pointer flex items-center justify-center",
              isExpandedFull
                ? "w-7 h-7 hover:bg-red-50 opacity-60 hover:opacity-100"
                : "w-6 h-6 hover:bg-red-50 opacity-40 hover:opacity-100"
            )}
            title="Supprimer (ou glisser à fond vers la gauche)"
          >
            <Trash2 className={clsx(isExpandedFull ? "w-3.5 h-3.5" : "w-3 h-3")} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
