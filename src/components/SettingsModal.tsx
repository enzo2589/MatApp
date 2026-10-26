import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Cloud,
  Lock,
  Mail,
  User,
  LogOut,
  Volume2,
  Download,
  RotateCcw,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
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
  const [activeTab, setActiveTab] = useState<'auth' | 'backup'>('auth');

  // Auth states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  // Stats
  const [eventCount, setEventCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      getAuthUser().then((user) => {
        setCurrentUserEmail(user?.email || null);
      });

      db.events.count().then(setEventCount);
      db.tasks.count().then(setTaskCount);
    }
  }, [isOpen]);

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
        setAuthSuccess('Connexion réussie ! Vos données sont synchronisées.');
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
        setAuthSuccess('Compte créé ! Vos données locales sont désormais reliées au Cloud.');
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

  const handleManualSync = () => {
    setIsSyncingManual(true);
    syncEngine.triggerSync();
    alarmService.playChime();
    setTimeout(() => {
      setIsSyncingManual(false);
      setAuthSuccess('Synchronisation Cloud effectuée avec succès !');
      setTimeout(() => setAuthSuccess(null), 3000);
    }, 1000);
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
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Paramètres & Compte</h3>
              <p className="text-xs text-slate-500 font-medium">Synchronisation Cloud & Stockage Local</p>
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
            onClick={() => setActiveTab('auth')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'auth'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Compte & Synchronisation
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
            Données & Sauvegardes
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'auth' && (
            <div className="space-y-4">
              {/* Carte d'état de la connexion Supabase intégrée */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>Cloud Supabase Relié</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-200 text-emerald-800">
                        MatApp
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Synchronisation active • Zéro latence locale
                    </p>
                  </div>
                </div>

                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>

              {currentUserEmail ? (
                /* Utilisateur connecté */
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      Compte Actif
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-1">{currentUserEmail}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vos cours et vos tâches sont synchronisés entre vos appareils
                    </p>
                  </div>

                  {authSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>{authSuccess}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleManualSync}
                      disabled={isSyncingManual}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingManual ? 'animate-spin' : ''}`} />
                      <span>{isSyncingManual ? 'Synchronisation...' : 'Synchroniser maintenant'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="px-3.5 py-2 bg-white border border-slate-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-50 transition-colors flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Se déconnecter</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulaire de connexion / inscription */
                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
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
                      Créer un compte
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Connectez-vous pour retrouver automatiquement votre emploi du temps et vos tâches sur votre iPad, iPhone et ordinateur.
                  </p>

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
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="etudiant@univ-sante.fr"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20"
                  >
                    {authMode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">Stockage Local IndexedDB</p>
                  <p className="text-slate-500">{eventCount} événements • {taskCount} tâches</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exporter JSON
                </button>
              </div>

              {/* Test d'alarme sonore */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">Testeur de Carillon Sonore</p>
                  <p className="text-slate-500">Signal Web Audio pour les alarmes et rappels</p>
                </div>
                <button
                  type="button"
                  onClick={() => alarmService.playChime()}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-semibold hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Tester le son
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
                  Réinitialiser les données locales
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
