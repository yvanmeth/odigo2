# Rapport — Ajustements Bilan (Niveau, subLabel, progression)

> Build : ✅ `npm run build` — 0 erreur.
> Lint : ✅ `npx eslint src/components/ExerciseBilan.tsx src/pages/Maths.tsx` — 0 erreur, 0 warning.

---

## 1. ExerciseBilan.tsx — ligne "Niveau" réorganisée

`coeffLabel` (string | null) remplacé par `coeffInfo` ({ label, coeff } | null).

**Avant :**
```
Niveau     ×0.8 (facile)
```

**Après :**
```
Niveau facile     × 0.8
Niveau difficile  × 1.2
```

L'information de difficulté est maintenant dans la colonne gauche (avec le libellé sémantique), le coefficient seul à droite — plus lisible d'un coup d'œil.

## 2. ExerciseBilan.tsx — prop subLabel

Ajout de `subLabel?: string` dans `ExerciseBilanProps`.

Logique d'affichage du titre :
```ts
const exerciseLabel = subLabel ?? EXERCISE_LABELS[exercise] ?? exercise
```

Si `subLabel` est fourni, il remplace le label générique issu de `EXERCISE_LABELS`. Aucun changement de rendu pour les exercices qui ne passent pas encore `subLabel`.

## 3. Maths.tsx — subLabel passé au bilan

Le bilan reçoit désormais le nom réel du sous-mode joué :

| Sous-mode       | subLabel affiché |
|----------------|-----------------|
| calcul         | Calcul mental   |
| multiplication | Multiplications |
| division       | Divisions       |
| equation       | Équations       |

La valeur provient de `EXERCISE_INFO[selectedExercise].label`, déjà défini dans Maths.tsx — pas de duplication.

```tsx
subLabel={selectedExercise ? EXERCISE_INFO[selectedExercise].label : undefined}
```

## 4. Maths.tsx — barre de progression 100% à la question 10

**Avant :** `const progress = (currentIndex / 10) * 100`
→ question 10 (index 9) → 90%

**Après :** `const progress = ((currentIndex + 1) / 10) * 100`
→ question 1 (index 0) → 10%, question 10 (index 9) → 100%

La barre atteint 100% dès l'affichage de la dernière question, avant même la validation.

Aucun autre fichier n'utilise ce pattern de barre de progression (les autres exercices ont soit une progression différente, soit pas de barre).
