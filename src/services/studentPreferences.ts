import { FavoriteItem, DayHighlight } from '../types';

const STORAGE_FAVORITES_KEY = 'medagenda_student_favorites';
const STORAGE_DAY_HIGHLIGHTS_KEY = 'medagenda_day_highlights';

export const DAY_HIGHLIGHT_PRESETS: { id: string; label: string; color: string; bgPastel: string; emoji: string }[] = [
  { id: 'exam', label: 'Examen / Partiels', color: '#EF4444', bgPastel: '#FEE2E2', emoji: '🔴' },
  { id: 'repos', label: 'Repos / Vacances', color: '#10B981', bgPastel: '#D1FAE5', emoji: '🟢' },
  { id: 'cours', label: 'Cours / Rentrée', color: '#4F46E5', bgPastel: '#E0E7FF', emoji: '🔵' },
  { id: 'stage', label: 'Stage / Bloc', color: '#F59E0B', bgPastel: '#FEF3C7', emoji: '🟡' },
  { id: 'garde', label: 'Garde / Astreinte', color: '#8B5CF6', bgPastel: '#EDE9FE', emoji: '🟣' },
];

export const INITIAL_FAVORITES: FavoriteItem[] = [
  {
    id: 'fav-cours-amphi',
    title: 'Cours Amphi Faculté',
    color: 'cours',
    emoji: '📚',
    durationMinutes: 120,
    category: 'Faculté',
    alarms: [15],
    description: 'Prise de notes & items du collège',
  },
  {
    id: 'fav-anki',
    title: 'Session Anki & Flashcards',
    color: 'revisions',
    emoji: '🧠',
    durationMinutes: 60,
    category: 'Apprentissage',
    alarms: [10],
    description: 'Mémorisation espacée quotidienne',
  },
  {
    id: 'fav-bu-focus',
    title: 'BU Santé Focus',
    color: 'bu',
    emoji: '📖',
    durationMinutes: 180,
    category: 'Travail',
    alarms: [15],
    description: 'Fiches de synthèse & dossiers progressifs',
  },
  {
    id: 'fav-stage',
    title: 'Stage Hospitalier (Matin)',
    color: 'stage',
    emoji: '🏥',
    durationMinutes: 240,
    category: 'Clinique',
    alarms: [30],
    description: 'Visite dans le service, observations et gestes',
  },
  {
    id: 'fav-ed',
    title: 'ED & Tutorat Médecine',
    color: 'tutorat',
    emoji: '👥',
    durationMinutes: 120,
    category: 'Enseignement',
    alarms: [15],
    description: 'Cas cliniques, anatomie et sémiologie',
  },
  {
    id: 'fav-sport',
    title: 'Sport & Décompression',
    color: 'sport',
    emoji: '🏃',
    durationMinutes: 90,
    category: 'Santé',
    alarms: [],
    description: 'Running ou salle pour aérer l’esprit',
  },
  {
    id: 'fav-pause',
    title: 'Pause Déjeuner & Café',
    color: 'pause',
    emoji: '☕',
    durationMinutes: 60,
    category: 'Pause',
    alarms: [],
    description: 'Déjeuner carabin avec la promo',
  },
  {
    id: 'fav-concours-blanc',
    title: 'Concours Blanc / Partiels',
    color: 'examen',
    emoji: '📝',
    durationMinutes: 180,
    category: 'Évaluation',
    alarms: [60, 15],
    description: 'Épreuve d’entraînement en conditions réelles',
  },
  {
    id: 'fav-garde',
    title: 'Garde Urgences Externe',
    color: 'garde',
    emoji: '🚨',
    durationMinutes: 720,
    category: 'Garde',
    alarms: [60, 15],
    description: 'Accueil déchoc et régulation',
  },
  {
    id: 'fav-repos',
    title: 'Repos & Sieste Réparatrice',
    color: 'repos',
    emoji: '🛌',
    durationMinutes: 60,
    category: 'Sommeil',
    alarms: [],
    description: 'Recharger les batteries',
  },
];

// Listeners pour notifier les composants en temps réel
type PreferencesListener = () => void;
const listeners = new Set<PreferencesListener>();

function notifyChange() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {}
  });
}

export function subscribePreferences(listener: PreferencesListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ==============================================================================
   GESTION DES FAVORIS RÉUTILISABLES
   ============================================================================== */
export function getStudentFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Erreur lecture favoris:', e);
  }
  return INITIAL_FAVORITES;
}

export function saveStudentFavorite(fav: Omit<FavoriteItem, 'id'> & { id?: string }): FavoriteItem {
  const current = getStudentFavorites();
  const id = fav.id || `fav-${Date.now()}`;
  const fullFav: FavoriteItem = { ...fav, id };

  const existingIndex = current.findIndex((f) => f.id === id);
  let updated: FavoriteItem[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = fullFav;
  } else {
    updated = [fullFav, ...current];
  }

  localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(updated));
  notifyChange();
  return fullFav;
}

export function deleteStudentFavorite(id: string): void {
  const current = getStudentFavorites();
  const updated = current.filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(updated));
  notifyChange();
}

/* ==============================================================================
   GESTION DE LA COLORATION DES JOURS DU MOIS (EXAMENS, REPOS, STAGES...)
   ============================================================================== */
export function getDayHighlights(): Record<string, DayHighlight> {
  try {
    const raw = localStorage.getItem(STORAGE_DAY_HIGHLIGHTS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Erreur lecture day highlights:', e);
  }
  return {};
}

export function setDayHighlight(dateStr: string, highlight: { color: string; label: string } | null): void {
  const current = getDayHighlights();
  if (!highlight || highlight.color === 'transparent') {
    delete current[dateStr];
  } else {
    current[dateStr] = {
      date: dateStr,
      color: highlight.color,
      label: highlight.label,
    };
  }

  localStorage.setItem(STORAGE_DAY_HIGHLIGHTS_KEY, JSON.stringify(current));
  notifyChange();
}
