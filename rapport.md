# Rapport — Retrait des console.log de diagnostic clavier (PuzzlePhrases.tsx)

## Changement appliqué

**Fichier** : `src/pages/PuzzlePhrases.tsx`

Les 3 `console.log` temporaires ajoutés pour le diagnostic empirique du bug clavier ont été retirés :

1. `console.log('[INPUT] keydown', e.key)` — retiré de l'`onKeyDown` de l'input mode difficile.
2. `console.log('[DOCUMENT] keydown', e.key)` — retiré du `handler` du listener document.
3. `console.log('[ENTER ACTION] feedback=', feedback, 'canValidate=', canValidate)` — retiré du début de `handleEnterAction()`.

Le code logique (garde, `stopPropagation()`, branchement `handleEnterAction`) est resté strictement identique à avant l'instrumentation — seules les lignes de log ont été supprimées.

## Vérification

```
grep "console\.log" src/pages/PuzzlePhrases.tsx
→ Aucune correspondance.
```

Aucun `console.log` de debug ne subsiste dans le fichier.

---

## Build + Lint

```
npm run build   → ✓ built in 1.41s  (0 erreur TypeScript)
```

```
npx eslint src/pages/PuzzlePhrases.tsx
→ 1 erreur — pré-existante, sur du code non modifié :
  - L.162 react-hooks/set-state-in-effect (fetchLists() appelée dans useEffect(() => {...}, []))
```

**0 nouvelle erreur introduite.** Le fichier est revenu à son état de code de production, sans instrumentation résiduelle.
