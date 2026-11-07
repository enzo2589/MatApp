import React, { useState, useRef, useEffect } from 'react';
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
  Camera,
  Image as ImageIcon,
  ScanLine,
} from 'lucide-react';
import {
  ParsedCourseEvent,
  PASS_LILLE_WEEK_43_COURSES,
  parsePDFTimetable,
  parseTimetableText,
  parseImageTimetable,
  parseICS,
  importCoursesToDatabase,
} from '../services/timetableImporter';
import { alarmService } from '../services/alarmService';
import { parseISO, format } from 'date-fns';
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
  const [courses, setCourses] = useState<ParsedCourseEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewThumbnail) {
        URL.revokeObjectURL(previewThumbnail);
      }
    };
  }, [previewThumbnail]);

  if (!isOpen) return null;

  // Traitement d'un fichier uploadé (Photo, Capture d'écran, PDF, ICS, Texte)
  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProgressPercent(10);
    setProcessingStatus(`Chargement de ${file.name}...`);

    const isImage =
      file.type.startsWith('image/') ||
      /\.(png|jpe?g|webp|heic|bmp|tiff)$/i.test(file.name);

    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewThumbnail(url);
    } else {
      setPreviewThumbnail(null);
    }

    try {
      const fileName = file.name.toLowerCase();

      if (isImage) {
        setProcessingStatus('Lecture optique de la photo par IA...');
        const parsed = await parseImageTimetable(file, (pct, status) => {
          setProgressPercent(pct);
          setProcessingStatus(status);
        });
        if (parsed.length === 0) {
          throw new Error(
            'Aucun cours détecté sur cette photo. Assurez-vous que les horaires et matières sont bien lisibles et cadrés.'
          );
        }
        setCourses(parsed);
      } else if (fileName.endsWith('.pdf')) {
        setProcessingStatus('Analyse du PDF et détection des cours...');
        setProgressPercent(50);
        const parsed = await parsePDFTimetable(file);
        if (parsed.length === 0) {
          throw new Error('Aucun cours détecté dans ce document PDF. Vérifiez qu’il s’agit bien d’un emploi du temps.');
        }
        setCourses(parsed);
      } else if (fileName.endsWith('.ics')) {
        setProcessingStatus('Analyse du fichier .ics...');
        setProgressPercent(50);
        const text = await file.text();
        const parsed = parseICS(text);
        if (parsed.length === 0) {
          throw new Error('Aucun cours trouvé dans ce fichier .ics.');
        }
        setCourses(parsed);
      } else {
        setProcessingStatus('Analyse du document...');
        setProgressPercent(50);
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
        err.message || "Impossible de lire ce document. Vérifiez la qualité de l'image ou le format."
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
    // Réinitialiser la valeur de l'input pour permettre de re-sélectionner le même fichier si besoin
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Recharger l'emploi du temps PASS Lille S43 en exemple si besoin
  const handleLoadPassLille = () => {
    setCourses(PASS_LILLE_WEEK_43_COURSES);
    setErrorMessage(null);
    setPreviewThumbnail(null);
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
        : new Date();

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
              <Camera className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Importer l'Emploi du Temps
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Photo, capture d'écran, PDF ou fichier .ics
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

        {/* Inputs cachés pour le sélecteur de fichiers et la caméra directe */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.ics,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Contenu principal */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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
                {courses[0]?.startTime
                  ? `Affichage direct de votre semaine du ${format(parseISO(courses[0].startTime), 'd MMMM yyyy', { locale: fr })}...`
                  : 'Redirection vers votre agenda...'}
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

              {/* Boutons d'action rapide Photo & Caméra */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-3.5 rounded-2xl bg-indigo-50/80 hover:bg-indigo-100/90 active:scale-98 border border-indigo-200/80 text-indigo-700 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group shadow-xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Camera className="w-4 h-4 stroke-[2.3]" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Prendre une photo</span>
                  <span className="text-[10px] text-slate-500">Appareil photo direct</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 active:scale-98 border border-slate-200 text-slate-700 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group shadow-xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <ImageIcon className="w-4 h-4 stroke-[2.3]" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Choisir une image</span>
                  <span className="text-[10px] text-slate-500">Galerie / Captures</span>
                </button>
              </div>

              {/* Zone Glisser-Déposer (Dropzone polyvalente) */}
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
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <Upload className="w-5 h-5 stroke-[2.2]" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Ou déposez un fichier ici
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Photo, capture d'écran, PDF ou fichier .ics
                  </p>
                </div>

                {isProcessing && (
                  <div className="w-full mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-600">
                      <span className="flex items-center gap-1.5">
                        <ScanLine className="w-3.5 h-3.5 animate-pulse" />
                        {processingStatus}
                      </span>
                      {progressPercent > 0 && <span>{progressPercent}%</span>}
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, progressPercent)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Aperçu de la miniature photo si présente */}
              {previewThumbnail && (
                <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                  <img
                    src={previewThumbnail}
                    alt="Aperçu emploi du temps"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-2xs"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      Photo analysée
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Reconnaissance optique automatique appliquée
                    </p>
                  </div>
                </div>
              )}

              {/* Résumé des cours détectés */}
              {courses.length > 0 ? (
                <div className="space-y-2">
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                        {courses.length}
                      </div>
                      <div>
                        <h5 className="text-xs font-extrabold text-slate-900">
                          {courses.length} cours détectés
                        </h5>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {courses[0]?.startTime
                            ? `Semaine du ${format(parseISO(courses[0].startTime), 'd MMMM yyyy', { locale: fr })}`
                            : 'Planning prêt à être intégré'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCourses([]);
                        setPreviewThumbnail(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors"
                      title="Effacer la sélection"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Liste déroulante des cours extraits */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {courses.slice(0, 6).map((c, i) => (
                      <div
                        key={c.id || i}
                        className="px-3 py-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 truncate">{c.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {[c.subject, c.professor, c.room].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                        <div className="text-[11px] font-semibold text-indigo-600 shrink-0">
                          {c.startTime ? format(parseISO(c.startTime), 'EEE d HH:mm', { locale: fr }) : ''}
                        </div>
                      </div>
                    ))}
                    {courses.length > 6 && (
                      <p className="text-[11px] text-center text-slate-400 font-medium py-1">
                        + {courses.length - 6} autres cours dans cette semaine
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadPassLille}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200/60 font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Charger le modèle d'exemple PASS (Semaine 43)</span>
                </button>
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
                Intégrer dans mon agenda {courses.length > 0 ? `(${courses.length})` : ''}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
