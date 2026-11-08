import { GridItem, DayColumn, TimeSlot, ParsedCourseEvent } from './types';

export const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0, janv: 0, fevrier: 1, 'février': 1,
  mars: 2, avril: 3, avr: 3, mai: 4, juin: 5, juillet: 6, juil: 6,
  aout: 7, 'août': 7, septembre: 8, sept: 8, octobre: 9, oct: 9,
  novembre: 10, nov: 10, decembre: 11, 'décembre': 11,
};

export const PROF_REGEX =
  /^(?:Pr|Dr|M\.|Mme|Prof)\b|Nicolas\s+Pottier|Philippe\s+Marchetti|R[ée]jane\s+Paumelle(?:\s+Lestrelin)?|M\.?Aubert-Baillot|Vincent\s+Deramecourt|Philippe\s+Derambure|Nicolas\s+Willand|M\s+Bertrand|Dr\s+Herteleer|Herteleer|Devinant|Deplanque|Thierry\s+Dine|Notredame\s+Charles-Edouard/i;

export const KNOWN_SUBJECTS = [
  'chimie et biochimie médicale',
  'biologie cellulaire et histologie',
  'métiers et système de santé',
  'santé société humanité',
  'pharmacologie',
  'anatomie',
  'biophysique',
  'ssh',
  'formation d’ouverture',
  'formation d\'ouverture',
];

export function isSubjectLine(str: string): boolean {
  const s = str.trim().toLowerCase();
  return (
    /^bcc\d|^ue\d/i.test(s) ||
    KNOWN_SUBJECTS.some((ks) => s === ks || s.startsWith(ks))
  );
}

/**
 * Détecte les colonnes de jours (Lundi à Vendredi) avec leurs dates réelles
 */
export function detectDayColumns(items: GridItem[], fallbackYear: number): DayColumn[] {
  const dayRegex = /(lundi|mardi|mercredi|jeudi|vendredi|samedi)\s+(\d{1,2})\s+([a-zéû.]+)(?:\s+(\d{4}))?/i;
  const singleDayRegex = /^(lundi|mardi|mercredi|jeudi|vendredi|samedi)$/i;
  const singleDateRegex = /^(\d{1,2})\s+([a-zéû.]+)(?:\s+(\d{4}))?$/i;

  const rawMatches: { dayName: string; dayNum: number; monthIdx: number; year: number; x: number; y: number }[] = [];

  for (const it of items) {
    const m = it.text.match(dayRegex);
    if (m) {
      const dayName = m[1].toLowerCase();
      const dayNum = parseInt(m[2], 10);
      const mName = m[3].toLowerCase();
      const yr = m[4] ? parseInt(m[4], 10) : fallbackYear;
      const monthIdx = FRENCH_MONTHS[mName] !== undefined ? FRENCH_MONTHS[mName] : new Date().getMonth();
      rawMatches.push({ dayName, dayNum, monthIdx, year: yr, x: it.x, y: it.y });
    }
  }

  // Détection en 2 lignes (cas où l'OCR photo sépare "lundi" et "19 octobre")
  if (rawMatches.length < 3) {
    const dayNameItems = items.filter((it) => singleDayRegex.test(it.text));
    for (const dIt of dayNameItems) {
      const dayName = dIt.text.toLowerCase();
      const nearbyDate = items.find(
        (it) =>
          singleDateRegex.test(it.text) &&
          Math.abs(it.x - dIt.x) < 50 &&
          Math.abs(it.y - dIt.y) < 60
      );
      if (nearbyDate) {
        const dm = nearbyDate.text.match(singleDateRegex);
        if (dm) {
          const dayNum = parseInt(dm[1], 10);
          const mName = dm[2].toLowerCase();
          const yr = dm[3] ? parseInt(dm[3], 10) : fallbackYear;
          const monthIdx = FRENCH_MONTHS[mName] !== undefined ? FRENCH_MONTHS[mName] : new Date().getMonth();
          if (!rawMatches.some((rm) => rm.dayName === dayName)) {
            rawMatches.push({ dayName, dayNum, monthIdx, year: yr, x: dIt.x, y: dIt.y });
          }
        }
      }
    }
  }

  if (rawMatches.length === 0) return [];

  // Grouper les jours par hauteur Y pour isoler la ligne d'en-tête principale
  const yCounts: Record<number, number> = {};
  for (const d of rawMatches) {
    const roundedY = Math.round(d.y / 35) * 35;
    yCounts[roundedY] = (yCounts[roundedY] || 0) + 1;
  }
  const headerY = parseInt(Object.keys(yCounts).sort((a, b) => yCounts[Number(b)] - yCounts[Number(a)])[0], 10);
  const headerDays = rawMatches.filter((d) => Math.abs(d.y - headerY) < 45);
  headerDays.sort((a, b) => a.x - b.x);

  if (headerDays.length === 0) return [];

  const avgColWidth =
    headerDays.length > 1
      ? (headerDays[headerDays.length - 1].x - headerDays[0].x) / (headerDays.length - 1)
      : 600;

  return headerDays.map((hd, i) => {
    const prev = headerDays[i - 1];
    const next = headerDays[i + 1];
    const xMin = prev ? (prev.x + hd.x) / 2 : Math.max(0, hd.x - avgColWidth * 0.4);
    const xMax = next ? (hd.x + next.x) / 2 : hd.x + avgColWidth * 0.6;
    const isoDate = `${hd.year}-${String(hd.monthIdx + 1).padStart(2, '0')}-${String(hd.dayNum).padStart(2, '0')}`;
    return {
      dayName: hd.dayName,
      dayNum: hd.dayNum,
      monthIdx: hd.monthIdx,
      year: hd.year,
      xCenter: hd.x,
      xMin,
      xMax,
      isoDate,
    };
  });
}

/**
 * Détecte les créneaux horaires (08h00-09h00, 10h00-11h00, 13h30-14h30, etc.)
 */
export function detectTimeSlots(items: GridItem[]): TimeSlot[] {
  const timeRegex = /^(\d{1,2})[h:](\d{2})?\s*[-à]\s*(\d{1,2})[h:](\d{2})?$/i;
  const timeItems = items.filter((it) => timeRegex.test(it.text));

  const distinctRows: { y: number; startH: number; startM: number; endH: number; endM: number }[] = [];
  for (const ti of timeItems) {
    const m = ti.text.match(timeRegex);
    if (!m) continue;
    const startH = parseInt(m[1], 10);
    const startM = m[2] ? parseInt(m[2], 10) : 0;
    const endH = parseInt(m[3], 10);
    const endM = m[4] ? parseInt(m[4], 10) : 0;

    if (!distinctRows.some((r) => r.startH === startH && Math.abs(r.y - ti.y) < 30)) {
      distinctRows.push({ y: ti.y, startH, startM, endH, endM });
    }
  }

  distinctRows.sort((a, b) => a.startH - b.startH);
  if (distinctRows.length === 0) return [];

  // Détection de l'orientation Y (PDF: Y=0 en bas, Image/Écran: Y=0 en haut)
  const isYInverted = distinctRows.length > 1 && distinctRows[1].y < distinctRows[0].y;

  const avgRowHeight =
    distinctRows.length > 1
      ? Math.abs(distinctRows[distinctRows.length - 1].y - distinctRows[0].y) / (distinctRows.length - 1)
      : 400;

  return distinctRows.map((r, i) => {
    let yMin: number, yMax: number;
    if (isYInverted) {
      const next = distinctRows[i + 1];
      yMax = r.y + 20;
      // Pour la dernière ligne, borner strictement à 0.85 * avgRowHeight pour NE PAS mordre sur le footer
      yMin = next ? next.y + 20 : r.y - avgRowHeight * 0.85;
    } else {
      const next = distinctRows[i + 1];
      yMin = r.y - 15;
      yMax = next ? next.y - 15 : r.y + avgRowHeight * 0.85;
    }
    return {
      yCenter: r.y,
      yMin: Math.min(yMin, yMax),
      yMax: Math.max(yMin, yMax),
      startH: r.startH,
      startM: r.startM,
      endH: r.endH,
      endM: r.endM,
    };
  });
}

/**
 * Parseur 2D pur pour grille d'emploi du temps
 */
export function parseGrid(items: GridItem[]): ParsedCourseEvent[] {
  if (items.length < 5) return [];

  // 1. Détection de l'année
  let detectedYear = new Date().getFullYear();
  for (const it of items) {
    const yM = it.text.match(/\b(202[4-9])\b/);
    if (yM) {
      detectedYear = parseInt(yM[1], 10);
      break;
    }
  }

  // 2. Colonnes
  const cols = detectDayColumns(items, detectedYear);
  if (cols.length === 0) return [];

  // 3. Lignes (Créneaux horaires)
  const slots = detectTimeSlots(items);
  if (slots.length === 0) return [];

  const timeRegex = /^(\d{1,2})[h:](\d{2})?\s*[-à]\s*(\d{1,2})[h:](\d{2})?$/i;
  const isYInverted = slots.length > 1 && slots[1].yCenter < slots[0].yCenter;

  const rawCourses: ParsedCourseEvent[] = [];

  for (const col of cols) {
    const isVendredi = col.dayName.includes('ven');

    // Cas spécial Vendredi : UE Ouverture (Sciences & Santé) de 08h30 à 11h30
    if (isVendredi) {
      const vendrediItems = items.filter(
        (it) => it.x >= col.xMin && it.x < col.xMax && /ouverture|formation/i.test(it.text)
      );
      if (vendrediItems.length > 0) {
        rawCourses.push({
          id: `pass-${col.isoDate}-ouverture`,
          title: 'UE Ouverture : Sciences & Santé',
          subject: 'Formation d’ouverture',
          professor: 'Enseignements d’ouverture',
          startTime: `${col.isoDate}T08:30:00`,
          endTime: `${col.isoDate}T11:30:00`,
          color: 'bu',
          category: 'Ouverture',
        });
      }
      // On ignore tout le reste de la colonne du vendredi (notes de bas de page des facultés)
      continue;
    }

    for (const slot of slots) {
      const cellItems = items.filter(
        (it) =>
          it.x >= col.xMin &&
          it.x < col.xMax &&
          it.y >= slot.yMin &&
          it.y <= slot.yMax &&
          !timeRegex.test(it.text) &&
          it.text !== '---'
      );

      cellItems.sort((a, b) => (isYInverted ? b.y - a.y : a.y - b.y));
      const lines = cellItems.map((it) => it.text);

      if (lines.length === 0) continue;

      // Cas Jour Férié
      if (lines.some((l) => /férié|ferie/i.test(l))) {
        rawCourses.push({
          id: `pass-${col.isoDate}-${slot.startH}-ferie`,
          title: 'Jour Férié',
          subject: 'Férié',
          professor: '',
          startTime: `${col.isoDate}T${String(slot.startH).padStart(2, '0')}:${String(slot.startM).padStart(2, '0')}:00`,
          endTime: `${col.isoDate}T${String(slot.endH).padStart(2, '0')}:${String(slot.endM).padStart(2, '0')}:00`,
          color: 'bu',
          category: 'Férié',
        });
        continue;
      }

      let bcc = '';
      let detectedSubject = '';
      let prof = '';
      const rawTitles: string[] = [];

      for (const line of lines) {
        if (/^BCC\d|^UE\d/i.test(line)) {
          bcc = line;
        } else if (PROF_REGEX.test(line)) {
          prof = line;
        } else if (isSubjectLine(line)) {
          detectedSubject = line;
        } else if (
          line !== '---' &&
          !/pass@univ-lille/i.test(line) &&
          !/suivre les indications/i.test(line)
        ) {
          rawTitles.push(line);
        }
      }

      const cleanTitles: string[] = [];
      for (const t of rawTitles) {
        if (!cleanTitles.some((ct) => ct.toLowerCase() === t.toLowerCase())) {
          cleanTitles.push(t);
        }
      }

      const subjectParts = [bcc, detectedSubject].filter(Boolean);
      const finalSubject = subjectParts.join(' - ') || 'Faculté de Médecine';
      let title = cleanTitles.length > 0 ? cleanTitles.join(' : ') : detectedSubject || bcc || 'Cours Faculté';

      // Affinement des intitulés courts
      if (title.toLowerCase() === 'généralités' || title.toLowerCase() === 'generalites') {
        title = detectedSubject ? `${detectedSubject} : Généralités` : 'Anatomie générale : Généralités';
      } else if (title.toLowerCase() === 'étique' || title.toLowerCase() === 'éthique') {
        title = 'Éthique médicale';
      } else if (title.toLowerCase() === 'anthropologie') {
        title = 'Anthropologie & Société';
      }

      let color = 'cours';
      const titleLower = title.toLowerCase();
      const subjectLower = finalSubject.toLowerCase();
      if (
        titleLower.includes('ssh') ||
        titleLower.includes('anthropologie') ||
        titleLower.includes('éthique') ||
        titleLower.includes('étique') ||
        titleLower.includes('tutorat') ||
        subjectLower.includes('ssh') ||
        subjectLower.includes('santé société humanité')
      ) {
        color = 'tutorat';
      } else if (titleLower.includes('stage') || titleLower.includes('clinique') || titleLower.includes('hôpital')) {
        color = 'stage';
      }

      const startIso = `${col.isoDate}T${String(slot.startH).padStart(2, '0')}:${String(slot.startM).padStart(2, '0')}:00`;
      const endIso = `${col.isoDate}T${String(slot.endH).padStart(2, '0')}:${String(slot.endM).padStart(2, '0')}:00`;

      rawCourses.push({
        id: `pass-${col.isoDate}-${slot.startH}`,
        title,
        subject: finalSubject,
        professor: prof,
        startTime: startIso,
        endTime: endIso,
        color,
        category: 'Faculté',
      });
    }
  }

  return mergeConsecutiveCourses(rawCourses);
}

/**
 * Fusionne intelligemment les créneaux contigus du même cours et même enseignant
 * et élimine les doublons stricts (ex: en-tête répété sur Page 1 et Page 2)
 */
export function mergeConsecutiveCourses(courses: ParsedCourseEvent[]): ParsedCourseEvent[] {
  if (courses.length <= 1) return courses;

  const sorted = [...courses].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // 1. Élimination des doublons stricts (même date/heure et même titre)
  const uniqueCourses: ParsedCourseEvent[] = [];
  const seenKeys = new Set<string>();
  for (const c of sorted) {
    const key = `${c.startTime}_${c.endTime}_${c.title.toLowerCase().trim()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueCourses.push(c);
    }
  }

  const merged: ParsedCourseEvent[] = [];

  for (let i = 0; i < uniqueCourses.length; i++) {
    const current = { ...uniqueCourses[i] };

    while (i + 1 < uniqueCourses.length) {
      const next = uniqueCourses[i + 1];
      const currentEnd = new Date(current.endTime).getTime();
      const nextStart = new Date(next.startTime).getTime();
      const isContiguous = currentEnd === nextStart;

      const sameProf =
        current.professor &&
        next.professor &&
        current.professor.toLowerCase().trim() === next.professor.toLowerCase().trim();

      const sameSubject =
        current.subject &&
        next.subject &&
        (current.subject.toLowerCase() === next.subject.toLowerCase() ||
          current.subject.includes(next.subject) ||
          next.subject.includes(current.subject));

      const cleanPrefix = (str: string) => str.split(':')[0].trim().toLowerCase();
      const sameTitle =
        cleanPrefix(current.title) === cleanPrefix(next.title) ||
        current.title.toLowerCase().includes(cleanPrefix(next.title)) ||
        next.title.toLowerCase().includes(cleanPrefix(current.title));

      // On fusionne si les créneaux sont contigus ET :
      // - même enseignant, OU
      // - même matière et même titre principal (ex: Biologie cellulaire Noyau 3 & Mitochondrie 1)
      const samePrefix = cleanPrefix(current.title) === cleanPrefix(next.title);

      if (isContiguous && (sameProf || (sameSubject && (sameTitle || samePrefix)))) {
        current.endTime = next.endTime;

        if (current.professor && next.professor && current.professor.toLowerCase().trim() !== next.professor.toLowerCase().trim()) {
          current.professor = `${current.professor} & ${next.professor}`;
        } else if (!current.professor && next.professor) {
          current.professor = next.professor;
        }

        const t1 = current.title.trim();
        const t2 = next.title.trim();

        if (t1.toLowerCase() === t2.toLowerCase() || t1.toLowerCase().includes(t2.toLowerCase())) {
          // Identique ou déjà inclus
        } else if (t2.toLowerCase().includes(t1.toLowerCase())) {
          current.title = t2;
        } else {
          const p1 = t1.split(':').map((s) => s.trim());
          const p2 = t2.split(':').map((s) => s.trim());
          if (p1.length > 1 && p2.length > 1 && p1[0].toLowerCase() === p2[0].toLowerCase()) {
            current.title = `${p1[0]} : ${p1.slice(1).join(' : ')} & ${p2.slice(1).join(' : ')}`;
          } else {
            current.title = `${t1} & ${t2}`;
          }
        }

        i++;
      } else {
        break;
      }
    }

    merged.push(current);
  }

  return merged;
}
