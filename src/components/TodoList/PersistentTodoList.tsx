import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveLocalTask, toggleTaskCompletion, deleteLocalTask, getCurrentUserId } from '../../db/localDb';
import { MEDICAL_COLORS } from '../../constants/colors';
import { TaskItem } from '../../types';
import { TaskItemRow } from './TaskItemRow';
import { EditTaskModal } from './EditTaskModal';
import {
  getTaskSuggestions,
  addTaskSuggestion,
  deleteTaskSuggestion,
  subscribePreferences,
  TaskSuggestion,
} from '../../services/studentPreferences';
import {
  CheckCircle2,
  Plus,
  Trash2,
  ChevronRight,
  Clock,
  Check,
  Maximize2,
  Minimize2,
  Pencil,
  Star,
  BookmarkPlus,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface PersistentTodoListProps {
  userId?: string;
  onCloseMobileDrawer?: () => void;
  isCompactInSidebar?: boolean;
  isExpandedFull?: boolean;
  onToggleExpand?: () => void;
}

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

  // Suggestions personnalisables persistantes
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>(() => getTaskSuggestions());

  useEffect(() => {
    return subscribePreferences(() => {
      setSuggestions(getTaskSuggestions());
    });
  }, []);

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

  // Vérifier si le titre actuel est déjà dans les suggestions
  const isCurrentTitleInSuggestions = suggestions.some(
    (s) => s.label.toLowerCase() === newTitle.trim().toLowerCase()
  );

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

  // Gestion des suggestions : Ajouter / Retirer
  const handleToggleSaveSuggestion = () => {
    if (!newTitle.trim()) return;
    if (isCurrentTitleInSuggestions) {
      const existing = suggestions.find(
        (s) => s.label.toLowerCase() === newTitle.trim().toLowerCase()
      );
      if (existing) {
        deleteTaskSuggestion(existing.id);
      }
    } else {
      addTaskSuggestion({
        label: newTitle.trim(),
        color: selectedColor,
      });
    }
  };

  const handleDeleteSuggestion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTaskSuggestion(id);
  };

  const handleApplySuggestion = async (sug: TaskSuggestion) => {
    await saveLocalTask({
      user_id: activeUserId,
      title: sug.label,
      color: sug.color,
      is_completed: false,
    });
  };

  return (
    <div
      className={clsx(
        'flex flex-col select-none transition-all',
        isExpandedFull
          ? 'bg-white rounded-[28px] p-6 md:p-8 border border-slate-200/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-4xl h-full flex flex-col overflow-hidden'
          : isCompactInSidebar
          ? 'bg-white rounded-2xl p-3 border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex-1 overflow-hidden min-h-[220px]'
          : 'h-full bg-white border-l border-slate-200 p-4'
      )}
    >
      {/* En-tête : Style Apple Reminders épuré */}
      <div className={clsx("flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100", isExpandedFull && "pb-4 mb-4")}>
        <div
          onClick={!isExpandedFull ? onToggleExpand : undefined}
          className={clsx(
            "flex items-center gap-2.5",
            !isExpandedFull && onToggleExpand && "cursor-pointer group"
          )}
          title={!isExpandedFull && onToggleExpand ? "Agrandir en grand format" : undefined}
        >
          <div className={clsx(
            "rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0",
            isExpandedFull ? "w-9 h-9" : "w-6 h-6"
          )}>
            <CheckCircle2 className={clsx(isExpandedFull ? "w-5 h-5 stroke-[2.2]" : "w-3.5 h-3.5 stroke-[2.2]")} />
          </div>

          <div className="flex items-center gap-2">
            <h3 className={clsx(
              "font-semibold text-slate-900 tracking-tight",
              isExpandedFull ? "text-lg md:text-xl" : "text-xs",
              !isExpandedFull && onToggleExpand && "group-hover:text-indigo-600 transition-colors"
            )}>
              {isExpandedFull ? "To-Do List" : "Tâches à faire"}
            </h3>
            <span className={clsx(
              "font-semibold rounded-full bg-slate-100 text-slate-600",
              isExpandedFull ? "text-xs px-2.5 py-0.5" : "text-[10px] px-2 py-0.5"
            )}>
              {activeTasks.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Control iOS en mode grand format */}
          {isExpandedFull && (
            <div className="inline-flex p-1 rounded-xl bg-slate-100/80 border border-slate-200/50 gap-0.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs transition-all cursor-pointer",
                  filterMode === 'all'
                    ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-slate-500 hover:text-slate-800 font-medium"
                )}
              >
                Toutes ({allTasks?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('active')}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs transition-all cursor-pointer",
                  filterMode === 'active'
                    ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-slate-500 hover:text-slate-800 font-medium"
                )}
              >
                En cours ({activeTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('completed')}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs transition-all cursor-pointer",
                  filterMode === 'completed'
                    ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-slate-500 hover:text-slate-800 font-medium"
                )}
              >
                Terminées ({completedTasks.length})
              </button>
            </div>
          )}

          {/* Bouton Agrandir / Réduire */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className={clsx(
                "rounded-xl transition-all cursor-pointer flex items-center justify-center",
                isExpandedFull
                  ? "px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200/70 text-slate-700"
                  : "w-7 h-7 text-slate-400 hover:text-slate-800 hover:bg-slate-100"
              )}
              title={isExpandedFull ? "Réduire à la vue normale" : "Agrandir en plein écran"}
            >
              {isExpandedFull ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Réduire</span>
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
              className="md:hidden text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Barre de saisie unifiée Style Apple */}
      <form onSubmit={handleAddTask} className="mb-2.5 space-y-2">
        <div className="relative flex items-center bg-slate-100/70 hover:bg-slate-100/90 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400/70 border border-slate-200/50 rounded-2xl p-1.5 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
          {/* Sélecteur de couleur sobre Apple */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowAlarmMenu(false);
              }}
              className={clsx(
                "rounded-xl border border-white/90 shadow-xs flex items-center justify-center transition-transform active:scale-90 cursor-pointer",
                isExpandedFull ? "w-8 h-8" : "w-6 h-6"
              )}
              style={{ backgroundColor: selectedColor }}
              title="Choisir la catégorie / couleur"
            >
              <span className={clsx("rounded-full bg-white shadow-xs", isExpandedFull ? "w-2 h-2" : "w-1.5 h-1.5")} />
            </button>

            {showColorPicker && (
              <div className="absolute top-10 left-0 z-30 p-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 grid grid-cols-4 gap-2 w-48">
                {MEDICAL_COLORS.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedColor(c.hex);
                      setShowColorPicker(false);
                    }}
                    className="w-9 h-9 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer shadow-xs"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor === c.hex && <Check className="w-4 h-4 text-white stroke-[2.5]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Champ de saisie Apple */}
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={isExpandedFull ? "Ajouter une tâche (ex: Revoir Anki Cardio, Fiche EDN, Stage...)" : "Nouvelle tâche..."}
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-slate-850 placeholder:text-slate-400 font-normal text-xs md:text-sm px-2.5"
          />

          {/* Actions rapides intégrées */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Bouton Épingler aux suggestions (Ajouter / Retirer) */}
            {newTitle.trim().length > 1 && (
              <button
                type="button"
                onClick={handleToggleSaveSuggestion}
                className={clsx(
                  "p-1.5 rounded-xl transition-all cursor-pointer active:scale-90 flex items-center justify-center",
                  isCurrentTitleInSuggestions
                    ? "text-amber-500 bg-amber-50"
                    : "text-slate-400 hover:text-amber-500 hover:bg-slate-200/60"
                )}
                title={
                  isCurrentTitleInSuggestions
                    ? "Retirer des suggestions rapides"
                    : "Épingler cette tâche dans les suggestions rapides"
                }
              >
                <Star className={clsx("w-4 h-4", isCurrentTitleInSuggestions && "fill-amber-400")} />
              </button>
            )}

            {/* Bouton de rappel discret */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAlarmMenu(!showAlarmMenu);
                  setShowColorPicker(false);
                }}
                className={clsx(
                  'p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center',
                  alarmOption !== 'none'
                    ? 'text-amber-700 bg-amber-50 border border-amber-200/70'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                )}
                title="Définir un rappel"
              >
                <Clock className="w-4 h-4" />
              </button>

              {showAlarmMenu && (
                <div className="absolute top-10 right-0 z-30 p-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/80 flex flex-col gap-1 w-44 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => {
                      setAlarmOption('none');
                      setShowAlarmMenu(false);
                    }}
                    className={clsx(
                      'px-3 py-1.5 text-left rounded-xl transition-colors',
                      alarmOption === 'none' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
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
                      'px-3 py-1.5 text-left rounded-xl transition-colors',
                      alarmOption === '1h' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
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
                      'px-3 py-1.5 text-left rounded-xl transition-colors',
                      alarmOption === 'today_evening' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
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
                      'px-3 py-1.5 text-left rounded-xl transition-colors',
                      alarmOption === 'tomorrow_morning' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    Demain (08h)
                  </button>
                </div>
              )}
            </div>

            {/* Bouton Ajouter Apple SF */}
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="w-7 h-7 rounded-xl bg-slate-900 disabled:opacity-20 hover:bg-black text-white flex items-center justify-center transition-all active:scale-90 shadow-xs cursor-pointer disabled:cursor-not-allowed"
              title="Ajouter la tâche"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Pilules de suggestions Apple épurées avec bouton de suppression */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          <span className="text-[10.5px] font-medium text-slate-400 shrink-0 select-none">
            Suggestions :
          </span>

          {suggestions.map((sug) => (
            <div
              key={sug.id}
              onClick={() => handleApplySuggestion(sug)}
              className="group/pill inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200/70 border border-slate-200/40 text-slate-700 text-xs font-medium transition-all active:scale-95 cursor-pointer shrink-0 select-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              title={`Ajouter "${sug.label}"`}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sug.color }} />
              <span className="truncate max-w-[150px]">{sug.label}</span>
              <button
                type="button"
                onClick={(e) => handleDeleteSuggestion(sug.id, e)}
                className="opacity-40 hover:opacity-100 hover:text-red-500 rounded-full p-0.5 transition-all cursor-pointer ml-0.5 hover:bg-white/80"
                title="Supprimer cette suggestion"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Raccourci pour épingler le titre saisi s'il n'est pas encore dans les suggestions */}
          {newTitle.trim().length > 1 && !isCurrentTitleInSuggestions && (
            <button
              type="button"
              onClick={handleToggleSaveSuggestion}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50/70 text-xs font-medium transition-all active:scale-95 cursor-pointer shrink-0"
              title={`Ajouter "${newTitle.trim()}" aux suggestions`}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Épingler "{newTitle.trim().slice(0, 14)}{newTitle.trim().length > 14 ? '...' : ''}"</span>
            </button>
          )}
        </div>
      </form>

      {/* Liste des tâches */}
      <div className={clsx(
        "flex-1 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200 touch-pan-y",
        isExpandedFull ? "space-y-2.5" : "space-y-1.5"
      )}>
        {/* État vide sobre Apple */}
        {filterMode !== 'completed' && activeTasks.length === 0 && (
          <div className={clsx("text-center flex flex-col items-center justify-center", isExpandedFull ? "py-16 px-4" : "py-8 px-3")}>
            <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-300 mb-2">
              <Check className="w-5 h-5 stroke-[2]" />
            </div>
            <p className="font-medium text-slate-700 text-xs md:text-sm">
              Aucune tâche en attente
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Ajoutez une tâche ci-dessus ou via les suggestions rapides.
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

        {/* Section Accordéon "Terminées" Apple Reminders */}
        {completedTasks.length > 0 && (
          <div className="border-t border-slate-100 pt-3 mt-3">
            <div className="flex items-center justify-between py-1 text-slate-400">
              <button
                type="button"
                onClick={() => setIsCompletedOpen(!isCompletedOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold hover:text-slate-600 transition-colors cursor-pointer select-none"
              >
                <ChevronRight className={clsx("w-3.5 h-3.5 transition-transform duration-200", isCompletedOpen && "rotate-90")} />
                <span>Terminées · {completedTasks.length}</span>
              </button>

              {isCompletedOpen && (
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  className="text-[11px] text-slate-400 hover:text-red-500 font-medium px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Tout effacer
                </button>
              )}
            </div>

            {isCompletedOpen && (
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
                      "group flex items-center gap-2.5 rounded-xl bg-slate-50/70 border border-slate-100/80 transition-all",
                      isExpandedFull ? "p-3" : "p-2"
                    )}
                  >
                    {/* Case à cocher circulaire Apple pour réactiver */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(task.id);
                      }}
                      className="w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-85 transition-all shadow-2xs"
                      title="Réactiver la tâche"
                    >
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </button>

                    <span className={clsx(
                      "flex-1 text-slate-400 line-through truncate select-none font-normal",
                      isExpandedFull ? "text-sm" : "text-xs"
                    )}>
                      {task.title}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(task);
                        }}
                        className="text-slate-300 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-all cursor-pointer opacity-40 hover:opacity-100"
                        title="Modifier"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className="text-slate-300 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-all cursor-pointer opacity-40 hover:opacity-100"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
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
