# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte du projet

ODIGO est une application d'apprentissage conçue pour **Neyla**, 10 ans, élève en 7P à Genève. Objectif principal : l'aider dans ses études. Objectif secondaire : commercialisation si succès.

**Intérêts de Neyla** (à utiliser pour personnaliser le contenu des exercices) : films Miyazaki, couture, Bigflo & Oli, son frère Nono, Nintendo Switch, mythologie grecque, Japon, Grèce, Algérie, sa Mamie.

---

## 1. Projet

**Nom** : ODIGO — application web d'apprentissage gamifiée, en français, pour élève de primaire (7P), avec un mode parent.

**Objectif** :
- Aider Neyla à organiser son travail scolaire (planificateur d'évaluations, révisions, événements, rappels)
- Réviser via des mini-jeux (vocabulaire, conjugaison, orthographe...)
- Motiver via un système de récompenses ("Digoos" / Δ) et un compagnon IA bienveillant ("Odigo")
- Permettre aux parents de suivre la progression et de créer des récompenses réelles (IRL)

**Stack technique** :
- **React 19.2.6** + **TypeScript ~6.0.2** (strict mode, `noUnusedLocals`, `noUnusedParameters`)
- **Vite 8** (build/dev server), `@vitejs/plugin-react`
- **Supabase** (`@supabase/supabase-js` ^2.106.2) — auth + base Postgres
- **Anthropic API** (Claude Sonnet 4.5) — appelée directement depuis le navigateur via `fetch` (clé `VITE_ANTHROPIC_API_KEY`)
- **@tiptap/** (`react`, `starter-kit`, `extension-color`, `extension-highlight`, `extension-text-align`, `extension-text-style`) ^3.26.0 — éditeur de texte riche (notes de matières)
- **jspdf** ^4.2.1 — export PDF (Histoire.tsx)
- **lucide-react** ^1.17.0 — icônes (navigation, sidebar)
- **ESLint 10** (`eslint-plugin-react-hooks` ^7.1.1, `eslint-plugin-react-refresh`, `typescript-eslint` ^8.60.0)
- Pas de framework de tests configuré. Pour en ajouter : `vitest` (Vite-native, ESM-compatible)

**Commands** :
```bash
npm run dev       # Démarre le serveur Vite avec HMR
npm run build     # Type-check (tsc -b) puis build vers dist/
npm run lint      # Vérification ESLint
npm run preview   # Prévisualise le build de production en local
```

**URLs** :
- **GitHub** : https://github.com/yvanmeth/odigo2
- **Netlify** : déploiement automatique connecté au dépôt GitHub (déclenché par `git push` sur `main`)
- **Supabase** : projet configuré via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` dans `.env.local` (non commité, voir section 7)

---

## 2. Structure des dossiers

```
src/
├── main.tsx              # Point d'entrée Vite/React
├── App.tsx               # Auth Supabase → LoginPage ou Dashboard, enveloppé dans ToastProvider
├── index.css             # CSS global : animations, .cartes-grid, .card-flip, focus inputs, etc.
├── App.css
│
├── lib/                  # Fonctions utilitaires pures, sans état React
│   ├── supabase.ts       # Client Supabase (createClient avec les variables d'env)
│   ├── faq.ts            # FAQ statique + findFAQ()
│   ├── greeting.ts        # generateGreeting() — message d'accueil contextuel (home.tsx)
│   ├── speech.ts          # detectLang() / speak() — synthèse vocale
│   └── dates.ts           # parseLocalDate() / formatDateDMY() / isToday()
│
├── services/             # Logique métier qui touche Supabase
│   ├── digoos.ts          # addDigoos / deductDigoos / addPlannerDigoos
│   ├── activity.ts        # logActivity() → table daily_activity
│   └── suggestions.ts     # submitSuggestion() → table suggestions (à migrer)
│
├── type/
│   └── index.ts           # Interfaces partagées : Profile, Subject, Evaluation, Revision,
│                           # Event, WordList, WordItem, Progress
│
├── components/          # Composants partagés réutilisables
│   ├── Companion.tsx      # Chatbot flottant "Odigo" (Claude + FAQ + suggestions)
│   ├── Toast.tsx           # ToastProvider / useToast / showToast
│   ├── Delta.tsx            # <Delta /> — icône de la monnaie Δ
│   ├── OdigoAvatar.tsx      # <OdigoAvatar /> — avatar directionnel (up/down/left/right)
│   ├── DigoosAnimation.tsx  # Animation "+N Δ" + son, déclenchée via window global
│   └── EmptyState.tsx       # Bloc générique "aucune donnée" avec action optionnelle
│
└── pages/
    ├── loginpage.tsx       # Connexion / inscription multi-étapes (élève ou parent)
    ├── home.tsx            # Tableau de bord (évaluations à venir/passées, accueil contextuel)
    ├── wordlists.tsx       # Gestion des listes de vocabulaire (assistée par Claude)
    ├── settings.tsx        # Paramètres : profil, thème, liaison parent/enfant, rôle
    ├── parent.tsx          # Espace parent : enfants liés, codes d'invitation, récompenses IRL
    ├── Cartes.tsx           # Cartes à collectionner (Digooland)
    ├── Histoire.tsx         # Histoire interactive (Digooland), export PDF via jspdf
    ├── Allumettes.tsx       # Jeu des allumettes (Digooland)
    │
    ├── worddrop.tsx         # Mini-jeu vocabulaire
    ├── qcm.tsx               # Mini-jeu QCM
    ├── spelling.tsx          # Mini-jeu épellation
    ├── flashcards.tsx        # Mini-jeu flashcards
    ├── conjugaison.tsx       # Mini-jeu conjugaison (génération via Claude)
    ├── vocabulaire.tsx       # Mini-jeu vocabulaire (définitions via Claude)
    │
    ├── dashboard.tsx         # Shim : export { default } from './dashboard/index'
    ├── planner.tsx           # Shim : export { default } from './planner/index'
    ├── rewards.tsx           # Shim : export { default } from './rewards/index'
    │
    ├── dashboard/
    │   ├── index.tsx         # Shell principal : sidebar, navigation interne, Companion, DigoosAnimation
    │   ├── types.tsx          # navItems, exerciseCards, type Child
    │   ├── Sidebar.tsx         # Sidebar (nav, sélecteur d'enfant, solde Δ, déconnexion)
    │   ├── ChildSelector.tsx   # Sélecteur d'enfant pour les parents
    │   ├── ExerciseCards.tsx   # Grille des cartes d'exercices
    │   └── OnboardingModal.tsx # Modale de première connexion
    │
    ├── planner/
    │   ├── index.tsx          # Page planificateur (fetch évaluations/révisions/events/reminders)
    │   ├── types.ts            # Tab, PlannerView, CalendarView, Reminder, CalendarItem, etc.
    │   ├── helpers.ts          # formatDate()
    │   ├── PlannerList.tsx     # Vue liste (CRUD complet)
    │   ├── PlannerCalendar.tsx # Conteneur des vues calendrier
    │   ├── PlannerDay.tsx
    │   ├── PlannerWeek.tsx
    │   ├── PlannerMonth.tsx
    │   └── CalendarItem.tsx    # Rendu d'un item dans le calendrier
    │
    ├── rewards/
    │   ├── index.tsx           # Page Récompenses : 4 onglets (rewards/wallet/progression/howto)
    │   ├── types.ts             # RewardTab, Progress, IrlReward, IrlPurchase, ShopItem, UserPurchase, Badge
    │   ├── helpers.ts            # getCurrentWeekKey, ALL_BADGES, getWeekRange, isAfterSundayReset...
    │   ├── ProgressCircle.tsx    # Cercle de progression SVG
    │   ├── RewardsBoutique.tsx   # Onglet Boutique (récompenses IRL + Digooland : thèmes, titres, jeux)
    │   ├── RewardsPortfolio.tsx  # Onglet Portefeuille (récompenses IRL possédées)
    │   ├── RewardsProgress.tsx   # Onglet Progrès (badges, jours/semaines/mois actifs à réclamer)
    │   └── RewardsHowItWorks.tsx # Onglet "Comment ça marche"
    │
    └── subjects/
        ├── index.tsx           # Page Matières : grille ou détail (4 onglets)
        ├── types.ts             # SubjectItem, Note, Postit, WordListItem, COLOR_PALETTE, FIXED_SUBJECTS...
        ├── SubjectGrid.tsx      # Grille des matières (custom + fixes)
        ├── SubjectEvals.tsx     # Onglet Évaluations/Révisions de la matière
        ├── SubjectNotes.tsx     # Onglet Notes de cours (éditeur Tiptap)
        ├── SubjectPostits.tsx   # Onglet Post-its
        └── SubjectWordlists.tsx # Onglet Listes de mots de la matière
```

> ⚠️ Note sur les doublons : `src/pages/dashboard.tsx`, `planner.tsx` et `rewards.tsx` sont de simples shims de réexport (`export { default } from './xxx/index'`) qui coexistent avec les dossiers `dashboard/`, `planner/`, `rewards/`. La page Matières n'a pas de shim équivalent — `dashboard/index.tsx` importe directement `'../subjects/index'`.

---

## 3. Conventions de code

- **Styles inline uniquement** — pas de Tailwind, pas de CSS modules, pas de styled-components. Le seul CSS externe est `src/index.css` (animations, classes utilitaires comme `.cartes-grid`, `.card-flip`, `.card-hover`, `.story-choice`, focus des inputs).
- **Palette de couleurs** :
  - Principal : `#2a9d8f` (teal) — souvent via la constante `PRIMARY = 'var(--color-primary)'` (voir thèmes ci-dessous)
  - Secondaire : `#e9c46a` (or)
  - Erreur : `#e63946` (rouge)
  - Accent : `#e76f51` (orange)
  - Fond : `#f0faf8`
  - Fond clair / montants Δ sur fond clair : `#fff8e0` avec texte `#b8860b`
  - Montants Δ sur fond coloré (vert, rouge...) : texte `#ffffff`
  - Vert vocabulaire : `#4CAF50`
- **Thème personnalisable** : `PRIMARY` n'est plus une constante figée mais `'var(--color-primary)'`. La couleur est définie au montage de `dashboard/index.tsx` via `document.documentElement.style.setProperty('--color-primary', localStorage.getItem('odigo_theme_color') || '#2a9d8f')`. Les thèmes sont des `shop_items` de type `'theme'` achetables dans `RewardsBoutique.tsx`, qui appelle `localStorage.setItem('odigo_theme_color', color)`.
- **Pas de state management centralisé** — uniquement `useState`/`useEffect`. Pas de Redux, Zustand, Context API (à l'exception de `ToastContext` pour les toasts).
- **French UI** — tout le texte visible, les commentaires et les messages d'erreur sont en français.
- **GameState pattern** — chaque mini-jeu d'exercice utilise un type `GameState` local en union de chaînes, typiquement `'select' | 'loading' | 'playing' | 'result'` (variantes : `worddrop`/`qcm`/`spelling` n'ont pas `'loading'` ; `conjugaison`/`vocabulaire` l'ont ; `Allumettes` utilise `'select' | 'drawing' | 'playing' | 'result'` ; `Histoire` utilise `'select' | 'playing' | 'ending' | 'end' | 'question' | 'question_done'`).
- **Composants réutilisables disponibles** (`src/components/`) :
  - `<Delta size={18} style={...} />` — icône Δ (`/delta.svg`)
  - `<OdigoAvatar direction="up|down|left|right" size={32} style={...} />` — avatar Odigo directionnel
  - `<EmptyState emoji title subtitle? actionLabel? onAction? />` — état vide générique
  - `ToastProvider` / `useToast()` — notifications
  - `DigoosAnimation` — animation flottante de gain de Δ
  - `Companion` — chatbot Odigo (monté une seule fois dans `dashboard/index.tsx`)
- **Symbole Δ** — toujours via `<Delta />`, jamais de caractère Unicode brut, pour garantir un rendu cohérent (image SVG).
- **Dates** — toutes les dates stockées sont au format `YYYY-MM-DD` (string). Pour les manipuler côté client, toujours utiliser `parseLocalDate(dateStr)` de `src/lib/dates.ts` (évite les bugs de fuseau horaire liés à `new Date('YYYY-MM-DD')`). Pour l'affichage, `formatDateDMY(dateStr)` (format `fr-CH`, jj/mm/aaaa). `isToday(dateStr)` pour comparer à aujourd'hui.
- **`react-hooks/set-state-in-effect`** — plusieurs fichiers (`dashboard/index.tsx`, `flashcards.tsx`, `Cartes.tsx`) appellent une fonction `fetchX()` qui fait des `setState` depuis un `useEffect`. C'est un pattern existant et accepté dans ce projet ; ne pas le "corriger" en dehors d'une tâche dédiée à ce sujet.

---

## 4. Base de données Supabase

**Tables identifiées** (colonnes principales déduites des requêtes du code) :

| Table | Colonnes principales |
|---|---|
| `profiles` | `id`, `first_name`, `birth_date`, `gender` (`M`/`F`/`X`), `role` (`student`/`parent`/`child`), `has_met_odigo`, `last_seen_at`, `interests` |
| `subjects` | `id`, `name` — matières fixes du catalogue |
| `user_subjects` | `id`, `user_id`, `subject_id` (nullable), `custom_name`, `custom_emoji`, `custom_color`, `hidden` — personnalisation/masquage des matières par utilisateur |
| `evaluations` | `id`, `user_id`, `subject_id`, `topic`, `evaluation_date`, `start_time`, `end_time`, `readiness`, `grade`, `created_at` |
| `revisions` | `id`, `user_id`, `evaluation_id`, `revision_date`, `start_time`, `end_time`, `completed`, `details`, `created_at` |
| `events` | `id`, `user_id`, `title`, `event_date`, `start_time`, `end_time`, `details`, `created_at` |
| `reminders` | `id`, `user_id`, `title`, `description`, `deadline_date`, `deadline_time`, `odigo_remind` (`each_login`/`one_day`/`one_week`/`never`), `completed`, `created_at` |
| `word_lists` | `id`, `user_id`, `subject_id`, `name`, `list_type` (`vocabulary`/`conjugation`/`dictation`), `created_at` |
| `word_items` | `id`, `list_id`, `source_word`, `target_word`, `context`, `created_at` |
| `notes` | `id`, `user_id`, `subject_id`, `title`, `content` (HTML Tiptap), `archived`, `archive_folder`, `pinned`, `created_at`, `updated_at` |
| `postits` | `id`, `user_id`, `subject_id`, `content`, `color` (`yellow`/`green`/`pink`/`blue`), `size` (`small`/`square`/`large`), `icon`, `pinned`, `archived`, `position`, `created_at`, `updated_at` |
| `progress` | `user_id`, `digoos`, `digoos_this_week`, `active_weeks` (jsonb `{week, digoos}[]`), `week_streak`, `claimed_badges`, `claimed_days`, `claimed_weeks`, `claimed_months`, `last_week_reset`, `updated_at` |
| `daily_activity` | `user_id`, `action_type` (`exercise_completed`/`planner_entry`/`planner_*`/`revision_checked`/`grade_updated`), `date`, `questions_total`, `questions_correct`, `metadata` |
| `shop_items` | `id`, `type` (`'theme'`/`'title'`), `name`, `name_masculine`, `name_feminine`, `description`, `price`, `color`, `duration_days` |
| `user_purchases` | `id`, `user_id`, `item_id`, `purchased_at`, `expires_at`, `active` |
| `irl_rewards` | `id`, `parent_id`, `name`, `cost`, `description`, `stock`, `valid_until` |
| `irl_purchases` | `id`, `child_id`, `reward_id`, `reward_name`, `cost`, `status` (`valid`/`used`), `purchased_at`, `used_at` |
| `parent_child` | `parent_id`, `child_id`, `relationship` |
| `invite_codes` | `id`, `parent_id`, `code`, `used` |
| `cards` | `id`, `number`, `name`, `image_url` — cartes à collectionner |
| `user_cards` | `id`, `user_id`, `card_id` — cartes possédées |
| `suggestions` | `user_id`, `text`, `created_at` — utilisée par `src/services/suggestions.ts` ; migration appliquée manuellement sur Supabase |

**Règles RLS** :
- **Toujours activer RLS** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) sur toute nouvelle table.
- **Toujours ajouter un `GRANT`** après chaque `CREATE TABLE` (ex: `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;`), en plus des policies RLS — sans cela, même avec des policies correctes, les requêtes peuvent échouer.
- Policies typiques : un utilisateur peut lire/écrire ses propres lignes (`user_id = auth.uid()` ou `id = auth.uid()` pour `profiles`) ; un parent peut lire les données de ses enfants via une jointure sur `parent_child`.

**Conventions de nommage** :
- Tables et colonnes en `snake_case`, anglais.
- Clés étrangères vers `profiles`/utilisateur : `user_id` (sauf `parent_child.parent_id`/`child_id`, `irl_rewards.parent_id`, `irl_purchases.child_id`).
- Timestamps : `created_at`, `updated_at` (ISO 8601, `new Date().toISOString()`).
- Dates simples : `*_date` au format `YYYY-MM-DD`.
- Booléens : préfixe implicite par l'état (`completed`, `hidden`, `active`, `pinned`, `archived`, `used`).

---

## 5. Services et utilitaires

- **`addDigoos(amount, source?)`** (`src/services/digoos.ts`) — Ajoute des Δ au `progress` de l'utilisateur courant. `source` ∈ `'exercise' | 'planner' | 'badge' | 'reward'` (défaut `'exercise'`). Pour `'exercise'`, applique un multiplicateur dégressif via `getMultiplier(exercisesToday)` basé sur le nombre d'exercices déjà faits aujourd'hui (`daily_activity` avec `action_type='exercise_completed'`) : 100% pour ≤10, 80% pour 11-20, 60% au-delà. Crée la ligne `progress` si elle n'existe pas. Déclenche `window.triggerDigoosAnimation(finalAmount)` si défini. Retourne le montant final effectivement ajouté.
- **`deductDigoos(amount)`** — Soustrait `amount` de `digoos` et `digoos_this_week` (plancher à 0).
- **`addPlannerDigoos(actionType)`** — `actionType` ∈ `'eval_added' | 'grade_received' | 'revision_checked' | 'event_added' | 'reminder_added'`. Vérifie via `daily_activity` (`action_type = 'planner_' + actionType`) que l'action n'a pas déjà été récompensée aujourd'hui, log l'activité, puis appelle `addDigoos(amount, 'planner')` (montants : eval/grade/revision = 2, event/reminder = 1).
- **`logActivity(params)`** (`src/services/activity.ts`) — Insère une ligne dans `daily_activity` (`action_type`, `questions_total`, `questions_correct`, `metadata`, `date` = aujourd'hui). `action_type` ∈ `'exercise_completed' | 'planner_entry' | 'revision_checked' | 'grade_updated'`.
- **`submitSuggestion(text)`** (`src/services/suggestions.ts`) — Insère une suggestion utilisateur dans la table `suggestions` (RLS + GRANT déjà appliqués manuellement sur Supabase).
- **`speak(text, fallback?)`** (`src/lib/speech.ts`) — Lecture audio via `speechSynthesis`. `detectLang(text, fallback = 'fr-FR')` détecte le grec via la regex `/[Ͱ-Ͽ]/` et bascule sur `'el-GR'`, sinon `fallback`.
- **`findFAQ(query, audience)`** (`src/lib/faq.ts`) — Recherche dans le tableau statique `FAQ` (`audience: 'child' | 'parent' | 'both'`) une entrée dont un `tag` correspond à `query`, en comparaison insensible aux accents (normalisation NFD + suppression de `\p{Diacritic}`). Utilisée par `Companion.tsx` pour répondre instantanément sans appel à Claude.
- **`generateGreeting(ctx: GreetingContext)`** (`src/lib/greeting.ts`) — Génère un message d'accueil contextuel (anniversaire, absence prolongée, évaluation imminente, bonne semaine, heure de la journée...). Utilisé uniquement dans `home.tsx` — ne pas confondre avec `generateWelcomeMessage` (interne à `Companion.tsx`, logique similaire mais indépendante).
- **`showToast(message, type?, duration?)` / `useToast()`** (`src/components/Toast.tsx`) — `type` ∈ `'success' | 'error' | 'info'` (défaut `'success'`), `duration` en ms (défaut 2500). Nécessite d'être dans un `ToastProvider` (monté dans `App.tsx`).
- **`window.triggerDigoosAnimation(amount)`** — Hook global défini dans `dashboard/index.tsx` (`useEffect` au montage), branché sur la fonction `trigger` exposée par `DigoosAnimation` via sa prop `onRef`. Appelé automatiquement par `addDigoos()` pour afficher l'animation "+N Δ" avec son.
- **`parseLocalDate(dateStr)` / `formatDateDMY(dateStr)` / `isToday(dateStr)`** (`src/lib/dates.ts`) — voir section 3.

---

## 6. Pages et composants

### Pages racine (`src/pages/`)
| Fichier | Rôle |
|---|---|
| `loginpage.tsx` | Connexion / inscription en 3 étapes (email/mdp, profil, rôle élève ou parent) |
| `home.tsx` | Tableau de bord : évaluations à venir/passées, révisions, événements, rappels, accueil contextuel via `generateGreeting` |
| `wordlists.tsx` | Gestion des listes de vocabulaire/conjugaison/dictée, définitions générées par Claude |
| `settings.tsx` | Profil utilisateur, rôle, liaison parent/enfant (codes d'invitation), thème |
| `parent.tsx` | Espace parent : liste des enfants liés, génération de codes d'invitation, gestion des récompenses IRL et de leurs achats |
| `Cartes.tsx` | Digooland — cartes à collectionner, achat avec Δ, animation de retournement |
| `Histoire.tsx` | Digooland — histoire interactive à embranchements, export PDF |
| `Allumettes.tsx` | Digooland — jeu des allumettes |
| `worddrop.tsx`, `qcm.tsx`, `spelling.tsx`, `flashcards.tsx`, `conjugaison.tsx`, `vocabulaire.tsx` | Mini-jeux d'exercices (suivent le `GameState` pattern, récompensent via `addDigoos`/`logActivity`) |

### `dashboard/` — shell principal
- **`index.tsx`** — Point d'entrée post-login. Gère : thème CSS (`--color-primary`), profil, rôle parent/enfant, liste des enfants, navigation interne (`activePage`/`activeExercise`), solde Δ, onboarding, montage de `Companion` et `DigoosAnimation`.
- **`types.tsx`** — `navItems` (tableau de bord, planificateur, matières, listes de mots, exercices, récompenses, paramètres) et `exerciseCards` (worddrop, qcm, spelling, flashcards, conjugaison, vocabulaire — `allumettes`/`histoire`/`cartes` ne sont accessibles que via Récompenses/Digooland).
- **`Sidebar.tsx`** — Navigation latérale, sélecteur d'enfant, solde Δ, déconnexion.
- **`ChildSelector.tsx`** — Sélection de l'enfant à visualiser (mode parent).
- **`ExerciseCards.tsx`** — Grille de sélection des mini-jeux.
- **`OnboardingModal.tsx`** — Modale affichée à la première connexion.

### `planner/` — planificateur
- **`index.tsx`** — Fetch évaluations/révisions/événements/rappels + matières, orchestre vue liste/calendrier.
- **`PlannerList.tsx`** — Vue liste avec CRUD complet sur les 4 types d'entrées.
- **`PlannerCalendar.tsx`**, **`PlannerDay.tsx`**, **`PlannerWeek.tsx`**, **`PlannerMonth.tsx`**, **`CalendarItem.tsx`** — Vues calendrier (jour/semaine/mois) et rendu d'un item.
- **`types.ts`** / **`helpers.ts`** — Types (`Tab`, `Reminder`, `CalendarItem`...) et `formatDate`.

### `rewards/` — récompenses (page "Récompenses")
- **`index.tsx`** — 4 onglets : `rewards` (Boutique), `wallet` (Portefeuille), `progression` (Progrès), `howto` (Comment ça marche). Gère le reset hebdomadaire (`checkWeekReset`) et le résumé de semaine affiché le dimanche après 18h.
- **`RewardsBoutique.tsx`** — Récompenses IRL des parents + Digooland (thèmes de couleur, titres, jeux : Allumettes, Histoire, Cartes).
- **`RewardsPortfolio.tsx`** — Récompenses IRL achetées, statut `valid`/`used`.
- **`RewardsProgress.tsx`** — Badges (`ALL_BADGES`), jours/semaines/mois actifs à réclamer.
- **`RewardsHowItWorks.tsx`** — Explications du système de Δ.
- **`ProgressCircle.tsx`** — Composant SVG de cercle de progression.
- **`types.ts`** / **`helpers.ts`** — Types (`Progress`, `IrlReward`, `ShopItem`, `Badge`...) et helpers de semaines (`getCurrentWeekKey`, `getWeekRange`, `isAfterSundayReset`, `WEEK_THRESHOLD = 300`...).

### `subjects/` — matières
- **`index.tsx`** — Grille des matières ou détail (4 onglets) selon sélection.
- **`SubjectGrid.tsx`** — Grille des matières fixes + personnalisées (`user_subjects`).
- **`SubjectEvals.tsx`** — Évaluations/révisions liées à la matière.
- **`SubjectNotes.tsx`** — Notes de cours (éditeur Tiptap).
- **`SubjectPostits.tsx`** — Post-its.
- **`SubjectWordlists.tsx`** — Listes de mots de la matière.
- **`types.ts`** — `SubjectItem`, `Note`, `Postit`, `WordListItem`, `COLOR_PALETTE`, `FIXED_SUBJECTS`, `POSTIT_*`, `WORD_LIST_TYPES`, helpers (`getPreview`, `fmtDate`, `fmtDateDMY`).

### Composants partagés (`src/components/`)
Voir section 3 pour la liste — en résumé : `Companion` (chatbot Odigo, FAQ + suggestions + Claude), `Toast` (notifications), `Delta` (icône Δ), `OdigoAvatar` (avatar directionnel), `DigoosAnimation` (animation de gain de Δ), `EmptyState` (état vide générique).

---

## 7. Workflow

- **Ne jamais commiter ni pousser automatiquement.** Toujours attendre une instruction explicite du type "commit et push" avant d'exécuter `git add` / `git commit` / `git push`.
- **Ne jamais modifier ni commiter `.env.local`** — il contient `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ANTHROPIC_API_KEY`.
- **Toutes les dates `YYYY-MM-DD`** doivent être manipulées via `parseLocalDate()` (jamais `new Date(dateStr)` directement) pour éviter les décalages de fuseau horaire.
- **Après chaque `CREATE TABLE`**, ajouter systématiquement les `GRANT` nécessaires (`authenticated`) en plus de l'activation RLS et des policies — une table avec RLS activé mais sans `GRANT` bloque silencieusement les requêtes.
- **Vérifier `npm run build` et `npm run lint`** après toute modification de code avant de considérer une tâche terminée.
- **Texte en français** partout dans l'UI, les commentaires et les messages d'erreur.
- Déploiement : `git commit` + `git push` sur `main` → Netlify déploie automatiquement.
