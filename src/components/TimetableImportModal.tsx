import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Calendar,
  Sparkles,
  CheckCircle2,
  X,
  Clock,
  User,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Trash2,
  Flame,
} from 'lucide-react';
import {
  ParsedCourseEvent,
  PASS_LILLE_WEEK_43_COURSES,
  extractTextFromPDF,
  parseTimetableText,
  parseICS,
  importCoursesToDatabase,
  cleanAllDuplicateAndDemoEvents,
} from '../services/timetableImporter';
import { getColorTheme } from '../constants/colors';
import { alarmService } from '../services/alarmService';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { clsx } from 'clsx';

interface TimetableImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (targetDate: Date) => void;
}

export const TimetableImportModal: React.FC<TimetableImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [courses, setCourses] = useState<ParsedCourseEvent[]>(PASS_LILLE_WEEK_43_COURSES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(PASS_LILLE_WEEK_43_COURSES.map((c) => c.id))
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Traitement d'un fichier uploadé (PDF, ICS, Texte)
  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus(`Lecture de ${file.name}...`);

    try {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.ics')) {
        setProcessingStatus('Analyse du calendrier iCal / ADE Campus...');
        const text = await file.text();
        const parsed = parseICS(text);
        if (parsed.length === 0) {
          throw new Error('Aucun cours trouvé dans ce fichier .ics.');
        }
        setCourses(parsed);
        setSelectedIds(new Set(parsed.map((c) => c.id)));
      } else if (fileName.endsWith('.pdf')) {
        setProcessingStatus('Extraction du texte PDF universitaire avec pdf.js...');
        const text = await extractTextFromPDF(file);
        setProcessingStatus('Reconnaissance des cours, horaires et professeurs...');
        const parsed = parseTimetableText(text);
        setCourses(parsed);
        setSelectedIds(new Set(parsed.map((c) => c.id)));
      } else {
        // Fichier texte ou image
        setProcessingStatus('Analyse du contenu...');
        const text = await file.text().catch(() => '');
        const parsed = parseTimetableText(text);
        setCourses(parsed);
        setSelectedIds(new Set(parsed.map((c) => c.id)));
      }
    } catch (err: any) {
      console.error('Erreur import:', err);
      setErrorMessage(
        err.message || 'Impossible de lire ce document. Utilisez le modèle pré-rempli PASS ci-dessous.'
      );
      // Fallback sur le modèle PASS Lille
      setCourses(PASS_LILLE_WEEK_43_COURSES);
      setSelectedIds(new Set(PASS_LILLE_WEEK_43_COURSES.map((c) => c.id)));
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Charger directement le modèle PASS Lille Semaine 43 en 1 clic
  const handleLoadPassLille = () => {
    setCourses(PASS_LILLE_WEEK_43_COURSES);
    setSelectedIds(new Set(PASS_LILLE_WEEK_43_COURSES.map((c) => c.id)));
    setErrorMessage(null);
  };

  // Sélection / Désélection d'un cours
  const toggleCourse = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === courses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(courses.map((c) => c.id)));
    }
  };

  const removeCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Intégration en base IndexedDB
  const handleImport = async () => {
    const coursesToImport = courses.filter((c) => selectedIds.has(c.id));
    if (coursesToImport.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Intégration ultra-rapide dans Dexie (IndexedDB)...');

    try {
      const count = await importCoursesToDatabase(coursesToImport);
      setImportedCount(count);
      setIsSuccess(true);

      // Son de validation Apple
      alarmService.playChime();

      // Trouver la date du premier cours pour y naviguer automatiquement
      const firstCourseDate = coursesToImport[0]?.startTime
        ? parseISO(coursesToImport[0].startTime)
        : new Date(2026, 9, 19);

      setTimeout(() => {
        setIsSuccess(false);
        onImportSuccess(firstCourseDate);
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMessage("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Regroupement des cours par jour pour une lecture ultra-claire
  const coursesByDay = courses.reduce<Record<string, ParsedCourseEvent[]>>((acc, course) => {
    try {
      const date = parseISO(course.startTime);
      const dayKey = format(date, 'yyyy-MM-dd');
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(course);
    } catch {
      if (!acc['other']) acc['other'] = [];
      acc['other'].push(course);
    }
    return acc;
  }, {});

  const selectedCount = selectedIds.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* =========================================================================
            HEADER DE LA MODALE (Style Apple Santé)
           ========================================================================= */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25">
              <GraduationCap className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Importer mon Emploi du Temps
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  0 ms Latence
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Glissez votre PDF ou intégrez directement la semaine PASS officielle
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 active:scale-95 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            CONTENU DÉFILABLE
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 scrollbar-thin">
          {/* Écran de Succès animé */}
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 flex flex-col items-center justify-center text-center space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-black text-slate-900">
                {importedCount} cours intégrés avec succès !
              </h4>
              <p className="text-sm text-slate-500 max-w-md">
                Votre agenda a été mis à jour instantanément. Redirection vers la semaine du 19 octobre 2026...
              </p>
            </motion.div>
          ) : (
            <>
              {/* Message d'erreur éventuel */}
              {errorMessage && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Information : </span>
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------------
                  CARTE RECOMMANDÉE EN 1 TAP (PASS LILLE SEMAINE 43)
                  Permet à l'étudiant d'importer le document officiel reçu en 0 clic
                 ------------------------------------------------------------------- */}
              <div className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-lg shadow-indigo-600/20 overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-amber-400 text-slate-900 rounded-full shadow-xs">
                        <Flame className="w-3 h-3 fill-slate-900" />
                        Document Officiel Reçu
                      </span>
                      <span className="text-xs text-indigo-200 font-semibold">
                        Semaine 43 • 19 au 23 Octobre 2026
                      </span>
                    </div>

                    <h4 className="text-base sm:text-lg font-black tracking-tight">
                      Faculté de Médecine de Lille — PASS S43
                    </h4>

                    <p className="text-xs text-indigo-100 max-w-xl font-medium leading-relaxed">
                      <strong>10 cours unifiés</strong> (créneaux de 2h continus pour une lisibilité maximale) : <strong>Pharmacologie</strong> (Pr Deplanque, 10h-12h), <strong>Biologie Cellulaire</strong> (Vincent Deramecourt, 10h-12h), <strong>Anatomie</strong> (Dr Herteleer, 08h-10h), <strong>Biophysique</strong> (Philippe Derambure, 10h-12h), <strong>SSH</strong> (M Bertrand & Devinant, 08h-10h).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadPassLille}
                    className="shrink-0 px-4 py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-95 rounded-xl font-black text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600 fill-indigo-600" />
                    <span>Charger cette semaine</span>
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------------------------
                  ZONE DE GLISSER-DÉPOSER (DROPZONE)
                 ------------------------------------------------------------------- */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 select-none',
                  isDragOver
                    ? 'border-indigo-600 bg-indigo-50/70 scale-[1.01]'
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/80 bg-slate-50/40'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.ics,.txt,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload className="w-5 h-5 stroke-[2.2]" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Déposez votre PDF, fichier ADE Campus / ENT (.ics) ou cliquez pour parcourir
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Extraction automatique des créneaux, matières, professeurs et salles
                  </p>
                </div>

                {isProcessing && (
                  <div className="mt-1 flex items-center gap-2 text-xs font-bold text-indigo-600 animate-pulse">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span>{processingStatus}</span>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------------------------
                  PRÉVISUALISATION DES COURS DÉTECTÉS
                 ------------------------------------------------------------------- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <h5 className="text-sm font-extrabold text-slate-900 tracking-tight">
                      Cours détectés ({courses.length})
                    </h5>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    {selectedIds.size === courses.length ? 'Tout décocher' : 'Tout cocher'}
                  </button>
                </div>

                {/* Liste des cours regroupés par jour */}
                <div className="space-y-4">
                  {Object.entries(coursesByDay).map(([dayKey, dayCourses]) => {
                    const firstDate = dayCourses[0]?.startTime ? parseISO(dayCourses[0].startTime) : new Date();
                    const dayLabel = format(firstDate, 'EEEE d MMMM yyyy', { locale: fr });

                    return (
                      <div key={dayKey} className="space-y-1.5">
                        <div className="text-xs font-extrabold text-slate-600 capitalize px-1 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span>{dayLabel}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            ({dayCourses.length} créneau{dayCourses.length > 1 ? 'x' : ''})
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {dayCourses.map((course) => {
                            const isChecked = selectedIds.has(course.id);
                            const theme = getColorTheme(course.color);
                            const start = parseISO(course.startTime);
                            const end = parseISO(course.endTime);
                            const timeText = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;

                            return (
                              <div
                                key={course.id}
                                onClick={() => toggleCourse(course.id)}
                                className={clsx(
                                  'group relative p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 select-none',
                                  isChecked
                                    ? 'bg-white border-indigo-200 shadow-2xs hover:border-indigo-300'
                                    : 'bg-slate-50/60 border-slate-200/80 opacity-60 hover:opacity-100'
                                )}
                              >
                                {/* Checkbox Apple */}
                                <div
                                  className={clsx(
                                    'w-4 h-4 rounded-md border mt-0.5 flex items-center justify-center shrink-0 transition-colors',
                                    isChecked
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  )}
                                >
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>

                                {/* Contenu du cours */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate max-w-[140px]"
                                      style={{
                                        backgroundColor: theme.bgPastel,
                                        color: theme.textColor,
                                        border: `1px solid ${theme.badgeBg}`,
                                      }}
                                    >
                                      {course.subject}
                                    </span>

                                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-0.5 ml-auto">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      {timeText}
                                    </span>
                                  </div>

                                  <h6 className="text-xs font-bold text-slate-900 truncate mt-1">
                                    {course.title}
                                  </h6>

                                  {course.professor && (
                                    <p className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                      <User className="w-2.5 h-2.5 text-slate-400" />
                                      <span>{course.professor}</span>
                                    </p>
                                  )}
                                </div>

                                {/* Bouton de suppression individuelle */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCourse(course.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded-md transition-opacity"
                                  title="Supprimer ce créneau"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* =========================================================================
            PIED DE PAGE (Actions Apple)
           ========================================================================= */}
        {!isSuccess && (
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={async () => {
                  const cleaned = await cleanAllDuplicateAndDemoEvents();
                  alarmService.playChime();
                  alert(cleaned > 0 ? `${cleaned} doublon(s) et élément(s) parasites supprimés !` : 'Votre agenda est déjà parfaitement propre !');
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200"
                title="Supprime tous les doublons et les éléments de démo"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Nettoyer les doublons</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0 || isProcessing}
                className={clsx(
                  'px-5 py-2.5 rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2',
                  selectedCount > 0 && !isProcessing
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-600/25'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                )}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  Tout intégrer dans mon emploi du temps ({selectedCount} cours)
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
