import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Calendar,
  Sparkles,
  CheckCircle2,
  X,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import {
  ParsedCourseEvent,
  PASS_LILLE_WEEK_43_COURSES,
  extractTextFromPDF,
  parseTimetableText,
  parseICS,
  importCoursesToDatabase,
} from '../services/timetableImporter';
import { alarmService } from '../services/alarmService';
import { parseISO } from 'date-fns';
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
        setProcessingStatus('Analyse du fichier .ics...');
        const text = await file.text();
        const parsed = parseICS(text);
        if (parsed.length === 0) {
          throw new Error('Aucun cours trouvé dans ce fichier .ics.');
        }
        setCourses(parsed);
      } else if (fileName.endsWith('.pdf')) {
        setProcessingStatus('Extraction du texte PDF...');
        const text = await extractTextFromPDF(file);
        setProcessingStatus('Reconnaissance des cours et horaires...');
        const parsed = parseTimetableText(text);
        if (parsed.length === 0) {
          throw new Error('Aucun cours détecté dans ce PDF.');
        }
        setCourses(parsed);
      } else {
        setProcessingStatus('Analyse du contenu...');
        const text = await file.text().catch(() => '');
        const parsed = parseTimetableText(text);
        if (parsed.length === 0) {
          throw new Error('Aucun cours détecté dans ce document.');
        }
        setCourses(parsed);
      }
    } catch (err: any) {
      console.error('Erreur import:', err);
      setErrorMessage(
        err.message || "Impossible de lire ce document. L'emploi du temps PASS Lille officiel reste disponible ci-dessous."
      );
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

  // Recharger l'emploi du temps PASS Lille S43
  const handleLoadPassLille = () => {
    setCourses(PASS_LILLE_WEEK_43_COURSES);
    setErrorMessage(null);
  };

  // Intégration en base IndexedDB
  const handleImport = async () => {
    if (courses.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Intégration instantanée dans votre agenda...');

    try {
      const count = await importCoursesToDatabase(courses);
      setImportedCount(count);
      setIsSuccess(true);

      // Son de validation Apple
      alarmService.playChime();

      // Date du premier cours pour y naviguer automatiquement
      const firstCourseDate = courses[0]?.startTime
        ? parseISO(courses[0].startTime)
        : new Date(2026, 9, 19);

      setTimeout(() => {
        setIsSuccess(false);
        onImportSuccess(firstCourseDate);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
      >
        {/* En-tête de la modale */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Importer l'Emploi du Temps
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Glissez votre planning ou chargez le modèle PASS
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-200/60 active:scale-95 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenu principal épuré */}
        <div className="p-6 space-y-4">
          {/* Écran de Succès animé */}
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-2.5">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-900">
                {importedCount} cours intégrés avec succès !
              </h4>
              <p className="text-xs text-slate-500 max-w-xs">
                Redirection automatique vers votre semaine du 19 octobre 2026...
              </p>
            </div>
          ) : (
            <>
              {/* Message d'erreur éventuel */}
              {errorMessage && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Zone Glisser-Déposer (Dropzone) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                  'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 select-none',
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

                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <Upload className="w-5 h-5 stroke-[2.2]" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Déposez votre PDF universitaire ou fichier .ics
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ou cliquez pour parcourir vos fichiers
                  </p>
                </div>

                {isProcessing && (
                  <div className="mt-1 flex items-center gap-2 text-xs font-bold text-indigo-600 animate-pulse">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span>{processingStatus}</span>
                  </div>
                )}
              </div>

              {/* Bouton de chargement rapide PASS Lille S43 */}
              <button
                type="button"
                onClick={handleLoadPassLille}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200/80 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Charger le planning officiel PASS Lille (Semaine 43)</span>
              </button>

              {/* Résumé compact des cours prêts */}
              {courses.length > 0 && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                      {courses.length}
                    </div>
                    <div>
                      <h5 className="text-xs font-extrabold text-slate-900">
                        {courses.length} cours prêts à être ajoutés
                      </h5>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Semaine du 19 au 23 oct 2026 • Blocs de 2h continus
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCourses([])}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                    title="Effacer la sélection"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions du bas */}
        {!isSuccess && (
          <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={courses.length === 0 || isProcessing}
              className={clsx(
                'px-5 py-2.5 rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2',
                courses.length > 0 && !isProcessing
                  ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-600/25'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              )}
            >
              <Sparkles className="w-4 h-4" />
              <span>
                Intégrer dans mon emploi du temps {courses.length > 0 ? `(${courses.length})` : ''}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
