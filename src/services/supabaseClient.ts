import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// Configuration keys in localStorage
export const STORAGE_SUPABASE_URL = 'medagenda_supabase_url';
export const STORAGE_SUPABASE_KEY = 'medagenda_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  const customUrl = localStorage.getItem(STORAGE_SUPABASE_URL) || '';
  const customKey = localStorage.getItem(STORAGE_SUPABASE_KEY) || '';

  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://yxrjexsqscacqekpgstj.supabase.co';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_K_o24ab29tAAugZC8DsK-A_QflfUq8T';

  const url = customUrl || envUrl;
  const anonKey = customKey || envKey;

  const isConfigured = Boolean(url && anonKey && url.startsWith('http') && anonKey.length > 20);

  return { url, anonKey, isConfigured };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(STORAGE_SUPABASE_URL, url.trim());
  localStorage.setItem(STORAGE_SUPABASE_KEY, anonKey.trim());
  cachedClient = null;
  cachedConfigKey = '';
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_SUPABASE_URL);
  localStorage.removeItem(STORAGE_SUPABASE_KEY);
  cachedClient = null;
  cachedConfigKey = '';
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured) {
    return null;
  }

  const currentConfigKey = `${url}:::${anonKey}`;
  if (cachedClient && cachedConfigKey === currentConfigKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    cachedConfigKey = currentConfigKey;
    return cachedClient;
  } catch (error) {
    console.error('Erreur initialisation Supabase Client:', error);
    return null;
  }
}

/**
 * Récupère l'utilisateur actuellement connecté
 */
export async function getAuthUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) return null;
    return session.user;
  } catch (e) {
    console.warn('Impossible de récupérer l’utilisateur Supabase:', e);
    return null;
  }
}

/**
 * Inscription par email et mot de passe
 */
export async function signUpWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { user: null, error: "Supabase n'est pas encore configuré." };
  }

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
    });
    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message || 'Erreur inconnue lors de l’inscription' };
  }
}

/**
 * Connexion par email et mot de passe
 */
export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { user: null, session: null, error: "Supabase n'est pas encore configuré." };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { user: null, session: null, error: error.message };
    return { user: data.user, session: data.session, error: null };
  } catch (err: any) {
    return { user: null, session: null, error: err.message || 'Erreur inconnue lors de la connexion' };
  }
}

/**
 * Déconnexion
 */
export async function signOutUser(): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch (e) {
      console.warn('Erreur lors du signOut Supabase', e);
    }
  }
  localStorage.removeItem('medagenda_current_user');
}
