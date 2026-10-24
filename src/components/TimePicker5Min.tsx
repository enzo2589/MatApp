import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Clock, Zap, Plus, Minus, ArrowRight, Sparkles, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { parseISO, format, setHours, setMinutes, addMinutes, differenceInMinutes, isValid } from 'date-fns';

interface TimePicker5MinProps {
  startTime: string; // ISO string
  endTime: string;   // ISO string
  onChange: (newStart: string, newEnd: string) => void;
  baseDate?: Date;
}

const FIVE_MINUTE_INTERVALS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const QUICK_START_PRESETS = [
  { label: '08:00', hour: 8, minute: 0 },
  { label: '08:30', hour: 8, minute: 30 },
  { label: '09:00', hour: 9, minute: 0 },
  { label: '10:00', hour: 10, minute: 0 },
  { label: '12:00', hour: 12, minute: 0 },
  { label: '13:30', hour: 13, minute: 30 },
  { label: '14:00', hour: 14, minute: 0 },
  { label: '16:00', hour: 16, minute: 0 },
  { label: '17:00', hour: 17, minute: 0 },
  { label: '18:30', hour: 18, minute: 30 },
  { label: '20:00', hour: 20, minute: 0 },
];

const QUICK_DURATIONS = [
  { label: '+30m', minutes: 30 },
  { label: '+45m', minutes: 45 },
  { label: '+1h', minutes: 60 },
  { label: '+1h30', minutes: 90 },
  { label: '+2h', minutes: 120 },
  { label: '+3h', minutes: 180 },
  { label: '+4h', minutes: 240 },
  { label: 'Garde 12h', minutes: 720 },
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

  const startMinutesTotal = startDate.getHours() * 60 + Math.round(startDate.getMinutes() / 5) * 5;
  const endMinutesTotal = endDate.getHours() * 60 + Math.round(endDate.getMinutes() / 5) * 5;

  const startHour = startDate.getHours();
  const startMinute = Math.round(startDate.getMinutes() / 5) * 5 % 60;

  const endHour = endDate.getHours();
  const endMinute = Math.round(endDate.getMinutes() / 5) * 5 % 60;

  const activeHour = activeTarget === 'start' ? startHour : endHour;
  const activeMinute = activeTarget === 'start' ? startMinute : endMinute;

  // Durée totale calculée
  const durationTotalMinutes = Math.max(5, differenceInMinutes(endDate, startDate));
  const durationHours = Math.floor(durationTotalMinutes / 60);
  const durationRemainingMinutes = durationTotalMinutes % 60;
  const formattedDuration = durationHours > 0
    ? `${durationHours}h${durationRemainingMinutes > 0 ? `${durationRemainingMinutes.toString().padStart(2, '0')}` : ''}`
    : `${durationRemainingMinutes} min`;

  // Mettre à jour l'heure de début
  const handleSelectQuickStart = (hour: number, minute: number) => {
    const newStart = setMinutes(setHours(startDate, hour), minute);
    const newEnd = addMinutes(newStart, durationTotalMinutes);
    onChange(newStart.toISOString(), newEnd.toISOString());
  };

  // Mettre à jour l'heure active
  const handleSelectHour = (newHour: number) => {
    if (activeTarget === 'start') {
      const updatedStart = setHours(startDate, newHour);
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

  // Piste visuelle interactive (Curseur visuel 24h)
  const sliderTrackRef = useRef<HTMLDivElement>(null);

  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalDayMins = ratio * 1440; // 24 * 60
    const snappedMins = Math.round(totalDayMins / 5) * 5;

    const hour = Math.floor(snappedMins / 60);
    const minute = snappedMins % 60;

    if (activeTarget === 'start') {
      const newStart = setMinutes(setHours(startDate, hour), minute);
      const newEnd = addMinutes(newStart, durationTotalMinutes);
      onChange(newStart.toISOString(), newEnd.toISOString());
    } else {
      let newEnd = setMinutes(setHours(endDate, hour), minute);
      if (newEnd <= startDate) newEnd = addMinutes(startDate, 15);
      onChange(startDate.toISOString(), newEnd.toISOString());
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-3.5 select-none touch-manipulation">
      {/* 1. Sélecteur Début vs Fin & Résumé visuel grand confort */}
      <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTarget('start')}
          className={clsx(
            'flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95',
            activeTarget === 'start'
              ? 'bg-white text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <span className="text-[10px] tracking-wider uppercase text-slate-400">Heure de Début</span>
          <span className="text-xl font-extrabold tracking-tight mt-0.5">
            {format(startDate, 'HH:mm')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTarget('end')}
          className={clsx(
            'flex flex-col items-center justify-center py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95',
            activeTarget === 'end'
              ? 'bg-white text-indigo-700 shadow-xs ring-2 ring-indigo-500/20'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <span className="text-[10px] tracking-wider uppercase text-slate-400">Heure de Fin</span>
          <span className="text-xl font-extrabold tracking-tight mt-0.5">
            {format(endDate, 'HH:mm')}
          </span>
        </button>
      </div>

      {/* 2. Badge résumé et boutons micro-ajustement fin (+5m / -5m) */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <div className="flex items-center gap-1.5 text-indigo-700 font-extrabold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
          <Clock className="w-3.5 h-3.5" />
          <span>{format(startDate, 'HH:mm')} → {format(endDate, 'HH:mm')} ({formattedDuration})</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleNudgeMinutes(-5)}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold active:scale-90 transition-transform"
            title="Reculer de 5 minutes"
          >
            -5m
          </button>
          <button
            type="button"
            onClick={() => handleNudgeMinutes(5)}
            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold active:scale-90 transition-transform"
            title="Avancer de 5 minutes"
          >
            +5m
          </button>
        </div>
      </div>

      {/* 3. Piste visuelle 24h interactive (Scrubber visuel) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1">
          <span>00h</span>
          <span>08h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </div>

        <div
          ref={sliderTrackRef}
          onClick={handleSliderClick}
          className="relative h-6 bg-slate-200 rounded-full cursor-pointer overflow-hidden p-0.5 shadow-inner"
        >
          {/* Plage sélectionnée */}
          <div
            style={{
              left: `${(startMinutesTotal / 1440) * 100}%`,
              width: `${Math.max(2, (durationTotalMinutes / 1440) * 100)}%`,
            }}
            className="absolute top-0.5 bottom-0.5 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full shadow-xs"
          />

          {/* Curseur actif */}
          <div
            style={{
              left: `${activeTarget === 'start' ? (startMinutesTotal / 1440) * 100 : (endMinutesTotal / 1440) * 100}%`,
            }}
            className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-white border-2 border-indigo-600 rounded-full shadow-md pointer-events-none"
          />
        </div>
      </div>

      {/* 4. Raccourcis Heure de Début en 1 Tap (Spécial Étudiants Médecine) */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          Heures de début fréquentes (1 tap) :
        </label>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_START_PRESETS.map((p) => {
            const isMatch = startHour === p.hour && startMinute === p.minute;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSelectQuickStart(p.hour, p.minute)}
                className={clsx(
                  'shrink-0 px-2 py-1 text-xs font-bold rounded-lg border transition-all active:scale-95',
                  isMatch
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Durées rapides en 1 Tap (+30m, +1h, +1h30, +2h, Garde 12h...) */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          Durée de l’activité (1 tap) :
        </label>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_DURATIONS.map((qd) => (
            <button
              key={qd.label}
              type="button"
              onClick={() => handleApplyDuration(qd.minutes)}
              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/70 rounded-lg text-xs font-bold text-slate-700 transition-colors active:scale-95"
            >
              {qd.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Grille des Heures (00h à 23h) */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Heure ({activeTarget === 'start' ? 'Début' : 'Fin'}) : {activeHour}h
        </label>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300">
          {Array.from({ length: 24 }).map((_, hour) => {
            const isSelected = activeHour === hour;
            return (
              <button
                key={hour}
                type="button"
                onClick={() => handleSelectHour(hour)}
                className={clsx(
                  'shrink-0 w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all active:scale-95',
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                )}
              >
                {hour.toString().padStart(2, '0')}h
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Grille des Minutes par paliers stricts de 5 min */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Minutes (Paliers de 5 min) : :{activeMinute.toString().padStart(2, '0')}
        </label>
        <div className="grid grid-cols-6 gap-1">
          {FIVE_MINUTE_INTERVALS.map((minute) => {
            const isSelected = activeMinute === minute;
            return (
              <button
                key={minute}
                type="button"
                onClick={() => handleSelectMinute(minute)}
                className={clsx(
                  'h-8 rounded-lg text-xs font-bold flex items-center justify-center transition-all active:scale-95',
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50'
                )}
              >
                :{minute.toString().padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
