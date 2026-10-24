import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveLocalTask, toggleTaskCompletion, deleteLocalTask } from '../../db/localDb';
import { MEDICAL_COLORS, getColorTheme } from '../../constants/colors';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  Sparkles,
  CheckSquare,
  Check,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PersistentTodoListProps {
  onCloseMobileDrawer?: () => void;
  isCompactInSidebar?: boolean;
}

export const PersistentTodoList: React.FC<PersistentTodoListProps> = ({
  onCloseMobileDrawer,
  isCompactInSidebar = false,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(MEDICAL_COLORS[1].hex); // Révisions / Anki par défaut
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [alarmOption, setAlarmOption] = useState<'none' | '1h' | 'today_evening'>('none');

  // Live Query Dexie réactif instantané (0 ms)
  const allTasks = useLiveQuery(
    () => db.tasks.filter((t) => !t.is_deleted).toArray(),
    []
  );

  const activeTasks = (allTasks || [])
    .filter((t) => !t.is_completed)
    .sort((a, b) => a.order_index - b.order_index);

  const completedTasks = (allTasks || [])
    .filter((t) => t.is_completed)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    let alarmTime: string | null = null;
    if (alarmOption === '1h') {
      alarmTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else if (alarmOption === 'today_evening') {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      alarmTime = d.toISOString();
    }

    await saveLocalTask({
      title: newTitle.trim(),
      color: selectedColor,
      is_completed: false,
      alarm_time: alarmTime,
    });

    setNewTitle('');
    setAlarmOption('none');
    setShowColorPicker(false);
  };

  const handleToggle = async (id: string) => {
    await toggleTaskCompletion(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteLocalTask(id);
  };

  const handleClearCompleted = async () => {
    if (window.confirm('Supprimer définitivement toutes les tâches terminées ?')) {
      for (const t of completedTasks) {
        await deleteLocalTask(t.id);
      }
    }
  };

  return (
    <div
      className={clsx(
        'flex flex-col select-none',
        isCompactInSidebar
          ? 'bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex-1 overflow-hidden min-h-[220px]'
          : 'h-full bg-white border-l border-slate-200'
      )}
    >
      {/* Header To-Do (comme sur le croquis : "To do list") */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              To Do List
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {activeTasks.length} à faire
          </span>

          {onCloseMobileDrawer && (
            <button
              type="button"
              onClick={onCloseMobileDrawer}
              className="md:hidden p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg text-xs"
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Formulaire d'ajout rapide (Quick Add) */}
      <form onSubmit={handleAddTask} className="mb-2">
        <div className="flex items-center gap-1.5">
          {/* Pastille de sélection de couleur */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center transition-transform active:scale-95 shadow-2xs"
              style={{ backgroundColor: selectedColor }}
              title="Matière / Catégorie"
            >
              <Tag className="w-2.5 h-2.5 text-white drop-shadow-xs" />
            </button>

            {showColorPicker && (
              <div className="absolute top-8 left-0 z-30 p-2 bg-white rounded-xl shadow-apple-lg border border-slate-200 grid grid-cols-4 gap-1.5 w-44">
                {MEDICAL_COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.hex);
                      setShowColorPicker(false);
                    }}
                    className="w-7 h-7 rounded-lg transition-transform hover:scale-110 active:scale-90 flex items-center justify-center text-xs"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {c.emoji || <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Champ texte */}
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ajouter une tâche (Anki, fiches, cours)..."
            className="flex-1 px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
          />

          {/* Bouton Ajouter */}
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="p-1.5 rounded-xl bg-indigo-600 text-white disabled:opacity-40 hover:bg-indigo-700 active:scale-95 transition-all shadow-2xs shrink-0"
            title="Ajouter la tâche"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

      {/* Liste défilable des tâches */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin scrollbar-thumb-slate-200">
        {activeTasks.length === 0 && (
          <div className="py-6 px-3 text-center">
            <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-1">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-700">Tout est à jour ! 🎉</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Ajoutez vos tâches de cours, révisions ou stages ci-dessus.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {activeTasks.map((task) => {
            const theme = getColorTheme(task.color);

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                drag="x"
                dragConstraints={{ left: -50, right: 50 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 40) {
                    handleToggle(task.id);
                  } else if (info.offset.x < -40) {
                    deleteLocalTask(task.id);
                  }
                }}
                transition={{ duration: 0.15 }}
                onClick={() => handleToggle(task.id)}
                className="group relative flex items-start gap-2 p-2 rounded-xl bg-slate-50/70 hover:bg-white border border-slate-200/70 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer touch-pan-y active:scale-[0.99]"
                style={{
                  borderLeftWidth: '3.5px',
                  borderLeftColor: theme.borderAccent,
                }}
              >
                {/* Checkbox stylée Apple Reminders */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(task.id);
                  }}
                  className="mt-0.5 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0"
                >
                  <Circle className="w-4 h-4" />
                </button>

                {/* Corps de la tâche */}
                <div className="flex-1 min-w-0 pr-5 select-none pointer-events-none">
                  <p className="text-xs font-medium text-slate-800 leading-snug break-words">
                    {task.title}
                  </p>

                  {task.alarm_time && (
                    <div className="flex items-center gap-1 text-[9px] text-amber-600 font-semibold mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{format(parseISO(task.alarm_time), 'HH:mm dd/MM', { locale: fr })}</span>
                    </div>
                  )}
                </div>

                {/* Bouton de suppression */}
                <button
                  type="button"
                  onClick={(e) => handleDelete(task.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded transition-opacity absolute top-1.5 right-1.5"
                  title="Supprimer la tâche"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Section Accordéon "Terminées" */}
        {completedTasks.length > 0 && (
          <div className="pt-2 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={() => setIsCompletedOpen(!isCompletedOpen)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-600 py-1"
            >
              <span className="flex items-center gap-1">
                {isCompletedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Terminées ({completedTasks.length})
              </span>

              {isCompletedOpen && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearCompleted();
                  }}
                  className="text-[10px] text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  Effacer
                </button>
              )}
            </button>

            {isCompletedOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1 pt-1"
              >
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggle(task.id)}
                    className="group flex items-center gap-2 p-1.5 rounded-lg bg-slate-50/50 border border-slate-100 opacity-60 hover:opacity-90 cursor-pointer transition-opacity"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="flex-1 text-[11px] text-slate-500 line-through truncate">
                      {task.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(task.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
