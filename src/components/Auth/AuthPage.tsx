import React, { useState } from 'react';
import {
  Activity,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithEmail, signUpWithEmail } from '../../services/supabaseClient';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthPageProps {
  onSuccess: (user: SupabaseUser) => void;
  onContinueAsGuest: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onSuccess,
  onContinueAsGuest,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Veuillez renseigner votre adresse email.');
      return;
    }

    if (!password) {
      setErrorMsg('Veuillez saisir votre mot de passe.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMsg('Le mot de passe doit comporter au moins 6 caractères.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await signInWithEmail(cleanEmail, password);
        if (res.error) {
          setErrorMsg(res.error);
        } else if (res.user) {
          onSuccess(res.user);
        }
      } else {
        const res = await signUpWithEmail(cleanEmail, password, {
          full_name: fullName.trim() || undefined,
        });

        if (res.error) {
          setErrorMsg(res.error);
        } else if (res.user) {
          if (res.needsEmailConfirmation) {
            setInfoMsg(
              'Compte créé avec succès ! Un email de confirmation a été envoyé à votre adresse. Cliquez sur le lien pour valider votre compte.'
            );
          } else {
            onSuccess(res.user);
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden">
      {/* Halos lumineux de fond style Apple */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100/90 overflow-hidden relative z-10 flex flex-col"
      >
        {/* En-tête de la carte */}
        <div className="px-6 pt-7 pb-5 text-center bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
          <div className="inline-flex items-center justify-center w-13 h-13 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 mb-3">
            <Activity className="w-7 h-7 stroke-[2.5]" />
          </div>

          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              MedAgenda
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
              Études Santé
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto font-medium">
            Emploi du temps médical, révisions, stages et to-do list synchronisés
          </p>

          {/* Onglets Connexion / Inscription */}
          <div className="mt-5 grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Créer un compte
            </button>
          </div>
        </div>

        {/* Corps du Formulaire */}
        <div className="p-6 space-y-4">
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {infoMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Champ Nom (si inscription) */}
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Prénom & Nom (Optionnel)
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Alexandre Martin"
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* Champ Email */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Adresse Email Universitaire ou Personnelle
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="etudiant@univ-sante.fr"
                  className="w-full pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Mot de Passe {mode === 'register' && '(min. 6 caractères)'}
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmation Mot de passe (si inscription) */}
            {mode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Confirmer le Mot de Passe
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* Bouton de Soumission Principal */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Traitement en cours...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'Accéder à mon agenda' : 'Créer mon compte étudiant'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Séparateur */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              ou
            </span>
          </div>

          {/* Bouton Continuer sans compte (Mode Local / Démo) */}
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200/70 active:scale-[0.99] text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200/80"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Continuer sans compte (Mode Local)</span>
          </button>
          <p className="text-[10px] text-center text-slate-400">
            0 ms de latence • Vos données restent enregistrées dans votre navigateur
          </p>
        </div>

        {/* Pied de page informatif */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Supabase Cloud Sécurisé
          </span>
          <span className="flex items-center gap-1">
            <GraduationCap className="w-3 h-3 text-indigo-600" />
            Médecine • PASS • LAS
          </span>
        </div>
      </motion.div>
    </div>
  );
};
