import { ParsedCourseEvent } from './types';

/**
 * Emploi du temps PASS Semaine 43 (Lundi 19 au Vendredi 23 Octobre 2026 - Faculté de Médecine de Lille)
 * Document de référence officiel
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
    endTime: '2026-10-19T12:00:00',
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
    endTime: '2026-10-20T10:00:00',
    color: 'tutorat',
    category: 'Faculté',
  },
  {
    id: 'pass-s43-mar-10-12',
    title: 'Biologie cellulaire : Tissu nerveux (Parties 2 & 3)',
    subject: 'BCC1 - Biologie cellulaire et histologie',
    professor: 'Vincent Deramecourt',
    startTime: '2026-10-20T10:00:00',
    endTime: '2026-10-20T12:00:00',
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
    endTime: '2026-10-21T10:00:00',
    color: 'cours',
    category: 'Faculté',
  },
  {
    id: 'pass-s43-mer-10-12',
    title: 'Biophysique : Rayonnements & Imagerie (Parties 1 & 2)',
    subject: 'BCC1 - Biophysique',
    professor: 'Philippe Derambure',
    startTime: '2026-10-21T10:00:00',
    endTime: '2026-10-21T12:00:00',
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
    endTime: '2026-10-22T10:00:00',
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
    endTime: '2026-10-23T11:30:00',
    color: 'bu',
    category: 'Ouverture',
  },
];
