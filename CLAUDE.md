# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte du projet

ODIGO est une application d'apprentissage conçue pour **Neyla**, 10 ans, élève en 7P à Genève. Objectif principal : l'aider dans ses études. Objectif secondaire : commercialisation si succès.

**Intérêts de Neyla** (à utiliser pour personnaliser le contenu des exercices) : films Miyazaki, couture, Bigflo & Oli, son frère Nono, Nintendo Switch, mythologie grecque, Japon, Grèce, Algérie, sa Mamie.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Type-check (tsc -b) then bundle to dist/
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

No test framework is configured. To add one, install `vitest` (Vite-native, ESM-compatible).

## Environment Variables

Variables stockées dans `.env.local` — **ne jamais modifier ni commiter ce fichier**.

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...
```

The Anthropic API key is used directly from the browser in several components. The Supabase client is initialized in [src/lib/supabase.ts](src/lib/supabase.ts).

## Architecture

This is a French-language gamified learning app for students. It uses **React 19 + TypeScript + Vite** on the frontend with **Supabase** as the backend (auth, database) and the **Anthropic API** for AI features (called directly from the browser).

### Routing

There is no router library. [App.tsx](src/App.tsx) checks Supabase auth state and renders either `LoginPage` or `Dashboard`. `Dashboard` manages its own internal navigation via a `currentPage` state string, rendering the appropriate page component in its main content area.

### Page components (`src/pages/`)

Each file in `src/pages/` is a self-contained page that fetches its own data from Supabase. Most accept an optional `userId` prop for parent-mode viewing. Key pages:

- **dashboard.tsx** — Main shell: sidebar nav, top bar, renders all other pages, hosts the Companion widget
- **home.tsx** — Evaluations overview (upcoming vs. past)
- **planner.tsx** — Evaluations, revisions, and events (full CRUD)
- **subjects.tsx** — Subject catalog
- **wordlists.tsx** — Vocabulary management (Claude-assisted definition fetching)
- **parent.tsx** — Parent/guardian monitoring view

Exercise mini-games: `worddrop.tsx`, `flashcards.tsx`, `qcm.tsx`, `spelling.tsx`, `conjugaison.tsx`. Each game fetches vocabulary from Supabase and awards points on completion via `addDigoos()`. All exercises follow the same `GameState` pattern: `'select' | 'loading' | 'playing' | 'result'`.

### AI features

- **[src/components/Companion.tsx](src/components/Companion.tsx)** — Floating AI chatbot (the "Odigo" character). Builds context from Supabase (profile, upcoming evaluations, progress), then calls Claude Sonnet 4.5 via the Anthropic SDK for conversational support and contextual welcome messages.
- **conjugaison.tsx** and **wordlists.tsx** — Call Claude directly to generate exercise content.

### Reward system

[src/services/digoos.ts](src/services/digoos.ts) manages the "Digoos" XP/reward points. Points are added after completed exercises and reset weekly. Badges/achievements are displayed in `rewards.tsx`.

### Supabase schema (key tables)

`profiles`, `subjects`, `evaluations`, `revisions`, `events`, `wordlists`, `worditem`, `progress`

### Shared types

[src/type/index.ts](src/type/index.ts) contains all shared TypeScript interfaces (`Profile`, `Subject`, `Evaluation`, `WordList`, etc.).

## Conventions

- **All styling is inline CSS** — no Tailwind, no CSS modules. Palette: principal `#2a9d8f`, secondaire `#e9c46a`, erreur `#e63946`, accent `#e76f51`, fond `#f0faf8`.
- **No centralized state management** — React `useState`/`useEffect` hooks throughout; no Redux, Zustand, or Context API.
- **French UI** — All user-facing text, comments, and error messages are in French.
- TypeScript is configured in strict mode with `noUnusedLocals` and `noUnusedParameters` enabled.

## Déploiement

`git commit` + `git push` → Netlify déploie automatiquement.
