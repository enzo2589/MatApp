import React, { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Sparkles, Edit3, X, Check, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_IMAGES = [
  {
    id: 'stetho',
    title: 'Stéthoscope & Études',
    url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
    quote: 'Objectif : Future blouse blanche 🩺',
  },
  {
    id: 'library',
    title: 'Bibliothèque Santé & Focus',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
    quote: 'Chaque item maîtrisé compte 📖',
  },
  {
    id: 'coffee',
    title: 'Café & Fiches de Révision',
    url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80',
    quote: 'Discipline & Constance ☕',
  },
  {
    id: 'anatomy',
    title: 'Anatomie & Dessin Médical',
    url: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=800&q=80',
    quote: 'Comprendre pour soigner 🧠',
  },
  {
    id: 'hospital',
    title: 'Bloc & Stage Hospitalier',
    url: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=800&q=80',
    quote: 'Au chevet du patient 🏥',
  },
];

const STORAGE_KEY_IMG = 'medagenda_student_widget_image';
const STORAGE_KEY_QUOTE = 'medagenda_student_widget_quote';

export const CustomImageWidget: React.FC = () => {
  const [currentImage, setCurrentImage] = useState<string>(PRESET_IMAGES[0].url);
  const [currentQuote, setCurrentQuote] = useState<string>(PRESET_IMAGES[0].quote);
  const [isEditing, setIsEditing] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [quoteInput, setQuoteInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger depuis le localStorage
  useEffect(() => {
    const savedImg = localStorage.getItem(STORAGE_KEY_IMG);
    const savedQuote = localStorage.getItem(STORAGE_KEY_QUOTE);
    if (savedImg) setCurrentImage(savedImg);
    if (savedQuote) setCurrentQuote(savedQuote);
  }, []);

  const handleSelectPreset = (preset: typeof PRESET_IMAGES[0]) => {
    setCurrentImage(preset.url);
    setCurrentQuote(preset.quote);
    localStorage.setItem(STORAGE_KEY_IMG, preset.url);
    localStorage.setItem(STORAGE_KEY_QUOTE, preset.quote);
    setIsEditing(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCurrentImage(result);
      localStorage.setItem(STORAGE_KEY_IMG, result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrlInput.trim()) {
      setCurrentImage(customUrlInput.trim());
      localStorage.setItem(STORAGE_KEY_IMG, customUrlInput.trim());
    }
    if (quoteInput.trim()) {
      setCurrentQuote(quoteInput.trim());
      localStorage.setItem(STORAGE_KEY_QUOTE, quoteInput.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl p-2.5 shadow-xs border border-slate-200/80 relative select-none group">
      {/* Label du widget (Image que je choisis) */}
      <div className="flex items-center justify-between px-1 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <ImageIcon className="w-3 h-3 text-indigo-500" />
          Image d’inspiration
        </span>
        <button
          type="button"
          onClick={() => {
            setCustomUrlInput('');
            setQuoteInput(currentQuote);
            setIsEditing(true);
          }}
          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-0.5"
        >
          <Edit3 className="w-2.5 h-2.5" />
          Changer
        </button>
      </div>

      {/* Cadre de l'image style Widget Apple */}
      <div className="relative h-32 w-full rounded-xl overflow-hidden shadow-inner group/img cursor-pointer">
        <img
          src={currentImage}
          alt="Inspiration Étudiant Médecine"
          className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
        />

        {/* Dégradé sombre pour lisibilité du texte */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-bold text-white uppercase tracking-wider border border-white/20">
              Focus Médecine
            </span>
          </div>
          <p className="text-white text-xs font-bold leading-tight mt-1 drop-shadow-sm line-clamp-2">
            {currentQuote}
          </p>
        </div>

        {/* Bouton rapide au survol */}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md opacity-0 group-hover/img:opacity-100 transition-opacity"
          title="Personnaliser l'image"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modal / Popover de personnalisation */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-apple-lg border border-slate-200 overflow-hidden p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Mon Image & Motivation
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Galerie de présélections */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                  Modèles esthétiques étudiants :
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESET_IMAGES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className="relative h-12 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-500 transition-all active:scale-95"
                      title={p.title}
                    >
                      <img src={p.url} alt={p.title} className="w-full h-full object-cover" />
                      {currentImage === p.url && (
                        <div className="absolute inset-0 bg-indigo-600/40 flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload image personnelle */}
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Ou importer votre propre photo :
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-indigo-500 rounded-xl text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Choisir une photo depuis mon appareil
                </button>
              </div>

              {/* Citation / Objectif personnel */}
              <form onSubmit={handleSaveCustom} className="space-y-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                    Objectif / Phrase de motivation :
                  </label>
                  <input
                    type="text"
                    value={quoteInput}
                    onChange={(e) => setQuoteInput(e.target.value)}
                    placeholder="ex: Major de promo 🎯 / J-40 Partiels"
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
