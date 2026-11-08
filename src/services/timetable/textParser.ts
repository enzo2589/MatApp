import { ParsedCourseEvent } from './types';
import { FRENCH_MONTHS, PROF_REGEX, isSubjectLine, mergeConsecutiveCourses } from './gridParser';
import { addDays, startOfWeek } from 'date-fns';

const DAYS_KEYWORDS = [
  { name: 'lundi', short: 'lun', dayOffset: 0 },
  { name: 'mardi', short: 'mar', dayOffset: 1 },
  { name: 'mercredi', short: 'mer', dayOffset: 2 },
  { name: 'jeudi', short: 'jeu', dayOffset: 3 },
  { name: 'vendredi', short: 'ven', dayOffset: 4 },
  { name: 'samedi', short: 'sam', dayOffset: 5 },
  { name: 'dimanche', short: 'dim', dayOffset: 6 },
];

/**
 * Parseur textuel de secours pour textes collés ou formats non-grille
 */
export function parsePlainText(rawText: string, referenceMonday?: Date): ParsedCourseEvent[] {
  const events: ParsedCourseEvent[] = [];
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let detectedYear = new Date().getFullYear();
  for (const line of lines) {
    const ym = line.match(/\b(202[4-9])\b/);
    if (ym) {
      detectedYear = parseInt(ym[1], 10);
      break;
    }
  }

  let currentMonday = referenceMonday ? new Date(referenceMonday) : null;

  const weekRegex = /semaine(?:\s+du)?\s+(\d{1,2})\s+([a-zéû.]+)(?:\s+(\d{4}))?/i;
  for (const line of lines) {
    const wm = line.match(weekRegex);
    if (wm) {
      const d = parseInt(wm[1], 10);
      const mName = wm[2].toLowerCase();
      const y = wm[3] ? parseInt(wm[3], 10) : detectedYear;
      const mIdx = FRENCH_MONTHS[mName] !== undefined ? FRENCH_MONTHS[mName] : new Date().getMonth();
      const detectedDate = new Date(y, mIdx, d);
      currentMonday = startOfWeek(detectedDate, { weekStartsOn: 1 });
      break;
    }
  }

  if (!currentMonday) {
    currentMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  }

  const dayDates: Record<number, string> = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(currentMonday, i);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    dayDates[i] = `${yr}-${mo}-${da}`;
  }

  const dayHeaderRegex = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun\.?|mar\.?|mer\.?|jeu\.?|ven\.?|sam\.?|dim\.?)(?:\s+(\d{1,2})(?:[\/\.-](\d{1,2})(?:[\/\.-](\d{2,4}))?|\s+([a-zéû.]+)(?:\s+(\d{4}))?)?)?/i;
  const timeSlotRegex = /(\d{1,2})\s*[h:H]\s*(\d{2})?\s*(?:-|à|au|–|—)\s*(\d{1,2})\s*[h:H]\s*(\d{2})?/i;

  let currentDayOffset = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    const dayMatch = line.match(dayHeaderRegex);
    if (dayMatch) {
      const rawName = dayMatch[1].toLowerCase().replace('.', '');
      const dayKw = DAYS_KEYWORDS.find((d) => d.name === rawName || d.short === rawName);
      if (dayKw) {
        currentDayOffset = dayKw.dayOffset;
      }
      continue;
    }

    const timeMatch = line.match(timeSlotRegex);
    if (timeMatch) {
      const startH = parseInt(timeMatch[1], 10);
      const startM = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const endH = parseInt(timeMatch[3], 10);
      const endM = timeMatch[4] ? parseInt(timeMatch[4], 10) : 0;

      if (startH < 6 || startH > 22 || endH < startH || endH > 23) continue;

      const dateStr = dayDates[currentDayOffset] || dayDates[0];
      const startIso = `${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;
      const endIso = `${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

      let inlineText = line.replace(timeMatch[0], '').replace(/^[:\s-]+|[:\s-]+$/g, '').trim();

      const surroundingCandidates: string[] = [];
      for (let nextOffset = 1; nextOffset <= 3 && idx + nextOffset < lines.length; nextOffset++) {
        const targetIdx = idx + nextOffset;
        const nextLine = lines[targetIdx];
        if (dayHeaderRegex.test(nextLine) || timeSlotRegex.test(nextLine)) break;
        surroundingCandidates.push(nextLine);
      }

      let title = inlineText;
      let prof = '';
      let subject = 'Faculté de Médecine';

      for (const cand of surroundingCandidates) {
        if (PROF_REGEX.test(cand)) {
          prof = cand;
        } else if (/^BCC\d|^UE\d/i.test(cand) || isSubjectLine(cand)) {
          subject = cand;
        } else if (!title) {
          title = cand;
        }
      }

      if (!title) {
        title = subject !== 'Faculté de Médecine' ? subject : 'Cours Faculté';
      }

      events.push({
        id: `text-${dateStr}-${startH}`,
        title,
        subject,
        professor: prof,
        startTime: startIso,
        endTime: endIso,
        color: 'cours',
        category: 'Faculté',
      });
    }
  }

  return mergeConsecutiveCourses(events);
}
