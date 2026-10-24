# 🏥 MedAgenda — Application d'Organisation Médicale Local-First & PWA

**MedAgenda** est une Progressive Web App (PWA) V1 de pointe conçue spécifiquement pour les **étudiants en médecine (externes, internes), résidents et praticiens hospitaliers**.
Elle combine un **agenda interactif à précision stricte de 5 minutes** et une **To-Do List hospitalière globale persistante**, conçue pour fonctionner avec **0 ms de latence perçue** même dans les zones blanches des hôpitaux (sous-sols, blocs opératoires, imagerie), avec synchronisation bidirectionnelle automatique dès que le réseau revient.

---

## ⚡ Points Clés de l'Architecture

### 1. Moteur Local-First (Zéro Latence)
* **IndexedDB via Dexie.js** avec le hook réactif `useLiveQuery` : chaque création, déplacement, coloration ou complétion de tâche s'exécute en **moins de 5 ms** en local.
* **SyncManager bidirectionnel** : écoute les événements de connectivité (`online`/`offline`), envoie les modifications en arrière-plan vers Supabase (PostgreSQL) et résout les conflits selon l'algorithme *Last-Write-Wins* via l'horodatage `updated_at`.
* **Support Supabase Realtime** : synchronisation instantanée entre appareils (ex: iPhone en poche et iPad en salle de garde).

### 2. Ergonomie Médicale & Tactile
* **Granularité Horaire Stricte de 5 Minutes** : Sélecteur sur-mesure ultra-rapide (`00`, `:05`, `:10`, ..., `:55`), pas d'input natif lent. Raccourcis de durée médicale (`+15m`, `+30m`, `+1h`, `Garde 24h`).
* **Tap & Quick Add (< 3 secondes)** : Tap direct sur la grille horaire avec magnétisme automatique aux 5 minutes, modèles pré-remplis en 1 tap (*Garde 24h*, *Bloc opératoire*, *Staff*, *Consultation*, *Révisions EDN*).
* **Gestes de Swipe Tactiles** : Navigation fluide au doigt ou Apple Pencil entre les semaines et les mois propulsée par `@use-gesture/react` et `framer-motion`.
* **To-Do List Persistante & Indépendante** : Tâches non rattachées à un jour particulier, qui restent jour après jour jusqu'à validation manuelle, avec accordéon des tâches archivées.
* **Système d'Alarmes Hybride** :
  * Double tonalité harmonique médicale via **Web Audio API** (synthèse 100% hors-ligne).
  * Notifications système iOS / iPadOS PWA via **Web Notifications API**.
  * Bannière d'alerte prioritaire in-app avec snooze (+5 min, +10 min) et acquittement.

### 3. Responsive iPad (Split-View) vs iPhone
* **iPad & Desktop (`md:` et `lg:`)** : Affichage scindé 70% Agenda / 30% To-Do List permanente.
* **iPhone (`< md:`)** : Vue calendrier plein écran avec bouton flottant accessible au pouce et tiroir coulissant (Bottom Sheet).
* Prise en compte intégrale des `safe-area-inset` d'Apple (Dynamic Island, encoches et barre d'accueil).

---

## 🚀 Démarrage Rapide

### Installation et Lancement Local
```bash
# 1. Cloner ou ouvrir le projet
cd MatApp

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement Vite
npm run dev

# 4. Compiler pour la production & PWA
npm run build
npm run preview
```

L'application s'ouvre par défaut sur `http://localhost:5173` (ou `http://localhost:4173` en preview).

---

## 🗄️ Configuration Supabase (Cloud & Multi-Appareils)

L'application fonctionne immédiatement en mode hors-ligne sans configuration requise (données d'exemple médicales préchargées).

Pour activer la synchronisation multi-appareils (iPhone / iPad / Mac) :
1. Créez un projet gratuit sur [Supabase](https://supabase.com).
2. Rendez-vous dans l'onglet **SQL Editor** de Supabase et exécutez le script contenu dans `supabase_schema.sql`.
3. Dans l'application MedAgenda, cliquez sur l'icône **⚙️ Paramètres** en haut à droite.
4. Renseignez l'URL de votre projet Supabase et votre clé anonyme (`anon public key`).
5. Vos données se synchroniseront instantanément en arrière-plan !

---

## 📱 Installation sur iPhone / iPad (PWA)
1. Ouvrez l'application dans Safari sur iOS / iPadOS.
2. Appuyez sur le bouton **Partager** (icône rectangle avec flèche vers le haut).
3. Sélectionnez **« Sur l'écran d'accueil »** (`Add to Home Screen`).
4. L'application s'exécute désormais en plein écran sans les barres de navigateur, exactement comme une application native iOS !
