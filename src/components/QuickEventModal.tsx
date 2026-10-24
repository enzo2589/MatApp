import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Clock, Bell, Tag, AlignLeft, Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { EventItem } from '../types';
import { MEDICAL_COLORS, getColorTheme } from '../constants/colors';
import { TimePicker5Min } from './TimePicker5Min';
import { format, parseISO, addHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { fr } from 'date-fns/locale';

interface QuickEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Partial<EventItem> | null;
  onSave: (eventData: Partial<EventItem>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const STUDENT_SHORTCUT_TEMPLATES = [
  { title: 'Cours Amphi Faculté', color: 'cours', emoji: '📚', durationMinutes: 120 },
  { title: 'Révisions Anki & Fiches', color: 'revisions', emoji: '🧠', durationMinutes: 90 },
  { title: 'BU Santé Focus', color: 'bu', emoji: '📖', durationMinutes: 180 },
  { title: 'Stage Externe Hôpital', color: 'stage', emoji: '🏥', durationMinutes: 240 },
  { title: 'ED & Tutorat', color: 'tutorat', emoji: '👥', durationMinutes: 120 },
  { title: 'Sport Décompression', color: 'sport', emoji: '🏃', durationMinutes: 90 },
  { title: 'Pause Déj & Café', color: 'pause', emoji: '☕', durationMinutes: 60 },
  { title: 'Garde Urgences Externe', color: 'garde', emoji: '🚨', durationMinutes: 720 },
  { title: 'Partiels / Concours Blanc', color: 'examen', emoji: '📝', durationMinutes: 180 },
  { title: 'Repos & Sommeil Réparateur', color: 'repos', emoji: '🛌', durationMinutes: 120 },
];

const ALARM_PRESETS = [
  { label: "À l'heure", minutes: 0 },
  { label: '5 min avant', minutes: 5 },
  { label: '10 min avant', minutes: 10 },
  { label: '15 min avant', minutes: 15 },
  { label: '30 min avant', minutes: 30 },
  { label: '1h avant', minutes: 60 },
];

export const QuickEventModal: React.FC<QuickEventModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('cours');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [alarms, setAlarms] = useState<number[]>([15]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Synchronisation des données initiales à l'ouverture
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setColor(initialData.color || 'cours');
        setAlarms(initialData.alarms && initialData.alarms.length > 0 ? initialData.alarms : [15]);

        const start = initialData.start_time
          ? initialData.start_time
          : roundToNearest5Minutes(new Date()).toISOString();
        const end = initialData.end_time
          ? initialData.end_time
          : addHours(parseISO(start), 1.5).toISOString();

        setStartTime(start);
        setEndTime(end);
      } else {
        const nowSnap = roundToNearest5Minutes(new Date());
        setTitle('');
        setDescription('');
        setColor('cours');
        setAlarms([15]);
        setStartTime(nowSnap.toISOString());
        setEndTime(addHours(nowSnap, 1.5).toISOString());
      }

      // Auto-focus avec léger délai pour l'animation
      setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 80);
    }
  }, [isOpen, initialData]);

  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
  };

  const toggleAlarm = (minutes: number) => {
    setAlarms((prev) =>
      prev.includes(minutes) ? prev.filter((m) => m !== minutes) : [...prev, minutes].sort((a, b) => a - b)
    );
  };

  const applyTemplate = (template: typeof STUDENT_SHORTCUT_TEMPLATES[0]) => {
    setTitle(template.title);
    setColor(template.color);
    if (startTime) {
      const start = parseISO(startTime);
      const newEnd = new Date(start.getTime() + template.durationMinutes * 60000);
      setEndTime(newEnd.toISOString());
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSave({
        id: initialData?.id,
        title: title.trim(),
        description: description.trim(),
        color,
        start_time: startTime,
        end_time: endTime,
        alarms,
      });
      onClose();
    } catch (err) {
      console.error('Erreur sauvegarde événement:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id || !onDelete) return;
    if (window.confirm('Supprimer cet événement du planning ?')) {
      await onDelete(initialData.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentColorTheme = getColorTheme(color);
  const formattedDate = startTime ? format(parseISO(startTime), 'EEEE d MMMM yyyy', { locale: fr }) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-sm select-none">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="w-full max-w-xl bg-white rounded-t-3xl md:rounded-3xl shadow-apple-lg flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
      >
        {/* Header de la modal */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b transition-colors"
          style={{
            backgroundColor: currentColorTheme.bgPastel,
            borderBottomColor: currentColorTheme.badgeBg,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{currentColorTheme.emoji || '📌'}</span>
            <div>
              <h3 className="text-base font-bold text-slate-900 capitalize">
                {initialData?.id ? 'Modifier l’activité' : 'Ajouter une activité'}
              </h3>
              <p className="text-xs text-slate-500 font-medium capitalize">
                {formattedDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-black/5 rounded-full transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Titre avec Auto-Focus & Shortcuts étudiants en médecine */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Intitulé de l’activité *
              </label>
              <span className="text-[10px] text-slate-400">Moins de 3 sec</span>
            </div>

            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex: Cours Cardio (Item 228), Anki Infectio, Stage..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="w-full px-3.5 py-2.5 text-sm font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
            />

            {/* Raccourcis étudiants en 1 tap */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 scrollbar-none">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                <Sparkles className="w-3 h-3 text-indigo-500" /> Raccourcis :
              </span>
              {STUDENT_SHORTCUT_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition-colors active:scale-95 flex items-center gap-1"
                >
                  <span>{tmpl.emoji}</span>
                  <span>{tmpl.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sélecteur Horaire Stricte 5 Minutes */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Horaires & Durée (Paliers stricts de 5 min)
            </label>
            <TimePicker5Min
              startTime={startTime}
              endTime={endTime}
              onChange={handleTimeChange}
              baseDate={startTime ? parseISO(startTime) : new Date()}
            />
          </div>

          {/* Palette de Couleurs & Matières Étudiantes (1 Tap) */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Catégorie / Thème
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MEDICAL_COLORS.map((col) => {
                const isSelected = color === col.id || color === col.hex;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setColor(col.id)}
                    className={clsx(
                      'flex items-center gap-2 p-2 rounded-xl border text-left transition-all touch-manipulation',
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 shadow-xs bg-indigo-50/50 font-bold'
                        : 'border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-base">{col.emoji || '📌'}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                        {col.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {col.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alarmes et Rappels multiples (1 Tap) */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-indigo-600" />
              Rappels & Alarmes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALARM_PRESETS.map((preset) => {
                const isSelected = alarms.includes(preset.minutes);
                return (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => toggleAlarm(preset.minutes)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all touch-manipulation flex items-center gap-1.5',
                      isSelected
                        ? 'bg-red-500 text-white shadow-xs ring-1 ring-red-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes rapides / Description */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-indigo-600" />
              Notes / Salle / Poly (Optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: Amphi B, Items à préparer, Matériel stéthoscope..."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Footer avec Boutons d'Action */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between safe-bottom">
          {initialData?.id && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!title.trim() || isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Enregistrement...' : 'Valider'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

function roundToNearest5Minutes(date: Date): Date {
  const minutes = date.getMinutes();
  const rounded = Math.round(minutes / 5) * 5;
  return setMilliseconds(setSeconds(setMinutes(date, rounded), 0), 0);
}
