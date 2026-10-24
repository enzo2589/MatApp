import { ColorTheme } from '../types';

export const MEDICAL_COLORS: ColorTheme[] = [
  {
    id: 'cours',
    name: 'Cours & Amphi',
    category: 'Faculté',
    emoji: '📚',
    hex: '#4F46E5',
    bgPastel: '#EEF2FF',
    borderAccent: '#4338CA',
    textColor: '#312E81',
    badgeBg: '#C7D2FE',
  },
  {
    id: 'revisions',
    name: 'Révisions & Anki',
    category: 'Apprentissage',
    emoji: '🧠',
    hex: '#10B981',
    bgPastel: '#ECFDF5',
    borderAccent: '#059669',
    textColor: '#065F46',
    badgeBg: '#A7F3D0',
  },
  {
    id: 'bu',
    name: 'BU & Travail Perso',
    category: 'Focus',
    emoji: '📖',
    hex: '#F59E0B',
    bgPastel: '#FFFBEB',
    borderAccent: '#D97706',
    textColor: '#92400E',
    badgeBg: '#FDE68A',
  },
  {
    id: 'stage',
    name: 'Stage Hospitalier',
    category: 'Hôpital',
    emoji: '🏥',
    hex: '#06B6D4',
    bgPastel: '#ECFEFF',
    borderAccent: '#0891B2',
    textColor: '#155E75',
    badgeBg: '#A5F3FC',
  },
  {
    id: 'garde',
    name: 'Garde Externe / Urgences',
    category: 'Garde',
    emoji: '🚨',
    hex: '#EF4444',
    bgPastel: '#FEF2F2',
    borderAccent: '#DC2626',
    textColor: '#991B1B',
    badgeBg: '#FECACA',
  },
  {
    id: 'repos',
    name: 'Repos & Sommeil',
    category: 'Bien-être',
    emoji: '🛌',
    hex: '#8B5CF6',
    bgPastel: '#F5F3FF',
    borderAccent: '#7C3AED',
    textColor: '#5B21B6',
    badgeBg: '#DDD6FE',
  },
  {
    id: 'sport',
    name: 'Sport & Décompression',
    category: 'Santé',
    emoji: '🏃',
    hex: '#84CC16',
    bgPastel: '#F7FEE7',
    borderAccent: '#65A30D',
    textColor: '#3F6212',
    badgeBg: '#D9F99D',
  },
  {
    id: 'pause',
    name: 'Pause & Soirée Carabin',
    category: 'Social',
    emoji: '☕',
    hex: '#F43F5E',
    bgPastel: '#FFF1F2',
    borderAccent: '#E11D48',
    textColor: '#9F1239',
    badgeBg: '#FECDD3',
  },
  {
    id: 'examen',
    name: 'Partiels & Concours Blanc',
    category: 'Évaluation',
    emoji: '📝',
    hex: '#D946EF',
    bgPastel: '#FDF4FF',
    borderAccent: '#C026D3',
    textColor: '#86198F',
    badgeBg: '#F5D0FE',
  },
  {
    id: 'ecni',
    name: 'Items EDN / Dossiers',
    category: 'Concours',
    emoji: '🎯',
    hex: '#0D9488',
    bgPastel: '#CCFBF1',
    borderAccent: '#0F766E',
    textColor: '#115E59',
    badgeBg: '#99F6E4',
  },
  {
    id: 'tutorat',
    name: 'Tutorat & ED',
    category: 'Faculté',
    emoji: '👥',
    hex: '#0284C7',
    bgPastel: '#F0F9FF',
    borderAccent: '#0369A1',
    textColor: '#075985',
    badgeBg: '#BAE6FD',
  },
  {
    id: 'perso',
    name: 'Perso & Administratif',
    category: 'Vie',
    emoji: '⭐',
    hex: '#64748B',
    bgPastel: '#F8FAFC',
    borderAccent: '#475569',
    textColor: '#1E293B',
    badgeBg: '#E2E8F0',
  },
];

export const DEFAULT_COLOR = MEDICAL_COLORS[0];

export function getColorTheme(colorKeyOrHex?: string): ColorTheme {
  if (!colorKeyOrHex) return DEFAULT_COLOR;

  // Match by id
  const byId = MEDICAL_COLORS.find(c => c.id.toLowerCase() === colorKeyOrHex.toLowerCase());
  if (byId) return byId;

  // Legacy mappings for initial demo data
  if (colorKeyOrHex === 'staff') return MEDICAL_COLORS.find(c => c.id === 'tutorat') || DEFAULT_COLOR;
  if (colorKeyOrHex === 'consultation') return MEDICAL_COLORS.find(c => c.id === 'stage') || DEFAULT_COLOR;
  if (colorKeyOrHex === 'recherche') return MEDICAL_COLORS.find(c => c.id === 'bu') || DEFAULT_COLOR;
  if (colorKeyOrHex === 'astreinte') return MEDICAL_COLORS.find(c => c.id === 'garde') || DEFAULT_COLOR;

  // Match by hex
  const byHex = MEDICAL_COLORS.find(c => c.hex.toLowerCase() === colorKeyOrHex.toLowerCase());
  if (byHex) return byHex;

  // Fallback styling
  return {
    id: 'custom',
    name: 'Personnalisé',
    category: 'Autre',
    emoji: '📌',
    hex: colorKeyOrHex,
    bgPastel: '#F1F5F9',
    borderAccent: colorKeyOrHex,
    textColor: '#1E293B',
    badgeBg: '#E2E8F0',
  };
}
