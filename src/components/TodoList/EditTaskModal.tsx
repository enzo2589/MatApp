import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Clock, Check, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { TaskItem } from '../../types';
import { MEDICAL_COLORS } from '../../constants/colors';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  onSave: (taskId: string, updates: { title: string; color: string; alarm_time: string | null }) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(MEDICAL_COLORS[1].hex);
  const [alarmOption, setAlarmOption] = useState<'none' | '1h' | 'today_evening' | 'tomorrow_morning' | 'custom'>('none');
  const [customAlarmTime, setCustomAlarmTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title);
      setColor(task.color || MEDICAL_COLORS[1].hex);

      if (task.alarm_time) {
        setAlarmOption('custom');
        try {
          const date = new Date(task.alarm_time);
          const formatted = format(date, "yyyy-MM-dd'T'HH:mm");
          setCustomAlarmTime(formatted);
        } catch {
          setCustomAlarmTime('');
        }
      } else {
        setAlarmOption('none');
        setCustomAlarmTime('');
      }

      // Autofocus le champ de saisie
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
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
      } else if (alarmOption === 'custom' && customAlarmTime) {
        alarmTime = new Date(customAlarmTime).toISOString();
      }

      await onSave(task.id, {
        title: title.trim(),
        color,
        alarm_time: alarmTime,
      });

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Supprimer cette tâche ?')) {
      setIsSubmitting(true);
      try {
        await onDelete(task.id);
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-[28px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-200/80 w-full max-w-lg overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Pencil className="w-4.5 h-4.5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">Modifier la tâche</h3>
                <p className="text-xs text-slate-400">Ajustez le titre, la catégorie ou le rappel</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5 flex-1 overflow-y-auto">
            {/* Titre */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Titre de la tâche
              </label>
              <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Réviser Cardiologie EDN, Flashcards Anki..."
                className="w-full bg-slate-100/70 border border-slate-200/60 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 rounded-2xl px-4 py-2.5 text-sm text-slate-850 font-normal transition-all outline-none"
              />
            </div>

            {/* Catégories / Couleurs */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Catégorie & Couleur
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MEDICAL_COLORS.slice(0, 8).map((c) => {
                  const isSelected = color === c.hex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      className={clsx(
                        "flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer active:scale-95",
                        isSelected
                          ? "border-slate-850 bg-slate-50 shadow-xs"
                          : "border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/50"
                      )}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center shadow-2xs"
                        style={{ backgroundColor: c.hex }}
                      >
                        {isSelected && <Check className="w-2 h-2 text-white stroke-[3]" />}
                      </span>
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rappel / Alarme */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Rappel & Notification
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setAlarmOption('none')}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                    alarmOption === 'none'
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Sans rappel
                </button>
                <button
                  type="button"
                  onClick={() => setAlarmOption('1h')}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                    alarmOption === '1h'
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Dans 1 heure
                </button>
                <button
                  type="button"
                  onClick={() => setAlarmOption('today_evening')}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                    alarmOption === 'today_evening'
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Ce soir (18h)
                </button>
                <button
                  type="button"
                  onClick={() => setAlarmOption('tomorrow_morning')}
                  className={clsx(
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                    alarmOption === 'tomorrow_morning'
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  Demain (8h)
                </button>
              </div>

              {/* Date & heure personnalisée */}
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="datetime-local"
                    value={customAlarmTime}
                    onChange={(e) => {
                      setCustomAlarmTime(e.target.value);
                      if (e.target.value) setAlarmOption('custom');
                    }}
                    className={clsx(
                      "flex-1 bg-slate-50 border rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all",
                      alarmOption === 'custom'
                        ? "border-indigo-400 bg-white ring-2 ring-indigo-500/15"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  />
                  {customAlarmTime && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAlarmTime('');
                        setAlarmOption('none');
                      }}
                      className="text-xs text-slate-400 hover:text-red-500 px-2 py-1"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 text-xs font-medium text-[#FF3B30] hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-black text-white shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-30"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
