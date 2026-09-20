# Rapport — Ordre ExerciseBilan / HighscoreModal dans Anagramme.tsx

> Build : ✅ `npm run build` — 0 erreur TypeScript, 0 erreur Vite.
> Lint : ⚠️ erreurs pré-existantes dans Anagramme.tsx (lignes 78, 80, 84, 98, 128 — patterns `set-state-in-effect` et `immutability` sur useEffect initial et `startGame`, inchangés depuis l'origine). **Aucune erreur introduite.**

---

## Problème corrigé

Avant ce correctif, deux boutons de `HighscoreModal` (`Rejouer`, `Quitter`) court-circuitaient `ExerciseBilan`, empêchant l'attribution des Δ si le score était un highscore.

---

## Changements appliqués

### 1. `type GameState` — nouvel état `'highscore'`

```ts
type GameState = 'select' | 'playing' | 'result' | 'highscore'
```

### 2. `finaliser` — ExerciseBilan affiché immédiatement, checkHighscore en parallèle

```ts
const finaliser = async (totalPoints: number, totalCorrect: number) => {
  if (guestMode) { onGameEnd?.(); return }
  setShowHighscore(false)      // reset avant la vérification asynchrone
  setGameState('result')       // ExerciseBilan apparaît sans délai
  const [, isTop] = await Promise.all([
    logActivity({ ... }),
    checkHighscore(totalPoints),
  ])
  setShowHighscore(isTop)      // flag disponible quand l'utilisateur clique "Continuer"
}
```

`logActivity` et `checkHighscore` s'exécutent en parallèle. `ExerciseBilan` s'affiche immédiatement sans attendre leur résultat. Quand l'utilisateur atteint le bouton "Continuer" d'ExerciseBilan (après les animations d'étoiles), le flag `showHighscore` est déjà résolu.

### 3. `ExerciseBilan.onDone` — branchement conditionnel

```tsx
onDone={() => {
  if (showHighscore) setGameState('highscore')
  else { setGameState('select'); setWords([]) }
}}
```

### 4. Bloc `'highscore'` — HighscoreModal en plein écran après ExerciseBilan

```tsx
if (gameState === 'highscore') {
  return (
    <HighscoreModal
      exercise="anagramme"
      listId={selectedListId}
      listName={listName}
      score={points}
      onClose={()   => { setShowHighscore(false); setGameState('select'); setWords([]) }}
      onDisable={() => { setShowHighscore(false); setGameState('select'); setWords([]) }}
      onReplay={()  => { setShowHighscore(false); setGameState('select'); startGame() }}
      onQuit={()    => { setShowHighscore(false); setGameState('select'); setWords([]) }}
    />
  )
}
```

### 5. Suppression de l'ancien overlay HighscoreModal

L'ancien `{showHighscore && <HighscoreModal ...>}` superposé à la vue `playing` est supprimé. HighscoreModal n'est plus rendu qu'en état `'highscore'`, jamais en superposition.

---

## Flux complet résultant

```
partie terminée
  → finaliser()
      ├─ setGameState('result')        → ExerciseBilan visible immédiatement
      └─ Promise.all([logActivity, checkHighscore]) → setShowHighscore(isTop)

  → utilisateur clique "Continuer" dans ExerciseBilan (addDigoos déjà appelé)
      ├─ showHighscore = true  → setGameState('highscore') → HighscoreModal
      │     ├─ Fermer    → select
      │     ├─ Désactiver → select
      │     ├─ Rejouer   → select + startGame()
      │     └─ Quitter   → select
      └─ showHighscore = false → select directement
```

Les Δ sont **toujours attribués** par ExerciseBilan, quel que soit le bouton cliqué ensuite dans HighscoreModal.
