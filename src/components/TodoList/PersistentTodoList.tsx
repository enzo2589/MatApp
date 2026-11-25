import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveLocalTask, toggleTaskCompletion, deleteLocalTask, getCurrentUserId } from '../../db/localDb';
import { MEDICAL_COLORS } from '../../constants/colors';
import { TaskItem } from '../../types';
import { TaskItemRow } from './TaskItemRow';
import { EditTaskModal } from './EditTaskModal';
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
  Maximize2,
  Minimize2,
  Sparkles,
  Filter,
  Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PersistentTodoListProps {
  userId?: string;
  onCloseMobileDrawer?: () => void;
  isCompactInSidebar?: boolean;
  isExpandedFull?: boolean;
  onToggleExpand?: () => void;
}

const QUICK_SUGGESTIONS = [
  { label: 'Anki 150 cartes', color: '#10B981' },
  { label: 'Fiches EDN', color: '#F59E0B' },
  { label: 'Carnet de stage', color: '#06B6D4' },
  { label: 'QCM annales', color: '#D946EF' },
  { label: 'Polycopié', color: '#4F46E5' },
];

export const PersistentTodoList: React.FC<PersistentTodoListProps> = ({
  userId,
  onCloseMobileDrawer,
  isCompactInSidebar = false,
  isExpandedFull = false,
  onToggleExpand,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(MEDICAL_COLORS[1].hex); // Révisions / Anki par défaut
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAlarmMenu, setShowAlarmMenu] = useState(false);
  const [alarmOption, setAlarmOption] = useState<'none' | '1h' | 'today_evening' | 'tomorrow_morning'>('none');
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'completed'>('all');

  // État de modification d'une tâche
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Live Query Dexie réactif instantané (0 ms) STRICTEMENT filtré par utilisateur
  const activeUserId = userId || getCurrentUserId();
  const allTasks = useLiveQuery(
    () => db.tasks.where('user_id').equals(activeUserId).filter((t) => !t.is_deleted).toArray(),
    [activeUserId]
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
      user_id: activeUserId,
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

  const handleDeleteTask = async (id: string) => {
    await deleteLocalTask(id);
  };

  const handleOpenEdit = (task: TaskItem) => {
    setTaskToEdit(task);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedTask = async (
    taskId: string,
    updates: { title: string; color: string; alarm_time: string | null }
  ) => {
    await saveLocalTask({
      id: taskId,
      user_id: activeUserId,
      title: updates.title,
      color: updates.color,
      alarm_time: updates.alarm_time,
    });
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
        'flex flex-col select-none transition-all',
        isExpandedFull
          ? 'bg-white rounded-3xl p-5 md:p-8 border border-slate-200/90 shadow-md w-full max-w-4xl h-full flex flex-col overflow-hidden'
          : isCompactInSidebar
          ? 'bg-white rounded-2xl p-3 border border-slate-200/80 shadow-xs flex-1 overflow-hidden min-h-[220px]'
          : 'h-full bg-white border-l border-slate-200 p-4'
      )}
    >
      {/* En-tête : Titre, Compteur & Bouton Agrandir/Réduire */}
      <div className={clsx("flex items-center justify-between pb-2 mb-2 border-b border-slate-100", isExpandedFull && "pb-4 mb-4")}>
        <div
          onClick={!isExpandedFull ? onToggleExpand : undefined}
          className={clsx(
            "flex items-center gap-2.5",
            !isExpandedFull && onToggleExpand && "cursor-pointer group"
          )}
          title={!isExpandedFull && onToggleExpand ? "Cliquer pour agrandir la To-Do List en grand format" : undefined}
        >
          <div className={clsx(
            "rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs",
            isExpandedFull ? "w-10 h-10" : "w-6 h-6"
          )}>
            <CheckSquare className={clsx(isExpandedFull ? "w-5 h-5 stroke-[2.2]" : "w-3.5 h-3.5 stroke-[2.2]")} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className={clsx(
                "font-extrabold text-slate-800 tracking-tight",
                isExpandedFull ? "text-lg md:text-xl" : "text-xs",
                !isExpandedFull && onToggleExpand && "group-hover:text-indigo-600 transition-colors"
              )}>
                {isExpandedFull ? "To-Do List & Tâches Étudiant" : "Tâches à faire"}
              </h3>
              <span className={clsx(
                "font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100",
                isExpandedFull ? "text-xs px-2.5 py-0.5" : "text-[10px] px-2 py-0.5"
              )}>
                {activeTasks.length} {isExpandedFull ? 'en attente' : ''}
              </span>
            </div>
            {isExpandedFull && (
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Organisation quotidienne des révisions, cartes Anki, fiches EDN et stages
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton Agrandir / Réduire */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className={clsx(
                "flex items-center gap-1.5 rounded-xl transition-all cursor-pointer shadow-2xs",
                isExpandedFull
                  ? "px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
              )}
              title={isExpandedFull ? "Réduire à la vue normale (Vue d'ensemble)" : "Agrandir la To-Do List en grand format"}
            >
              {isExpandedFull ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Vue d'ensemble</span>
                </>
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}

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
      </div>

      {/* Onglets de filtres en mode plein écran */}
      {isExpandedFull && (
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={clsx(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              filterMode === 'all'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            )}
          >
            Toutes les tâches ({allTasks?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('active')}
            className={clsx(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              filterMode === 'active'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            )}
          >
            En cours ({activeTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('completed')}
            className={clsx(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              filterMode === 'completed'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
            )}
          >
            Terminées ({completedTasks.length})
          </button>
        </div>
      )}

      {/* Formulaire d'ajout rapide */}
      <form onSubmit={handleAddTask} className={clsx("mb-3 space-y-2", isExpandedFull && "mb-5 space-y-2.5")}>
        <div className="flex items-center gap-2">
          {/* Sélecteur de couleur sobre (sans emojis) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowAlarmMenu(false);
              }}
              className={clsx(
                "rounded-full border border-slate-200 flex items-center justify-center transition-transform active:scale-95 shadow-2xs cursor-pointer",
                isExpandedFull ? "w-9 h-9" : "w-6 h-6"
              )}
              style={{ backgroundColor: selectedColor }}
              title="Choisir la couleur / catégorie"
            >
              <span className={clsx("rounded-full bg-white shadow-xs", isExpandedFull ? "w-2.5 h-2.5" : "w-1.5 h-1.5")} />
            </button>

            {showColorPicker && (
              <div className="absolute top-10 left-0 z-30 p-2 bg-white rounded-xl shadow-lg border border-slate-200 grid grid-cols-4 gap-1.5 w-44">
                {MEDICAL_COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.hex);
                      setShowColorPicker(false);
                    }}
                    className="w-8 h-8 rounded-lg transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor === c.hex && <Check className="w-4 h-4 text-white" />}
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
            placeholder={isExpandedFull ? "Ajouter une nouvelle tâche (ex: Revoir Anki Cardio, Fiche EDN Pneumo, Stage...)" : "Nouvelle tâche (Anki, fiches, cours)..."}
            className={clsx(
              "flex-1 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal text-slate-800",
              isExpandedFull ? "px-4 py-2.5 text-sm rounded-2xl" : "px-3 py-1.5 text-xs rounded-xl"
            )}
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
                'border transition-all cursor-pointer',
                isExpandedFull ? 'p-2.5 rounded-2xl' : 'p-1.5 rounded-xl',
                alarmOption !== 'none'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
              )}
              title="Ajouter un rappel"
            >
              <Clock className={clsx(isExpandedFull ? "w-4 h-4" : "w-3.5 h-3.5")} />
            </button>

            {showAlarmMenu && (
              <div className="absolute top-10 right-0 z-30 p-1.5 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col gap-1 w-40 text-xs">
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
            className={clsx(
              "bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-700 active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer flex items-center gap-1.5 font-bold",
              isExpandedFull ? "px-4 py-2.5 rounded-2xl text-sm" : "p-1.5 rounded-xl"
            )}
            title="Ajouter la tâche"
          >
            <Plus className={clsx(isExpandedFull ? "w-4 h-4" : "w-3.5 h-3.5")} />
            {isExpandedFull && <span className="hidden sm:inline">Ajouter</span>}
          </button>
        </div>

        {/* Suggestions rapides sobres (sans emojis) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5 scrollbar-none">
          <span className={clsx("font-semibold text-slate-400 shrink-0", isExpandedFull ? "text-xs" : "text-[10px]")}>
            Suggestions :
          </span>
          {QUICK_SUGGESTIONS.map((sug) => (
            <button
              key={sug.label}
              type="button"
              onClick={() => {
                saveLocalTask({
                  user_id: activeUserId,
                  title: sug.label,
                  color: sug.color,
                  is_completed: false,
                });
              }}
              className={clsx(
                "shrink-0 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 font-medium transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer",
                isExpandedFull ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
              )}
            >
              <span className={clsx("rounded-full shrink-0", isExpandedFull ? "w-2 h-2" : "w-1.5 h-1.5")} style={{ backgroundColor: sug.color }} />
              <span>{sug.label}</span>
            </button>
          ))}
        </div>
      </form>

      {/* Liste des tâches */}
      <div className={clsx(
        "flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 touch-pan-y",
        isExpandedFull ? "space-y-2.5" : "space-y-1.5"
      )}>
        {/* État vide si aucune tâche active */}
        {filterMode !== 'completed' && activeTasks.length === 0 && (
          <div className={clsx("text-center", isExpandedFull ? "py-12 px-4" : "py-6 px-3")}>
            <div className={clsx(
              "rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-2",
              isExpandedFull ? "w-12 h-12" : "w-8 h-8"
            )}>
              <CheckSquare className={clsx(isExpandedFull ? "w-6 h-6 stroke-[2]" : "w-4 h-4")} />
            </div>
            <p className={clsx("font-bold text-slate-700", isExpandedFull ? "text-base" : "text-xs")}>
              Aucune tâche en attente
            </p>
            <p className={clsx("text-slate-400 mt-0.5", isExpandedFull ? "text-xs max-w-sm mx-auto" : "text-[10px]")}>
              Toutes vos révisions et activités médicales sont à jour !
            </p>
          </div>
        )}

        {/* Liste des tâches actives (affichée si mode 'all' ou 'active') */}
        {filterMode !== 'completed' && (
          <AnimatePresence initial={false}>
            {activeTasks.map((task) => (
              <TaskItemRow
                key={task.id}
                task={task}
                isExpandedFull={isExpandedFull}
                onToggle={handleToggle}
                onDelete={handleDeleteTask}
                onEdit={handleOpenEdit}
              />
            ))}
          </AnimatePresence>
        )}

        {/* Section Accordéon "Terminées" */}
        {completedTasks.length > 0 && (
          <div className={clsx("border-t border-slate-100", isExpandedFull ? "pt-4 mt-4" : "pt-2 mt-2")}>
            <button
              type="button"
              onClick={() => setIsCompletedOpen(!isCompletedOpen)}
              className={clsx(
                "w-full flex items-center justify-between text-slate-400 hover:text-slate-600 py-1 cursor-pointer font-bold",
                isExpandedFull ? "text-xs md:text-sm" : "text-[11px]"
              )}
            >
              <span className="flex items-center gap-1.5">
                {isCompletedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Tâches terminées ({completedTasks.length})
              </span>

              {isCompletedOpen && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearCompleted();
                  }}
                  className="text-xs text-slate-400 hover:text-red-500 font-semibold px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                >
                  Tout effacer
                </button>
              )}
            </button>

            {(isCompletedOpen || filterMode === 'completed') && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={clsx("space-y-1.5 pt-2", isExpandedFull && "space-y-2")}
              >
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={clsx(
                      "group flex items-center gap-2 rounded-xl bg-slate-50/60 border border-slate-100 opacity-60 hover:opacity-90 transition-opacity",
                      isExpandedFull ? "p-3" : "p-1.5"
                    )}
                  >
                    {/* Case à cocher pour réactiver la tâche */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(task.id);
                      }}
                      className="text-emerald-600 hover:text-slate-400 active:scale-90 transition-all cursor-pointer shrink-0 rounded-full p-1 -m-1 focus:outline-none"
                      title="Cliquer sur le rond pour réactiver la tâche"
                    >
                      <CheckCircle2 className={clsx(isExpandedFull ? "w-4 h-4" : "w-3.5 h-3.5")} />
                    </button>

                    <span className={clsx(
                      "flex-1 text-slate-500 line-through truncate select-none",
                      isExpandedFull ? "text-sm" : "text-[11px]"
                    )}>
                      {task.title}
                    </span>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(task);
                        }}
                        className={clsx(
                          "transition-all text-slate-300 hover:text-indigo-600 rounded-lg cursor-pointer",
                          isExpandedFull ? "opacity-60 hover:opacity-100 p-1.5 hover:bg-indigo-50" : "opacity-40 hover:opacity-100 p-1 hover:bg-indigo-50"
                        )}
                        title="Modifier"
                      >
                        <Pencil className={clsx(isExpandedFull ? "w-4 h-4" : "w-3 h-3")} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className={clsx(
                          "transition-all text-slate-300 hover:text-red-500 rounded-lg cursor-pointer",
                          isExpandedFull ? "opacity-60 hover:opacity-100 p-1.5 hover:bg-red-50" : "opacity-40 hover:opacity-100 p-1 hover:bg-red-50"
                        )}
                        title="Supprimer"
                      >
                        <Trash2 className={clsx(isExpandedFull ? "w-4 h-4" : "w-3 h-3")} />
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Modal de modification de tâche */}
      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setTaskToEdit(null);
        }}
        task={taskToEdit}
        onSave={handleSaveEditedTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
};
