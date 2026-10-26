import React, { useMemo } from 'react';
import { Clock, Plus, Minus } from 'lucide-react';
import { clsx } from 'clsx';
import { parseISO, format, setHours, setMinutes, addMinutes, differenceInMinutes, isValid } from 'date-fns';

interface TimePicker5MinProps {
  startTime: string; // ISO string
  endTime: string;   // ISO string
  onChange: (newStart: string, newEnd: string) => void;
  baseDate?: Date;
}

const QUICK_DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 h', minutes: 60 },
  { label: '1 h 30', minutes: 90 },
  { label: '2 h', minutes: 120 },
  { label: '3 h', minutes: 180 },
  { label: '4 h', minutes: 240 },
  { label: 'Garde 12h', minutes: 720 },
];

const COMMON_START_HOURS = [
  { label: '08:00', hour: 8, minute: 0 },
  { label: '09:00', hour: 9, minute: 0 },
  { label: '10:00', hour: 10, minute: 0 },
  { label: '12:00', hour: 12, minute: 0 },
  { label: '13:30', hour: 13, minute: 30 },
  { label: '14:00', hour: 14, minute: 0 },
  { label: '16:00', hour: 16, minute: 0 },
  { label: '18:00', hour: 18, minute: 0 },
  { label: '20:00', hour: 20, minute: 0 },
];

export const TimePicker5Min: React.FC<TimePicker5MinProps> = ({
  startTime,
  endTime,
  onChange,
  baseDate = new Date(),
}) => {
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

  // Durée totale calculée
  const durationTotalMinutes = Math.max(5, differenceInMinutes(endDate, startDate));
  const durationHours = Math.floor(durationTotalMinutes / 60);
  const durationRemainingMinutes = durationTotalMinutes % 60;
  const formattedDuration = durationHours > 0
    ? `${durationHours}h${durationRemainingMinutes > 0 ? `${durationRemainingMinutes.toString().padStart(2, '0')}` : ''}`
    : `${durationRemainingMinutes} min`;

  // Changement d'heure direct via input
  const handleTimeChange = (type: 'start' | 'end', timeString: string) => {
    if (!timeString) return;
    const [hStr, mStr] = timeString.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return;

    if (type === 'start') {
      const newStart = setMinutes(setHours(startDate, h), m);
      const newEnd = addMinutes(newStart, durationTotalMinutes);
      onChange(newStart.toISOString(), newEnd.toISOString());
    } else {
      let newEnd = setMinutes(setHours(endDate, h), m);
      if (newEnd <= startDate) {
        newEnd = addMinutes(startDate, 15);
      }
      onChange(startDate.toISOString(), newEnd.toISOString());
    }
  };

  // Sélection d'une heure de départ rapide
  const handleSelectQuickStart = (hour: number, minute: number) => {
    const newStart = setMinutes(setHours(startDate, hour), minute);
    const newEnd = addMinutes(newStart, durationTotalMinutes);
    onChange(newStart.toISOString(), newEnd.toISOString());
  };

  // Sélection d'une durée rapide
  const handleApplyDuration = (minutes: number) => {
    const newEnd = addMinutes(startDate, minutes);
    onChange(startDate.toISOString(), newEnd.toISOString());
  };

  // Ajustement fin (+5 min / -5 min sur la fin)
  const handleNudgeMinutes = (delta: number) => {
    const updatedEnd = addMinutes(endDate, delta);
    if (updatedEnd > startDate) {
      onChange(startDate.toISOString(), updatedEnd.toISOString());
    }
  };

  const startHour = startDate.getHours();
  const startMinute = startDate.getMinutes();

  return (
    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 select-none">
      {/* 1. Bloc Début, Fin & Durée (Simple, Moderne et Lisible) */}
      <div className="flex items-center gap-2">
        {/* Champ Heure de Début */}
        <div className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 rounded-xl p-2 transition-all">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Début
          </label>
          <input
            type="time"
            step="300"
            value={format(startDate, 'HH:mm')}
            onChange={(e) => handleTimeChange('start', e.target.value)}
            className="w-full text-base font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer tracking-tight"
          />
        </div>

        {/* Indicateur de durée central */}
        <div className="flex flex-col items-center justify-center shrink-0 px-1">
          <span className="text-xs text-slate-400 font-semibold">→</span>
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full mt-0.5">
            {formattedDuration}
          </span>
        </div>

        {/* Champ Heure de Fin */}
        <div className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 rounded-xl p-2 transition-all">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Fin
          </label>
          <input
            type="time"
            step="300"
            value={format(endDate, 'HH:mm')}
            onChange={(e) => handleTimeChange('end', e.target.value)}
            className="w-full text-base font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer tracking-tight"
          />
        </div>

        {/* Boutons d'ajustement rapide (+5m / -5m) */}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleNudgeMinutes(5)}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold active:scale-95 transition-all"
            title="Ajouter 5 minutes"
          >
            +5m
          </button>
          <button
            type="button"
            onClick={() => handleNudgeMinutes(-5)}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold active:scale-95 transition-all"
            title="Retirer 5 minutes"
          >
            -5m
          </button>
        </div>
      </div>

      {/* 2. Raccourcis de durée en 1 clic */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
          Durée rapide
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DURATIONS.map((qd) => {
            const isMatch = durationTotalMinutes === qd.minutes;
            return (
              <button
                key={qd.label}
                type="button"
                onClick={() => handleApplyDuration(qd.minutes)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 border',
                  isMatch
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                )}
              >
                {qd.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Horaires de départ habituels */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
          Départs fréquents
        </span>
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {COMMON_START_HOURS.map((sh) => {
            const isMatch = startHour === sh.hour && startMinute === sh.minute;
            return (
              <button
                key={sh.label}
                type="button"
                onClick={() => handleSelectQuickStart(sh.hour, sh.minute)}
                className={clsx(
                  'shrink-0 px-2 py-1 text-xs font-semibold rounded-lg border transition-all active:scale-95',
                  isMatch
                    ? 'bg-slate-900 text-white border-slate-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                )}
              >
                {sh.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
