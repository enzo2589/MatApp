import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  Clock,
  Bell,
  Tag,
  AlignLeft,
  Check,
  Star,
  Copy,
  BookmarkPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { EventItem, FavoriteItem } from '../types';
import { MEDICAL_COLORS, getColorTheme } from '../constants/colors';
import { TimePicker5Min } from './TimePicker5Min';
import {
  getStudentFavorites,
  saveStudentFavorite,
  subscribePreferences,
} from '../services/studentPreferences';
import { format, parseISO, addHours, addDays, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { fr } from 'date-fns/locale';

interface QuickEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Partial<EventItem> | null;
  onSave: (eventData: Partial<EventItem>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

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
  const [favorites, setFavorites] = useState<FavoriteItem[]>(getStudentFavorites());
  const [savedAsFavoriteFeedback, setSavedAsFavoriteFeedback] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Écouter les changements des favoris
  useEffect(() => {
    setFavorites(getStudentFavorites());
    const unsub = subscribePreferences(() => {
      setFavorites(getStudentFavorites());
    });
    return unsub;
  }, []);

  // Synchronisation des données initiales à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setSavedAsFavoriteFeedback(false);
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

      // Auto-focus avec léger délai
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

  // Appliquer un favori en 1 clic
  const handleApplyFavorite = (fav: FavoriteItem) => {
    setTitle(fav.title);
    setColor(fav.color);
    if (fav.description) setDescription(fav.description);
    if (fav.alarms) setAlarms(fav.alarms);

    if (startTime) {
      const start = parseISO(startTime);
      const newEnd = new Date(start.getTime() + fav.durationMinutes * 60000);
      setEndTime(newEnd.toISOString());
    }
  };

  // Sauvegarder l'événement courant dans les modèles
  const handleSaveAsFavorite = () => {
    if (!title.trim()) return;

    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));

    saveStudentFavorite({
      title: title.trim(),
      color,
      durationMinutes: duration,
      description: description.trim(),
      alarms,
      emoji: getColorTheme(color).emoji || '📌',
      category: getColorTheme(color).category,
    });

    setSavedAsFavoriteFeedback(true);
    setTimeout(() => setSavedAsFavoriteFeedback(false), 2500);
  };

  // Duplication de l'activité pour demain
  const handleDuplicateToTomorrow = async () => {
    if (!title.trim()) return;
    const start = addDays(parseISO(startTime), 1);
    const end = addDays(parseISO(endTime), 1);

    await onSave({
      title: `${title.trim()} (Copie)`,
      description,
      color,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      alarms,
    });
    onClose();
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
    if (window.confirm('Supprimer cette activité du planning ?')) {
      await onDelete(initialData.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentColorTheme = getColorTheme(color);
  const formattedDate = startTime ? format(parseISO(startTime), 'EEEE d MMMM yyyy', { locale: fr }) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/40 backdrop-blur-xs select-none">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200"
      >
        {/* Header de la modal */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
              style={{ backgroundColor: currentColorTheme.hex }}
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                {initialData?.id ? 'Modifier l’activité' : 'Nouvelle activité'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium capitalize">
                {formattedDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-colors"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps de la modal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Section 1 : Modèles fréquents */}
          {favorites.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                Modèles fréquents
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {favorites.map((fav) => {
                  const favTheme = getColorTheme(fav.color);
                  return (
                    <button
                      key={fav.id}
                      type="button"
                      onClick={() => handleApplyFavorite(fav)}
                      className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 text-slate-800 shadow-2xs"
                      title={`${fav.title} (${fav.durationMinutes} min)`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: favTheme.hex }}
                      />
                      <span className="truncate max-w-[130px]">{fav.title}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{fav.durationMinutes}m</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2 : Titre de l'activité */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Titre
              </label>
              {title.trim() && (
                <button
                  type="button"
                  onClick={handleSaveAsFavorite}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                  title="Enregistrer cette activité dans vos modèles"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>{savedAsFavoriteFeedback ? 'Enregistré !' : 'Enregistrer en modèle'}</span>
                </button>
              )}
            </div>

            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Pharmacologie, Anki Cardiologie, Stage..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="w-full px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>

          {/* Section 3 : Horaires & Durée */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Horaires
            </label>
            <TimePicker5Min
              startTime={startTime}
              endTime={endTime}
              onChange={handleTimeChange}
              baseDate={startTime ? parseISO(startTime) : new Date()}
            />
          </div>

          {/* Section 4 : Catégorie */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Catégorie
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {MEDICAL_COLORS.map((col) => {
                const isSelected = color === col.id || color === col.hex;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setColor(col.id)}
                    className={clsx(
                      'flex items-center gap-2 p-2 rounded-xl border text-left transition-all active:scale-98',
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500/20 shadow-2xs font-bold'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: col.hex }}
                    />
                    <div className="min-w-0">
                      <p className={clsx('text-xs truncate leading-tight', isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800 font-medium')}>
                        {col.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5 : Rappels */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Rappels
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
                      'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border active:scale-95',
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 6 : Notes */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
              Notes (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Salle, enseignant, remarques..."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none text-slate-800"
            />
          </div>
        </div>

        {/* Footer avec Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between safe-bottom">
          <div className="flex items-center gap-2">
            {initialData?.id && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                title="Supprimer cette activité"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>
            )}

            {initialData?.id && (
              <button
                type="button"
                onClick={handleDuplicateToTomorrow}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1.5"
                title="Dupliquer pour demain"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Dupliquer demain</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</span>
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
