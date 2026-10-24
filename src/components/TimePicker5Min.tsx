import React, { useState, useMemo } from 'react';
import { Clock, Plus, Zap, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { parseISO, format, setHours, setMinutes, addMinutes, differenceInMinutes, isValid } from 'date-fns';

interface TimePicker5MinProps {
  startTime: string; // ISO string
  endTime: string;   // ISO string
  onChange: (newStart: string, newEnd: string) => void;
  baseDate?: Date;
}

const FIVE_MINUTE_INTERVALS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const QUICK_DURATIONS = [
  { label: '+15m', minutes: 15 },
  { label: '+30m', minutes: 30 },
  { label: '+45m', minutes: 45 },
  { label: '+1h', minutes: 60 },
  { label: '+1h30', minutes: 90 },
  { label: '+2h', minutes: 120 },
  { label: '+4h', minutes: 240 },
  { label: 'Garde 24h', minutes: 1440 },
];

export const TimePicker5Min: React.FC<TimePicker5MinProps> = ({
  startTime,
  endTime,
  onChange,
  baseDate = new Date(),
}) => {
  const [activeTarget, setActiveTarget] = useState<'start' | 'end'>('start');

  const startDate = useMemo(() => {
    try {
      const parsed = parseISO(startTime);
      return isValid(parsed) ? parsed : baseDate;
    } catch {
      return baseDate;
    }
  }, [startTime, baseDate]);

  const endDate = useMemo(() => {
    try {
      const parsed = parseISO(endTime);
      return isValid(parsed) ? parsed : addMinutes(startDate, 60);
    } catch {
      return addMinutes(startDate, 60);
    }
  }, [endTime, startDate]);

  const startHour = startDate.getHours();
  const startMinute = Math.round(startDate.getMinutes() / 5) * 5 % 60;

  const endHour = endDate.getHours();
  const endMinute = Math.round(endDate.getMinutes() / 5) * 5 % 60;

  const activeHour = activeTarget === 'start' ? startHour : endHour;
  const activeMinute = activeTarget === 'start' ? startMinute : endMinute;

  // Calculer la durée totale
  const durationTotalMinutes = Math.max(5, differenceInMinutes(endDate, startDate));
  const durationHours = Math.floor(durationTotalMinutes / 60);
  const durationRemainingMinutes = durationTotalMinutes % 60;
  const formattedDuration = durationHours > 0
    ? `${durationHours}h${durationRemainingMinutes > 0 ? `${durationRemainingMinutes.toString().padStart(2, '0')}` : ''}`
    : `${durationRemainingMinutes} min`;

  // Mettre à jour l'heure active
  const handleSelectHour = (newHour: number) => {
    if (activeTarget === 'start') {
      const updatedStart = setHours(startDate, newHour);
      // Maintenir la même durée pour end
      const updatedEnd = addMinutes(updatedStart, durationTotalMinutes);
      onChange(updatedStart.toISOString(), updatedEnd.toISOString());
    } else {
      let updatedEnd = setHours(endDate, newHour);
      if (updatedEnd <= startDate) {
        updatedEnd = addMinutes(startDate, 15);
      }
      onChange(startDate.toISOString(), updatedEnd.toISOString());
    }
  };

  // Mettre à jour les minutes par paliers de 5
  const handleSelectMinute = (newMinute: number) => {
    if (activeTarget === 'start') {
      const updatedStart = setMinutes(startDate, newMinute);
      const updatedEnd = addMinutes(updatedStart, durationTotalMinutes);
      onChange(updatedStart.toISOString(), updatedEnd.toISOString());
    } else {
      let updatedEnd = setMinutes(endDate, newMinute);
      if (updatedEnd <= startDate) {
        updatedEnd = addMinutes(startDate, 5);
      }
      onChange(startDate.toISOString(), updatedEnd.toISOString());
    }
  };

  // Appliquer une durée rapide
  const handleApplyDuration = (minutes: number) => {
    const updatedEnd = addMinutes(startDate, minutes);
    onChange(startDate.toISOString(), updatedEnd.toISOString());
  };

  // Ajustement fin (+5 min / -5 min)
  const handleNudgeMinutes = (delta: number) => {
    if (activeTarget === 'start') {
      const updatedStart = addMinutes(startDate, delta);
      const updatedEnd = addMinutes(updatedStart, durationTotalMinutes);
      onChange(updatedStart.toISOString(), updatedEnd.toISOString());
    } else {
      const updatedEnd = addMinutes(endDate, delta);
      if (updatedEnd > startDate) {
        onChange(startDate.toISOString(), updatedEnd.toISOString());
      }
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-4">
      {/* 1. Sélecteur Début vs Fin & Résumé visuel */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTarget('start')}
          className={clsx(
            'flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all touch-manipulation',
            activeTarget === 'start'
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <span className="text-[10px] tracking-wide uppercase text-slate-500">Début</span>
          <span className="text-lg font-bold tracking-tight">
            {format(startDate, 'HH:mm')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTarget('end')}
          className={clsx(
            'flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all touch-manipulation',
            activeTarget === 'end'
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <span className="text-[10px] tracking-wide uppercase text-slate-500">Fin</span>
          <span className="text-lg font-bold tracking-tight">
            {format(endDate, 'HH:mm')}
          </span>
        </button>
      </div>

      {/* Badge durée et raccourci pas à pas */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-1.5 text-slate-700 font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
          <Clock className="w-3.5 h-3.5" />
          <span>Durée : <strong>{formattedDuration}</strong></span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleNudgeMinutes(-5)}
            className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700 active:scale-95 transition-transform"
            title="Reculer de 5 minutes"
          >
            -5m
          </button>
          <button
            type="button"
            onClick={() => handleNudgeMinutes(5)}
            className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-700 active:scale-95 transition-transform"
            title="Avancer de 5 minutes"
          >
            +5m
          </button>
        </div>
      </div>

      {/* 2. Sélection rapide des Heures (Scroll horizontal fluide tactile) */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Heure ({activeTarget === 'start' ? 'Début' : 'Fin'}) : {activeHour}h
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-300">
          {Array.from({ length: 24 }).map((_, hour) => {
            const isSelected = activeHour === hour;
            return (
              <button
                key={hour}
                type="button"
                onClick={() => handleSelectHour(hour)}
                className={clsx(
                  'flex-shrink-0 w-10 h-10 rounded-xl text-xs font-semibold flex items-center justify-center transition-all touch-manipulation',
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20 scale-105'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95'
                )}
              >
                {hour.toString().padStart(2, '0')}h
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Grille stricte des Minutes par paliers de 5 minutes (00 à 55) */}
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          Minutes (Paliers stricts de 5 min)
        </label>
        <div className="grid grid-cols-6 gap-1.5">
          {FIVE_MINUTE_INTERVALS.map((minute) => {
            const isSelected = activeMinute === minute;
            return (
              <button
                key={minute}
                type="button"
                onClick={() => handleSelectMinute(minute)}
                className={clsx(
                  'h-9 rounded-lg text-xs font-semibold flex items-center justify-center transition-all touch-manipulation',
                  isSelected
                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/25 scale-105 ring-2 ring-indigo-400/40'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 active:scale-95'
                )}
              >
                :{minute.toString().padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Durées Express Médicales (+15m, +30m, +1h, Garde 24h...) */}
      <div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
          <Zap className="w-3 h-3 text-amber-500" />
          <span>Durée rapide</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DURATIONS.map((qd) => (
            <button
              key={qd.label}
              type="button"
              onClick={() => handleApplyDuration(qd.minutes)}
              className="px-2.5 py-1.5 bg-white border border-slate-200/90 hover:border-indigo-300 hover:bg-indigo-50/60 rounded-lg text-xs font-medium text-slate-700 transition-colors active:scale-95 touch-manipulation"
            >
              {qd.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
