import React, { useState, useEffect } from 'react';
import { Bell, Clock, X, Check, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActiveAlarm, alarmService } from '../services/alarmService';
import { getColorTheme } from '../constants/colors';

export const AlarmBanner: React.FC = () => {
  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>([]);

  useEffect(() => {
    const unsubscribe = alarmService.subscribe((alarm) => {
      setActiveAlarms((prev) => {
        // Éviter les doublons
        if (prev.some((a) => a.id === alarm.id)) return prev;
        return [...prev, alarm];
      });
    });

    return unsubscribe;
  }, []);

  const handleDismiss = (id: string) => {
    setActiveAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSnooze = (alarm: ActiveAlarm, minutes: number) => {
    alarmService.snoozeAlarm(alarm, minutes);
    handleDismiss(alarm.id);
  };

  if (activeAlarms.length === 0) return null;

  return (
    <div className="fixed top-3 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none safe-top">
      <AnimatePresence>
        {activeAlarms.map((alarm) => {
          const colorTheme = getColorTheme(alarm.color);

          return (
            <motion.div
              key={alarm.id}
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="pointer-events-auto w-full max-w-lg bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-apple-lg border-2 border-red-500/80 flex flex-col gap-3 ring-4 ring-red-500/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md animate-pulse shrink-0"
                    style={{ backgroundColor: colorTheme.borderAccent }}
                  >
                    <Bell className="w-5 h-5 animate-bounce" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" />
                        Rappel Médical Prioritaire
                      </span>
                      <span className="text-[11px] text-slate-400">• {alarm.timeString}</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">
                      {alarm.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {alarm.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDismiss(alarm.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Actions de rappel */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleSnooze(alarm, 5)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  +5 min
                </button>

                <button
                  type="button"
                  onClick={() => handleSnooze(alarm, 10)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5" />
                  +10 min
                </button>

                <button
                  type="button"
                  onClick={() => handleDismiss(alarm.id)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  Compris
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
