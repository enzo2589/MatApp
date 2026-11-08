import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  Clock,
  Bell,
  AlignLeft,
  Check,
  Star,
  Copy,
  BookmarkPlus,
  Plus,
  Pencil,
  Settings2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { EventItem, FavoriteItem } from '../types';
import { MEDICAL_COLORS, getColorTheme } from '../constants/colors';
import { TimePicker5Min } from './TimePicker5Min';
import {
  getStudentFavorites,
  saveStudentFavorite,
  deleteStudentFavorite,
  resetStudentFavorites,
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

const TEMPLATE_DURATION_PRESETS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 h', minutes: 60 },
  { label: '1 h 30', minutes: 90 },
  { label: '2 h', minutes: 120 },
  { label: '3 h', minutes: 180 },
  { label: '4 h', minutes: 240 },
  { label: 'Garde 12h', minutes: 720 },
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

  // Mode gestion des modèles
  const [isManagingFavorites, setIsManagingFavorites] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState<FavoriteItem | null>(null);
  const [isCreatingFavorite, setIsCreatingFavorite] = useState(false);

  // Champs de l'éditeur de modèle
  const [favFormTitle, setFavFormTitle] = useState('');
  const [favFormColor, setFavFormColor] = useState('cours');
  const [favFormDuration, setFavFormDuration] = useState(60);
  const [favFormAlarms, setFavFormAlarms] = useState<number[]>([15]);

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
      setIsManagingFavorites(false);
      setEditingFavorite(null);
      setIsCreatingFavorite(false);

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

  // Sauvegarder l'activité courante comme nouveau modèle rapide
  const handleSaveAsFavorite = () => {
    if (!title.trim()) return;

    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    const theme = getColorTheme(color);

    saveStudentFavorite({
      title: title.trim(),
      color,
      durationMinutes: duration,
      description: description.trim(),
      alarms,
      emoji: theme.emoji || '📌',
      category: theme.name,
    });

    setSavedAsFavoriteFeedback(true);
    setTimeout(() => setSavedAsFavoriteFeedback(false), 2500);
  };

  // Ouvrir l'éditeur pour créer un nouveau modèle de zéro
  const handleOpenCreateFavorite = () => {
    setFavFormTitle(title.trim() || '');
    setFavFormColor(color || 'cours');
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const duration = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    setFavFormDuration(duration || 60);
    setFavFormAlarms(alarms.length > 0 ? alarms : [15]);
    setEditingFavorite(null);
    setIsCreatingFavorite(true);
  };

  // Ouvrir l'éditeur pour modifier un modèle existant
  const handleOpenEditFavorite = (fav: FavoriteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavFormTitle(fav.title);
    setFavFormColor(fav.color);
    setFavFormDuration(fav.durationMinutes);
    setFavFormAlarms(fav.alarms || []);
    setEditingFavorite(fav);
    setIsCreatingFavorite(true);
  };

  // Sauvegarder le modèle dans l'éditeur (création ou modification)
  const handleSaveFavoriteForm = () => {
    if (!favFormTitle.trim()) return;
    const theme = getColorTheme(favFormColor);

    saveStudentFavorite({
      id: editingFavorite?.id,
      title: favFormTitle.trim(),
      color: favFormColor,
      durationMinutes: favFormDuration,
      description: editingFavorite?.description || '',
      alarms: favFormAlarms,
      emoji: theme.emoji || '📌',
      category: theme.name,
    });

    setIsCreatingFavorite(false);
    setEditingFavorite(null);
  };

  // Supprimer un modèle
  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteStudentFavorite(id);
  };

  // Restaurer les modèles officiels par défaut
  const handleResetDefaults = () => {
    if (window.confirm('Restaurer la liste des modèles étudiants par défaut ?')) {
      resetStudentFavorites();
    }
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
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs transition-colors"
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
          {/* SECTION 1 : MODÈLES FRÉQUENTS AVEC GESTION COMPLÈTE */}
          <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">
                  Modèles fréquents
                </span>
                <span className="text-[10px] text-slate-400 font-medium bg-slate-200/60 px-1.5 py-0.5 rounded-full">
                  {favorites.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenCreateFavorite}
                  className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:scale-95 rounded-lg border border-indigo-200 transition-all flex items-center gap-1"
                  title="Créer un nouveau modèle d'activité"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>Nouveau</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsManagingFavorites((prev) => !prev)}
                  className={clsx(
                    'px-2 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 active:scale-95',
                    isManagingFavorites
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  )}
                  title={isManagingFavorites ? 'Quitter le mode gestion' : 'Gérer, modifier ou supprimer les modèles'}
                >
                  <Settings2 className="w-3 h-3" />
                  <span>{isManagingFavorites ? 'Terminer' : 'Gérer'}</span>
                </button>
              </div>
            </div>

            {/* Liste des modèles */}
            {favorites.length > 0 ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-0.5">
                {favorites.map((fav) => {
                  const favTheme = getColorTheme(fav.color);
                  const isMatching = title.trim().toLowerCase() === fav.title.toLowerCase();

                  return (
                    <div
                      key={fav.id}
                      className={clsx(
                        'shrink-0 flex items-center rounded-xl border transition-all text-xs font-semibold shadow-2xs group',
                        isMatching
                          ? 'border-indigo-600 bg-indigo-50/80 ring-1 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyFavorite(fav)}
                        className="px-2.5 py-1.5 flex items-center gap-2 text-slate-800"
                        title={`Appliquer "${fav.title}" (${fav.durationMinutes} min)`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: favTheme.hex }}
                        />
                        <span className="truncate max-w-[125px] font-medium">{fav.title}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {fav.durationMinutes >= 60
                            ? `${fav.durationMinutes / 60}h`
                            : `${fav.durationMinutes}m`}
                        </span>
                      </button>

                      {/* Boutons d'édition et suppression en mode gestion */}
                      {isManagingFavorites && (
                        <div className="flex items-center gap-0.5 pr-1.5 pl-0.5 border-l border-slate-100">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditFavorite(fav, e)}
                            className="w-5 h-5 rounded-md hover:bg-indigo-100 text-slate-400 hover:text-indigo-700 flex items-center justify-center transition-colors"
                            title="Modifier ce modèle"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFavorite(fav.id, e)}
                            className="w-5 h-5 rounded-md hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors"
                            title="Supprimer ce modèle"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic py-1">
                Aucun modèle enregistré. Cliquez sur "+ Nouveau" pour en ajouter un.
              </p>
            )}

            {isManagingFavorites && (
              <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Cliquez sur ✏️ pour modifier ou 🗑️ pour supprimer un modèle.
                </span>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-semibold"
                  title="Restaurer les modèles par défaut"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Défauts</span>
                </button>
              </div>
            )}
          </div>

          {/* FORMULAIRE INLINE D'ÉDITION / CRÉATION D'UN MODÈLE */}
          <AnimatePresence>
            {isCreatingFavorite && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <BookmarkPlus className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold text-indigo-950">
                      {editingFavorite ? 'Modifier le modèle' : 'Créer un nouveau modèle'}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingFavorite(false);
                      setEditingFavorite(null);
                    }}
                    className="w-6 h-6 rounded-lg hover:bg-indigo-100 text-indigo-700 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Nom du modèle */}
                <div>
                  <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                    Nom du modèle
                  </label>
                  <input
                    type="text"
                    value={favFormTitle}
                    onChange={(e) => setFavFormTitle(e.target.value)}
                    placeholder="Ex. Anki Pharmacologie, ED Anatomie..."
                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                  />
                </div>

                {/* Type d'activité & Couleur pour le modèle */}
                <div>
                  <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                    Type d'activité associé
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {MEDICAL_COLORS.slice(0, 6).map((col) => {
                      const isSel = favFormColor === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setFavFormColor(col.id)}
                          className={clsx(
                            'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left text-[11px] transition-all',
                            isSel
                              ? 'border-indigo-600 bg-indigo-100/70 font-bold text-indigo-950'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: col.hex }}
                          />
                          <span className="truncate">{col.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Durée par défaut */}
                <div>
                  <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider block mb-1">
                    Durée par défaut
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {TEMPLATE_DURATION_PRESETS.map((dur) => (
                      <button
                        key={dur.minutes}
                        type="button"
                        onClick={() => setFavFormDuration(dur.minutes)}
                        className={clsx(
                          'px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-all',
                          favFormDuration === dur.minutes
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                            : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100/50'
                        )}
                      >
                        {dur.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bouton d'enregistrement du modèle */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-indigo-200/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingFavorite(false);
                      setEditingFavorite(null);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFavoriteForm}
                    disabled={!favFormTitle.trim()}
                    className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg flex items-center gap-1 shadow-xs"
                  >
                    <Check className="w-3 h-3" />
                    <span>Enregistrer le modèle</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SECTION 2 : TITRE DE L'ACTIVITÉ */}
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

          {/* SECTION 3 : HORAIRES & DURÉE */}
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

          {/* SECTION 4 : TYPE D'ACTIVITÉ & COULEUR (CLARIFIÉ ET CONNECTÉ AUX MODÈLES) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Type d'activité & Couleur
                </label>
                <p className="text-[10px] text-slate-400">
                  Détermine la couleur du bloc sur votre emploi du temps
                </p>
              </div>

              {/* Aperçu couleur sélectionnée */}
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-bold"
                style={{
                  backgroundColor: currentColorTheme.bgPastel,
                  borderColor: currentColorTheme.badgeBg,
                  color: currentColorTheme.textColor,
                }}
              >
                <span>{currentColorTheme.emoji}</span>
                <span>{currentColorTheme.name}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {MEDICAL_COLORS.map((col) => {
                const isSelected = color === col.id || color === col.hex;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setColor(col.id)}
                    className={clsx(
                      'flex items-center gap-2 p-2 rounded-xl border text-left transition-all active:scale-98 cursor-pointer',
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-500/30 shadow-2xs font-bold'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: col.hex }}
                    />
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-xs">{col.emoji}</span>
                      <p className={clsx('text-xs truncate leading-tight', isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800 font-medium')}>
                        {col.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 5 : RAPPELS */}
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

          {/* SECTION 6 : NOTES */}
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
                className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
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
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
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
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
