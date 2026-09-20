# Rapport — Multiplications : passage aux ensembles de tables explicites

> Build : ✅ `npm run build` — 0 erreur TypeScript, 0 erreur Vite.
> Lint : ✅ `eslint src/pages/Maths.tsx` — 0 erreur, 0 avertissement.

---

## Fichier modifié

**`src/pages/Maths.tsx`** — zone `generateMultiplication` / `generateMultiplicationBatch` uniquement.

---

## Changement appliqué

`MULT_RANGES` (plage continue `[min, max]`) remplacé par `MULT_TABLES` (ensemble explicite) + helper `pickFrom`.

```ts
const MULT_TABLES: Record<Difficulty, number[]> = {
  facile:    [1, 2, 3, 4, 5, 6, 10],
  moyen:     [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  difficile: [4, 5, 6, 7, 8, 9, 11, 12],
}

const pickFrom = (arr: number[]) => arr[randomInt(0, arr.length - 1)]
```

`generateMultiplication` et `generateMultiplicationBatch` utilisent désormais `pickFrom(MULT_TABLES[diff])` à la place de `randomInt(min, max)`. Le mécanisme anti-répétition consécutive (clé normalisée `min(a,b)x max(a,b)`, max 20 tentatives) est conservé sans modification.

---

## Non modifié

- `generateCalcul`, `generateDivision`, `generateEquation` — intacts.
- `startGame`, `GENERATORS`, logique de jeu, ExerciseBilan — inchangés.
