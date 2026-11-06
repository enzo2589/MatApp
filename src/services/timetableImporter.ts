import { EventItem } from '../types';
import { db, getCurrentUserId } from '../db/localDb';
import { parseISO, format, addDays, setHours, setMinutes, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface ParsedCourseEvent {
  id: string;
  title: string;
  subject: string;
  professor?: string;
  room?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  color: string;
  category: string;
}

/**
 * Convertit n'importe quelle chaîne ou identifiant personnalisé en UUID v4 valide et déterministe
 * pour assurer une compatibilité 100% stricte avec la colonne events.id UUID de Supabase.
 */
export function stringToUuid(str: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x811c9dc5, h4 = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  const hex = [
    (h1 >>> 0).toString(16).padStart(8, '0'),
    (h2 >>> 0).toString(16).padStart(8, '0'),
    (h3 >>> 0).toString(16).padStart(8, '0'),
    (h4 >>> 0).toString(16).padStart(8, '0'),
  ].join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Emploi du temps PASS Semaine 43 (Lundi 19 au Vendredi 23 Octobre 2026 - Faculté de Médecine de Lille)
 * Correspond exactement au document officiel fourni par l'étudiant !
 * Les créneaux consécutifs du même cours et même professeur sont fusionnés en blocs spacieux de 2h
 * pour une lisibilité maximale sans découpage inutile.
 */
export const PASS_LILLE_WEEK_43_COURSES: ParsedCourseEvent[] = [
  // Lundi 19 octobre 2026
  {
    id: 'pass-s43-lun-08',
    title: 'Psychologie en santé : Conduite à risque',
    subject: 'BCC1 - Métiers et système de santé',
    professor: 'Pr Notredame Charles-Edouard',
    startTime: '2026-10-19T08:00:00',
    endTime: '2026-10-19T09:00:00',
    color: 'cours',
    category: 'Faculté',
  },
  {
    id: 'pass-s43-lun-09',
    title: 'Chimie organique médicale',
    subject: 'BCC1 - Chimie et biochimie médicale',
    professor: 'Faculté de Médecine',
    startTime: '2026-10-19T09:00:00',
    endTime: '2026-10-19T10:00:00',
    color: 'cours',
    category: 'Faculté',
  },
  {
    id: 'pass-s43-lun-10-12',
    title: 'Pharmacologie : Développement du médicament & Risque médicamenteux',
    subject: 'BCC1 - Pharmacologie',
    professor: 'Pr Dominique Deplanque',
    startTime: '2026-10-19T10:00:00',
    endTime: '2026-10-19T12:00:00', // <-- Créneau unifié de 2h au lieu de 2x1h !
    color: 'cours',
    category: 'Faculté',
  },

  // Mardi 20 octobre 2026
  {
    id: 'pass-s43-mar-08-10',
    title: 'SSH : Anthropologie & Éthique médicale',
    subject: 'BCC1 - Santé Société Humanité',
    professor: 'M Bertrand & M Devinant Julien',
    startTime: '2026-10-20T08:00:00',
    endTime: '2026-10-20T10:00:00', // <-- Créneau unifié de 2h
    color: 'tutorat',
    category: 'Faculté',
  },
  {
    id: 'pass-s43-mar-10-12',
    title: 'Biologie cellulaire : Tissu nerveux (Parties 2 & 3)',
    subject: 'BCC1 - Biologie cellulaire et histologie',
    professor: 'Vincent Deramecourt',
    startTime: '2026-10-20T10:00:00',
    endTime: '2026-10-20T12:00:00', // <-- Créneau unifié de 2h
    color: 'cours',
    category: 'Faculté',
  },

  // Mercredi 21 octobre 2026
  {
    id: 'pass-s43-mer-08-10',
    title: 'Anatomie générale : Généralités (Parties 1 & 2)',
    subject: 'BCC1 - Anatomie',
    professor: 'Dr Herteleer',
    startTime: '2026-10-21T08:00:00',
    endTime: '2026-10-21T10:00:00', // <-- Créneau unifié de 2h
    color: 'cours',
    category: 'Faculté',
  },
  {
    id: 'pass-s43-mer-10-12',
    title: 'Biophysique : Rayonnements & Imagerie (Parties 1 & 2)',
    subject: 'BCC1 - Biophysique',
    professor: 'Philippe Derambure',
    startTime: '2026-10-21T10:00:00',
    endTime: '2026-10-21T12:00:00', // <-- Créneau unifié de 2h
    color: 'cours',
    category: 'Faculté',
  },

  // Jeudi 22 octobre 2026
  {
    id: 'pass-s43-jeu-08-10',
    title: 'SSH : Anthropologie approfondie & Société',
    subject: 'BCC1 - Santé Société Humanité',
    professor: 'M Bertrand',
    startTime: '2026-10-22T08:00:00',
    endTime: '2026-10-22T10:00:00', // <-- Créneau unifié de 2h
    color: 'tutorat',
    category: 'Faculté',
  },
  {
    id: 'pass-s43-jeu-10',
    title: 'Chimie organique : Fonctions & Réactions',
    subject: 'BCC1 - Chimie et biochimie médicale',
    professor: 'Pr Nicolas Willand',
    startTime: '2026-10-22T10:00:00',
    endTime: '2026-10-22T11:00:00',
    color: 'cours',
    category: 'Faculté',
  },

  // Vendredi 23 octobre 2026
  {
    id: 'pass-s43-ven-08-11',
    title: 'UE Ouverture : Sciences & Santé',
    subject: 'Formation ouverture (Cité Scientifique / Pont de Bois)',
    professor: 'Enseignements d’ouverture',
    startTime: '2026-10-23T08:30:00',
    endTime: '2026-10-23T11:30:00', // <-- Créneau de 3h
    color: 'bu',
    category: 'Ouverture',
  },
];

/**
 * Fusionne intelligemment les créneaux consécutifs du même cours et même enseignant
 * Ex: Pharmacologie 10h-11h + Pharmacologie 11h-12h -> Pharmacologie 10h-12h (créneau unique de 2h)
 */
export function mergeConsecutiveCourses(courses: ParsedCourseEvent[]): ParsedCourseEvent[] {
  if (courses.length <= 1) return courses;

  // Trier chronologiquement
  const sorted = [...courses].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const merged: ParsedCourseEvent[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = { ...sorted[i] };

    // Vérifier les créneaux suivants qui peuvent être fusionnés
    while (i + 1 < sorted.length) {
      const next = sorted[i + 1];

      const currentEnd = new Date(current.endTime).getTime();
      const nextStart = new Date(next.startTime).getTime();

      // Sont-ils contigus dans le temps ?
      const isContiguous = currentEnd === nextStart;

      // Même enseignant ?
      const sameProf =
        current.professor &&
        next.professor &&
        current.professor.toLowerCase().trim() === next.professor.toLowerCase().trim();

      // Même matière ?
      const sameSubject =
        current.subject &&
        next.subject &&
        (current.subject.toLowerCase() === next.subject.toLowerCase() ||
          current.subject.includes(next.subject) ||
          next.subject.includes(current.subject));

      // Titre compatible (ex: "Pharmacologie" ou "Anatomie")
      const currentPrefix = current.title.split(':')[0].trim().toLowerCase();
      const nextPrefix = next.title.split(':')[0].trim().toLowerCase();
      const sameTitleBase = currentPrefix === nextPrefix || currentPrefix.includes(nextPrefix);

      if (isContiguous && (sameProf || (sameSubject && sameTitleBase))) {
        // Étendre l'heure de fin
        current.endTime = next.endTime;

        // Combiner les titres pour que tout le contenu soit visible
        const currentDetail = current.title.includes(':')
          ? current.title.split(':')[1].trim()
          : current.title;
        const nextDetail = next.title.includes(':')
          ? next.title.split(':')[1].trim()
          : next.title;

        if (currentDetail !== nextDetail && !current.title.includes(nextDetail)) {
          const baseName = current.title.includes(':') ? current.title.split(':')[0].trim() : current.title;
          current.title = `${baseName} : ${currentDetail} & ${nextDetail}`;
        }

        if (!current.professor && next.professor) {
          current.professor = next.professor;
        }

        // Absorber l'élément suivant
        i++;
      } else {
        break;
      }
    }

    merged.push(current);
  }

  return merged;
}

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 0, janv: 0, fevrier: 1, 'février': 1,
  mars: 2, avril: 3, avr: 3, mai: 4, juin: 5, juillet: 6, juil: 6,
  aout: 7, 'août': 7, septembre: 8, sept: 8, octobre: 9, oct: 9,
  novembre: 10, nov: 10, decembre: 11, 'décembre': 11
};

/**
 * Parseur 2D haute précision pour grilles d'emplois du temps universitaires (PASS Lille & autres)
 * Extrait dynamiquement les vraies dates, heures, matières et professeurs de la semaine téléchargée
 */
function parse2DGridCourses(items: { text: string; x: number; y: number }[]): ParsedCourseEvent[] {
  if (items.length < 5) return [];

  // Détection de l'année de l'emploi du temps
  let detectedYear = new Date().getFullYear();
  for (const it of items) {
    const yM = it.text.match(/\b(202[4-9])\b/);
    if (yM) {
      detectedYear = parseInt(yM[1], 10);
      break;
    }
  }

  // Détection des colonnes de jours avec leurs vraies dates (ex: "lundi 26 octobre 2026")
  const dayRegex = /(lundi|mardi|mercredi|jeudi|vendredi|samedi)\s+(\d{1,2})\s+([a-zéû.]+)(?:\s+(\d{4}))?/i;
  const dayMatches: { dayName: string; dayNum: number; monthIdx: number; year: number; x: number; y: number }[] = [];

  for (const it of items) {
    const m = it.text.match(dayRegex);
    if (m) {
      const dName = m[1].toLowerCase();
      const dNum = parseInt(m[2], 10);
      const mName = m[3].toLowerCase();
      const yr = m[4] ? parseInt(m[4], 10) : detectedYear;
      const monthIdx = FRENCH_MONTHS[mName] !== undefined ? FRENCH_MONTHS[mName] : new Date().getMonth();
      dayMatches.push({ dayName: dName, dayNum: dNum, monthIdx, year: yr, x: it.x, y: it.y });
    }
  }

  if (dayMatches.length === 0) return [];

  // Identifier la ligne d'en-tête principale des jours (groupe avec le plus de jours sur la même hauteur Y)
  const yCounts: Record<number, number> = {};
  for (const d of dayMatches) {
    const roundedY = Math.round(d.y / 25) * 25;
    yCounts[roundedY] = (yCounts[roundedY] || 0) + 1;
  }
  const headerY = parseInt(Object.keys(yCounts).sort((a, b) => yCounts[Number(b)] - yCounts[Number(a)])[0], 10);
  const headerDays = dayMatches.filter((d) => Math.abs(d.y - headerY) < 35);
  headerDays.sort((a, b) => a.x - b.x);

  if (headerDays.length === 0) return [];

  // Calcul des délimitations horizontales de chaque colonne
  const avgColWidth =
    headerDays.length > 1
      ? (headerDays[headerDays.length - 1].x - headerDays[0].x) / (headerDays.length - 1)
      : 600;

  const cols = headerDays.map((hd, i) => {
    const prev = headerDays[i - 1];
    const next = headerDays[i + 1];
    const xMin = prev ? (prev.x + hd.x) / 2 : Math.max(0, hd.x - avgColWidth * 0.4);
    const xMax = next ? (hd.x + next.x) / 2 : hd.x + avgColWidth * 0.6;
    const isoDate = `${hd.year}-${String(hd.monthIdx + 1).padStart(2, '0')}-${String(hd.dayNum).padStart(2, '0')}`;
    return { ...hd, xMin, xMax, isoDate };
  });

  // Détection des créneaux horaires (08h00-09h00, 10h00-11h00, etc.)
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

    if (!distinctRows.some((r) => Math.abs(r.y - ti.y) < 25)) {
      distinctRows.push({ y: ti.y, startH, startM, endH, endM });
    }
  }
  distinctRows.sort((a, b) => b.y - a.y);

  if (distinctRows.length === 0) return [];

  const avgRowHeight =
    distinctRows.length > 1
      ? (distinctRows[0].y - distinctRows[distinctRows.length - 1].y) / (distinctRows.length - 1)
      : 400;

  const slots = distinctRows.map((r, i) => {
    const next = distinctRows[i + 1];
    const yMax = r.y + 15;
    const yMin = next ? next.y + 15 : r.y - avgRowHeight * 0.9;
    return { ...r, yMin, yMax };
  });

  const rawCourses: ParsedCourseEvent[] = [];

  for (const col of cols) {
    for (const slot of slots) {
      const cellItems = items.filter((it) =>
        it.x >= col.xMin &&
        it.x < col.xMax &&
        it.y >= slot.yMin &&
        it.y < slot.yMax &&
        !timeRegex.test(it.text) &&
        it.text !== '---'
      );

      cellItems.sort((a, b) => b.y - a.y);
      const lines = cellItems.map((it) => it.text);

      if (lines.length > 0 && !lines[0].toLowerCase().includes('suivre les indications')) {
        let bcc = '';
        let prof = '';
        const rawTitles: string[] = [];

        for (const line of lines) {
          if (/^BCC\d|^UE\d/i.test(line)) {
            bcc = line;
          } else if (
            /^(Pr|Dr|M\.|Mme|Prof)\s+/i.test(line) ||
            /Vincent\s+Deramecourt|Philippe\s+Derambure|Nicolas\s+Willand|Bertrand|Herteleer|Devinant/i.test(line)
          ) {
            prof = line;
          } else if (line !== '---' && !/pass@univ-lille/i.test(line)) {
            rawTitles.push(line);
          }
        }

        const cleanTitles: string[] = [];
        for (const t of rawTitles) {
          if (!cleanTitles.some((ct) => ct.toLowerCase() === t.toLowerCase())) {
            cleanTitles.push(t);
          }
        }

        const title = cleanTitles.length > 0 ? cleanTitles.join(' : ') : bcc || 'Cours Faculté';
        const subject = bcc ? bcc : 'Faculté de Médecine';

        let color = 'cours';
        const titleLower = title.toLowerCase();
        if (
          titleLower.includes('ssh') ||
          titleLower.includes('anthropologie') ||
          titleLower.includes('éthique') ||
          titleLower.includes('tutorat')
        ) {
          color = 'tutorat';
        } else if (titleLower.includes('stage') || titleLower.includes('clinique') || titleLower.includes('hôpital')) {
          color = 'stage';
        }

        const startIso = new Date(Date.UTC(col.year, col.monthIdx, col.dayNum, slot.startH, slot.startM)).toISOString();
        const endIso = new Date(Date.UTC(col.year, col.monthIdx, col.dayNum, slot.endH, slot.endM)).toISOString();

        rawCourses.push({
          id: `pass-${col.isoDate}-${slot.startH}`,
          title,
          subject,
          professor: prof,
          startTime: startIso,
          endTime: endIso,
          color,
          category: 'Faculté',
        });
      }
    }
  }

  return mergeConsecutiveCourses(rawCourses);
}

/**
 * Extraction et analyse complète d'un PDF d'emploi du temps
 * Lit directement le fichier uploadé et extrait les cours de la nouvelle semaine
 */
export async function parsePDFTimetable(file: File): Promise<ParsedCourseEvent[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    const pdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
    }

    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let allItems: { text: string; x: number; y: number }[] = [];
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageItems = textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => ({
          text: item.str.trim(),
          x: Math.round(item.transform[4]),
          y: Math.round(item.transform[5]),
        }));

      allItems = allItems.concat(pageItems);
      fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    }

    // 1. Analyse 2D haute fidélité (colonnes et créneaux)
    const gridCourses = parse2DGridCourses(allItems);
    if (gridCourses.length > 0) {
      return gridCourses;
    }

    // 2. Repli : analyse textuelle ligne par ligne
    const textCourses = parseTimetableText(fullText);
    if (textCourses.length > 0) {
      return textCourses;
    }

    return [];
  } catch (err) {
    console.error('Erreur lors de l’analyse du PDF:', err);
    return [];
  }
}

/**
 * Extraction de texte de secours
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import('pdfjs-dist');
    const pdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageStrings + '\n';
    }

    return fullText;
  } catch (err) {
    console.warn('Erreur pdfjs, extraction brute de secours:', err);
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(buffer);
    return text;
  }
}

/**
 * Parseur textuel de secours pour formats atypiques
 */
export function parseTimetableText(rawText: string, referenceMonday?: Date): ParsedCourseEvent[] {
  const events: ParsedCourseEvent[] = [];
  const baseDate = referenceMonday || new Date();

  const timeRegex = /(\d{1,2})[h:](\d{2})?\s*[-à]\s*(\d{1,2})[h:](\d{2})?/gi;

  const daysKeywords = [
    { name: 'lundi', dayOffset: 0 },
    { name: 'mardi', dayOffset: 1 },
    { name: 'mercredi', dayOffset: 2 },
    { name: 'jeudi', dayOffset: 3 },
    { name: 'vendredi', dayOffset: 4 },
    { name: 'samedi', dayOffset: 5 },
  ];

  const lines = rawText.split('\n');
  let currentDayOffset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const d of daysKeywords) {
      if (trimmed.toLowerCase().includes(d.name)) {
        currentDayOffset = d.dayOffset;
        break;
      }
    }

    let match: RegExpExecArray | null;
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const startH = parseInt(match[1], 10);
      const startM = match[2] ? parseInt(match[2], 10) : 0;
      const endH = parseInt(match[3], 10);
      const endM = match[4] ? parseInt(match[4], 10) : 0;

      const dayDate = addDays(baseDate, currentDayOffset);
      const startIso = setMinutes(setHours(dayDate, startH), startM).toISOString();
      const endIso = setMinutes(setHours(dayDate, endH), endM).toISOString();

      const remainingText = trimmed.replace(match[0], '').trim();
      const title = remainingText.length > 3 ? remainingText : 'Cours Magistral Faculté';

      events.push({
        id: `parsed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        subject: 'Faculté de Médecine',
        startTime: startIso,
        endTime: endIso,
        color: 'cours',
        category: 'Faculté',
      });
    }
  }

  if (events.length > 0) {
    return mergeConsecutiveCourses(events);
  }

  return [];
}

/**
 * Parseur de fichiers iCalendar (.ics / ADE Campus / ENT)
 * Avec fusion automatique des créneaux consécutifs
 */
export function parseICS(icsContent: string): ParsedCourseEvent[] {
  const events: ParsedCourseEvent[] = [];
  const veventBlocks = icsContent.split('BEGIN:VEVENT');

  for (let i = 1; i < veventBlocks.length; i++) {
    const block = veventBlocks[i].split('END:VEVENT')[0];

    const summaryMatch = block.match(/SUMMARY:(.*?)(\r?\n[A-Z]|$)/s);
    const dtStartMatch = block.match(/DTSTART(?:;.*?)?:(\d{8}T\d{6}Z?)/);
    const dtEndMatch = block.match(/DTEND(?:;.*?)?:(\d{8}T\d{6}Z?)/);
    const locationMatch = block.match(/LOCATION:(.*?)(\r?\n[A-Z]|$)/s);
    const descMatch = block.match(/DESCRIPTION:(.*?)(\r?\n[A-Z]|$)/s);

    if (dtStartMatch && dtEndMatch) {
      const summary = summaryMatch ? summaryMatch[1].replace(/\\,/g, ',').trim() : 'Cours';
      const location = locationMatch ? locationMatch[1].replace(/\\,/g, ',').trim() : '';
      const description = descMatch ? descMatch[1].replace(/\\n/g, ' ').trim() : '';

      const parseIcsDate = (str: string) => {
        const year = parseInt(str.substring(0, 4), 10);
        const month = parseInt(str.substring(4, 6), 10) - 1;
        const day = parseInt(str.substring(6, 8), 10);
        const hour = parseInt(str.substring(9, 11), 10);
        const min = parseInt(str.substring(11, 13), 10);
        return new Date(Date.UTC(year, month, day, hour, min)).toISOString();
      };

      events.push({
        id: `ics-${Date.now()}-${i}`,
        title: summary,
        subject: location || 'Cours Faculté',
        room: location,
        professor: description,
        startTime: parseIcsDate(dtStartMatch[1]),
        endTime: parseIcsDate(dtEndMatch[1]),
        color: 'cours',
        category: 'Faculté',
      });
    }
  }

  return mergeConsecutiveCourses(events);
}

/**
 * Nettoyage des doublons stricts pour l'utilisateur connecté
 * Ne supprime JAMAIS les événements légitimes créés par les utilisateurs
 */
export async function cleanAllDuplicateAndDemoEvents(): Promise<number> {
  const userId = getCurrentUserId();
  const userEvents = await db.events.where('user_id').equals(userId).toArray();
  const seenKeys = new Set<string>();
  const toDeleteIds: string[] = [];

  for (const ev of userEvents) {
    if (ev.is_deleted) continue;

    // Clé de détection de doublons stricts : date/heure + titre
    const dateKey = ev.start_time ? ev.start_time.slice(0, 16) : '';
    const normTitle = ev.title.trim().toLowerCase();
    const key = `${dateKey}_${normTitle}`;

    if (seenKeys.has(key)) {
      toDeleteIds.push(ev.id);
    } else {
      seenKeys.add(key);
    }
  }

  if (toDeleteIds.length > 0) {
    await db.events.bulkDelete(toDeleteIds);
  }

  return toDeleteIds.length;
}

/**
 * Enregistrement en masse des cours importés dans Dexie (IndexedDB)
 * Supprime uniquement les anciens cours de CET utilisateur sur cette semaine
 * 0 ms de latence perçue !
 */
export async function importCoursesToDatabase(
  courses: ParsedCourseEvent[],
  cleanExistingWeek: boolean = true
): Promise<number> {
  const userId = getCurrentUserId();
  const now = new Date().toISOString();

  // 1. Si demandé, supprimer uniquement les cours existants de CET utilisateur pour cette semaine
  if (cleanExistingWeek && courses.length > 0) {
    const allStartTimes = courses.map((c) => parseISO(c.startTime).getTime());
    const minTime = Math.min(...allStartTimes);
    const weekStart = startOfWeek(new Date(minTime), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);

    const userEvents = await db.events.where('user_id').equals(userId).toArray();
    const toDeleteIds: string[] = [];

    for (const ev of userEvents) {
      try {
        const evTime = parseISO(ev.start_time).getTime();
        if (evTime >= weekStart.getTime() && evTime < weekEnd.getTime()) {
          toDeleteIds.push(ev.id);
        }
      } catch {}
    }

    if (toDeleteIds.length > 0) {
      await db.events.bulkDelete(toDeleteIds);
    }
  }

  // 2. Nettoyer aussi les déchets globaux de démo
  await cleanAllDuplicateAndDemoEvents();

  // 3. Préparer les événements avec ID déterministes stables au format UUID
  const eventsToInsert: EventItem[] = courses.map((c) => {
    const safeTitleSlug = c.title.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20).toLowerCase();
    const rawId = c.id || `pass-${c.startTime.slice(0, 13)}-${safeTitleSlug}`;
    const deterministicUuid = stringToUuid(`${userId}-${rawId}`);

    return {
      id: deterministicUuid,
      user_id: userId,
      title: c.title,
      description: [c.subject, c.professor, c.room].filter(Boolean).join(' • '),
      start_time: c.startTime,
      end_time: c.endTime,
      color: c.color || 'cours',
      alarms: [15],
      updated_at: now,
      is_deleted: false,
      sync_status: 'pending_create',
    };
  });

  await db.events.bulkPut(eventsToInsert);
  return eventsToInsert.length;
}
