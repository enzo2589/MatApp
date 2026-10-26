import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveLocalTask, toggleTaskCompletion, deleteLocalTask } from '../../db/localDb';
import { MEDICAL_COLORS, getColorTheme } from '../../constants/colors';
import { alarmService } from '../../services/alarmService';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  Check,
  CheckSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PersistentTodoListProps {
  onCloseMobileDrawer?: () => void;
  isCompactInSidebar?: boolean;
}

const QUICK_SUGGESTIONS = [
  { label: 'Anki 150 cartes', color: '#10B981' },
  { label: 'Fiches EDN', color: '#F59E0B' },
  { label: 'Carnet de stage', color: '#06B6D4' },
  { label: 'QCM annales', color: '#D946EF' },
  { label: 'Polycopié', color: '#4F46E5' },
];

export const PersistentTodoList: React.FC<PersistentTodoListProps> = ({
  onCloseMobileDrawer,
  isCompactInSidebar = false,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(MEDICAL_COLORS[1].hex); // Révisions / Anki par défaut
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAlarmMenu, setShowAlarmMenu] = useState(false);
  const [alarmOption, setAlarmOption] = useState<'none' | '1h' | 'today_evening' | 'tomorrow_morning'>('none');
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);

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
    const now = new Date();
    if (alarmOption === '1h') {
      alarmTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (alarmOption === 'today_evening') {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      alarmTime = d.toISOString();
    } else if (alarmOption === 'tomorrow_morning') {
      const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      d.setHours(8, 0, 0, 0);
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
    setShowAlarmMenu(false);
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
          : 'h-full bg-white border-l border-slate-200 p-4'
      )}
    >
      {/* En-tête sobre et naturel */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckSquare className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold text-slate-800">
            Tâches à faire
          </h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {activeTasks.length}
          </span>
        </div>

        {onCloseMobileDrawer && (
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            className="md:hidden text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Fermer
          </button>
        )}
      </div>

      {/* Formulaire d'ajout rapide */}
      <form onSubmit={handleAddTask} className="mb-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5">
          {/* Sélecteur de couleur sobre (sans emojis) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowAlarmMenu(false);
              }}
              className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center transition-transform active:scale-95 shadow-2xs"
              style={{ backgroundColor: selectedColor }}
              title="Choisir la catégorie"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
            </button>

            {showColorPicker && (
              <div className="absolute top-8 left-0 z-30 p-2 bg-white rounded-xl shadow-lg border border-slate-200 grid grid-cols-4 gap-1.5 w-40">
                {MEDICAL_COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.hex);
                      setShowColorPicker(false);
                    }}
                    className="w-7 h-7 rounded-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Champ de saisie */}
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nouvelle tâche (Anki, fiches, cours)..."
            className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal text-slate-800"
          />

          {/* Bouton de rappel rapide */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowAlarmMenu(!showAlarmMenu);
                setShowColorPicker(false);
              }}
              className={clsx(
                'p-1.5 rounded-xl border transition-all',
                alarmOption !== 'none'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
              )}
              title="Ajouter un rappel"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>

            {showAlarmMenu && (
              <div className="absolute top-8 right-0 z-30 p-1.5 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col gap-1 w-36 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAlarmOption('none');
                    setShowAlarmMenu(false);
                  }}
                  className={clsx(
                    'px-2.5 py-1 text-left rounded-lg transition-colors font-medium',
                    alarmOption === 'none' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  )}
                >
                  Sans rappel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAlarmOption('1h');
                    setShowAlarmMenu(false);
                  }}
                  className={clsx(
                    'px-2.5 py-1 text-left rounded-lg transition-colors font-medium',
                    alarmOption === '1h' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  )}
                >
                  Dans 1 heure
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAlarmOption('today_evening');
                    setShowAlarmMenu(false);
                  }}
                  className={clsx(
                    'px-2.5 py-1 text-left rounded-lg transition-colors font-medium',
                    alarmOption === 'today_evening' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  )}
                >
                  Ce soir (18h)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAlarmOption('tomorrow_morning');
                    setShowAlarmMenu(false);
                  }}
                  className={clsx(
                    'px-2.5 py-1 text-left rounded-lg transition-colors font-medium',
                    alarmOption === 'tomorrow_morning' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  )}
                >
                  Demain (08h)
                </button>
              </div>
            )}
          </div>

          {/* Bouton Ajouter */}
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="p-1.5 rounded-xl bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-700 active:scale-95 transition-all shadow-2xs shrink-0"
            title="Ajouter"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Suggestions rapides sobres (sans emojis) */}
        <div className="flex items-center gap-1 overflow-x-auto pt-0.5 scrollbar-none">
          <span className="text-[10px] font-medium text-slate-400 shrink-0">Suggestions :</span>
          {QUICK_SUGGESTIONS.map((sug) => (
            <button
              key={sug.label}
              type="button"
              onClick={() => {
                saveLocalTask({
                  title: sug.label,
                  color: sug.color,
                  is_completed: false,
                });
              }}
              className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 text-[10px] font-medium transition-all active:scale-95 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sug.color }} />
              <span>{sug.label}</span>
            </button>
          ))}
        </div>
      </form>

      {/* Liste des tâches */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-thin scrollbar-thumb-slate-200">
        {activeTasks.length === 0 && (
          <div className="py-6 px-3 text-center">
            <p className="text-xs font-semibold text-slate-600">Aucune tâche en attente</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Toutes vos révisions et activités sont à jour.
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
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                drag="x"
                dragConstraints={{ left: -40, right: 40 }}
                dragElastic={0.15}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 35) {
                    handleToggle(task.id);
                  } else if (info.offset.x < -35) {
                    deleteLocalTask(task.id);
                  }
                }}
                transition={{ duration: 0.15 }}
                onClick={() => handleToggle(task.id)}
                className="group relative flex items-start gap-2 p-2 rounded-xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-2xs transition-all cursor-pointer touch-pan-y active:scale-[0.99]"
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: theme.borderAccent || theme.hex,
                }}
              >
                {/* Case à cocher circulaire */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(task.id);
                  }}
                  className="mt-0.5 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0"
                >
                  <Circle className="w-4 h-4 stroke-[1.8]" />
                </button>

                {/* Corps de la tâche */}
                <div className="flex-1 min-w-0 pr-4 select-none">
                  <p className="text-xs font-medium text-slate-800 leading-snug break-words">
                    {task.title}
                  </p>

                  {task.alarm_time && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-700 font-medium mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-amber-600" />
                      <span>{format(parseISO(task.alarm_time), 'HH:mm dd/MM', { locale: fr })}</span>
                    </div>
                  )}
                </div>

                {/* Bouton de suppression */}
                <button
                  type="button"
                  onClick={(e) => handleDelete(task.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded transition-opacity absolute top-1 right-1"
                  title="Supprimer"
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
              className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-600 py-1"
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
                  className="text-[10px] text-slate-400 hover:text-red-500 font-medium transition-colors"
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
                    className="group flex items-center gap-2 p-1.5 rounded-lg bg-slate-50/60 border border-slate-100 opacity-60 hover:opacity-90 cursor-pointer transition-opacity"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="flex-1 text-[11px] text-slate-500 line-through truncate">
                      {task.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(task.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 p-0.5 transition-opacity"
                      title="Supprimer"
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
