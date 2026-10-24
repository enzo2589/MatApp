import React, { useState, useEffect } from 'react';
import { X, Palette, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DAY_HIGHLIGHT_PRESETS, getDayHighlights, setDayHighlight } from '../../services/studentPreferences';

interface DayColorPickerModalProps {
  isOpen: boolean;
  date: Date | null;
  onClose: () => void;
}

export const DayColorPickerModal: React.FC<DayColorPickerModalProps> = ({
  isOpen,
  date,
  onClose,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444');
  const [customLabel, setCustomLabel] = useState<string>('Examen');

  useEffect(() => {
    if (date && isOpen) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const highlights = getDayHighlights();
      const existing = highlights[dateStr];
      if (existing) {
        setSelectedColor(existing.color);
        setCustomLabel(existing.label || '');
      } else {
        setSelectedColor('#EF4444');
        setCustomLabel('Examen');
      }
    }
  }, [date, isOpen]);

  if (!isOpen || !date) return null;

  const dateStr = format(date, 'yyyy-MM-dd');

  const handleApplyPreset = (preset: typeof DAY_HIGHLIGHT_PRESETS[0]) => {
    setSelectedColor(preset.color);
    setCustomLabel(preset.label.split('/')[0].trim());
  };

  const handleSave = () => {
    setDayHighlight(dateStr, {
      color: selectedColor,
      label: customLabel.trim() || 'Marqueur',
    });
    onClose();
  };

  const handleClear = () => {
    setDayHighlight(dateStr, null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-white rounded-3xl shadow-apple-lg border border-slate-200 overflow-hidden p-5 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Colorer ce jour du mois</h3>
              <p className="text-xs text-slate-500 capitalize">
                {format(date, 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Boutons pré-réglés (Examen, Repos, Stage, Garde...) */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
            Choisir une catégorie pour la journée :
          </label>
          <div className="grid grid-cols-1 gap-2">
            {DAY_HIGHLIGHT_PRESETS.map((p) => {
              const isSelected = selectedColor === p.color;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all active:scale-98 ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-500/20 font-bold shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                  style={{ backgroundColor: isSelected ? p.bgPastel : undefined }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{p.emoji}</span>
                    <span className="text-xs font-semibold text-slate-800">{p.label}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-600 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intitulé personnalisé du jour */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
            Libellé / Note sur le jour :
          </label>
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="ex: Concours Blanc, Partiel Cardio, Vacances..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Effacer couleur
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
            >
              Appliquer
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
