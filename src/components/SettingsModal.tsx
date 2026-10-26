import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Cloud,
  Lock,
  Mail,
  User,
  LogOut,
  Bell,
  Volume2,
  Download,
  Upload,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  getAuthUser
} from '../services/supabaseClient';
import { syncEngine } from '../services/syncEngine';
import { alarmService } from '../services/alarmService';
import { db, seedInitialMedicalDataIfEmpty, LOCAL_USER_ID } from '../db/localDb';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [activeTab, setActiveTab] = useState<'cloud' | 'auth' | 'backup'>('cloud');

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Stats
  const [eventCount, setEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url || 'https://yxrjexsqscacqekpgstj.supabase.co');
      setAnonKey(config.anonKey || 'sb_publishable_K_o24ab29tAAugZC8DsK-A_QflfUq8T');

      getAuthUser().then((user) => {
        setCurrentUserEmail(user?.email || null);
      });

      db.events.count().then(setEventCount);
      db.tasks.count().then(setTaskCount);
    }
  }, [isOpen]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(url, anonKey);
    syncEngine.setupRealtimeSubscription();
    syncEngine.triggerSync();
    alert('Configuration Supabase enregistrée !');
  };

  const handleClearConfig = () => {
    if (window.confirm('Réinitialiser la configuration Supabase ? L’application continuera en mode local.')) {
      clearSupabaseConfig();
      setUrl('');
      setAnonKey('');
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!email || !password) {
      setAuthError('Veuillez renseigner un email et un mot de passe.');
      return;
    }

    if (authMode === 'login') {
      const res = await signInWithEmail(email, password);
      if (res.error) {
        setAuthError(res.error);
      } else {
        setAuthSuccess('Connexion réussie !');
        setCurrentUserEmail(res.user?.email || email);
        if (res.user?.id) {
          const newUserId = res.user.id;
          localStorage.setItem('medagenda_current_user', JSON.stringify({ id: newUserId, email: res.user.email }));

          // Migrer tous les événements et tâches locaux vers ce compte Supabase
          await db.events.where('user_id').equals(LOCAL_USER_ID).modify({
            user_id: newUserId,
            sync_status: 'pending_create',
          });
          await db.tasks.where('user_id').equals(LOCAL_USER_ID).modify({
            user_id: newUserId,
            sync_status: 'pending_create',
          });

          syncEngine.setupRealtimeSubscription();
          syncEngine.triggerSync();
        }
      }
    } else {
      const res = await signUpWithEmail(email, password);
      if (res.error) {
        setAuthError(res.error);
      } else {
        setAuthSuccess('Compte créé ! Vérifiez vos emails si la confirmation est requise.');
        if (res.user?.id) {
          const newUserId = res.user.id;
          localStorage.setItem('medagenda_current_user', JSON.stringify({ id: newUserId, email: res.user.email }));

          await db.events.where('user_id').equals(LOCAL_USER_ID).modify({
            user_id: newUserId,
            sync_status: 'pending_create',
          });
          await db.tasks.where('user_id').equals(LOCAL_USER_ID).modify({
            user_id: newUserId,
            sync_status: 'pending_create',
          });

          syncEngine.setupRealtimeSubscription();
          syncEngine.triggerSync();
        }
      }
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUserEmail(null);
    setAuthSuccess('Déconnecté avec succès.');
  };

  const handleExportBackup = async () => {
    const events = await db.events.toArray();
    const tasks = await db.tasks.toArray();

    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      events,
      tasks,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `medagenda-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleResetData = async () => {
    if (window.confirm('Réinitialiser toutes les données locales et recharger les exemples médicaux ?')) {
      await db.events.clear();
      await db.tasks.clear();
      await seedInitialMedicalDataIfEmpty();
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Paramètres & Synchronisation</h3>
              <p className="text-xs text-slate-500">Moteur Local-First & Cloud Supabase</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-5 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'cloud'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Supabase Cloud
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'auth'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Compte & Auth
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'backup'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Données & Alarmes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'cloud' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
                <strong>Mode Local-First Zéro Latence :</strong> L'application fonctionne à 100% sans connexion internet. Connectez votre projet Supabase pour synchroniser automatiquement vos données entre iPhone, iPad et Mac.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  URL du Projet Supabase
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yxrjexsqscacqekpgstj.supabase.co"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Clé Anonyme (Anon Public Key)
                </label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleClearConfig}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
                >
                  Effacer la config
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  Enregistrer & Synchroniser
                </button>
              </div>
            </form>
          )}

          {activeTab === 'auth' && (
            <div className="space-y-4">
              {currentUserEmail ? (
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Connecté avec succès</h4>
                    <p className="text-xs text-slate-600">{currentUserEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-white border border-slate-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 transition-colors inline-flex items-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    Se déconnecter
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        authMode === 'login' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Connexion
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        authMode === 'register' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Inscription
                    </button>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {authSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{authSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email professionnel ou universitaire
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="interne@chu-hopital.fr"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  >
                    {authMode === 'login' ? 'Se connecter' : 'Créer un compte'}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-800">Stockage Local IndexedDB</p>
                  <p className="text-slate-500">{eventCount} événements • {taskCount} tâches</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter JSON
                </button>
              </div>

              {/* Test d'alarme sonore */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-800">Testeur de Carillon Sonore</p>
                  <p className="text-slate-500">Signal Web Audio pour les alarmes de garde</p>
                </div>
                <button
                  type="button"
                  onClick={() => alarmService.playChime()}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-semibold hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Tester son
                </button>
              </div>

              {/* Réinitialiser les données */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetData}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Réinitialiser avec les données d’exemple
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
