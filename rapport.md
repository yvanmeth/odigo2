# Rapport — Système de difficulté à 3 modes (Apprenti/Aventurier/Légende) dans spelling.tsx

## Changements appliqués

### 1. Type, constante et state de difficulté

```ts
type Difficulty = 'facile' | 'moyen' | 'difficile'

const DIFFICULTIES: { id: Difficulty; label: string; icon: string }[] = [
  { id: 'facile', label: 'Apprenti', icon: '🌱' },
  { id: 'moyen', label: 'Aventurier', icon: '⚔️' },
  { id: 'difficile', label: 'Légende', icon: '👑' },
]
```
```ts
const [difficulty, setDifficulty] = useState<Difficulty>('moyen')
```
Sélecteur ajouté à l'écran `'select'`, entre "Direction" et le bouton "Jouer", suivant le pattern déjà utilisé sur Maths.tsx/worddrop.tsx :
```tsx
<div style={{ marginBottom: '1.5rem' }}>
  <label>Difficulté</label>
  <div style={{ display: 'flex', gap: '0.5rem' }}>
    {DIFFICULTIES.map(d => (
      <button key={d.id} onClick={() => setDifficulty(d.id)} style={{...}}>
        {d.icon} {d.label}
      </button>
    ))}
  </div>
</div>
```

### 2-3. Pré-activation automatique + difficulty en dépendance

```ts
setUsedListen(false)
setUsedLetterCount(false)
setUsedFirstLetter(false)
// Pré-activation automatique des indices selon la difficulté :
// facile = les deux visibles d'office ; moyen = nombre de lettres seul ; difficile = aucun
setShowLetterCount(difficulty !== 'difficile')
setShowFirstLetter(difficulty === 'facile')
setTimeout(() => inputRef.current?.focus(), 100)
}, [currentWord, queue, gameState, difficulty])
```
`difficulty` ajoutée aux dépendances de l'effet qui affiche chaque nouveau mot, garantissant que le choix fait à l'écran `'select'` est bien pris en compte dès le premier mot de la partie (l'effet re-déclenche pour le premier mot dans tous les cas via `currentWord`/`queue`/`gameState`, avec `difficulty` déjà figée avant `setGameState('playing')`).

### 4. hadOptionalHint — tracking distinct des flags d'affichage

```ts
const [hadOptionalHint, setHadOptionalHint] = useState(false)
```
Calcul par mot dans `handleValidate`, juste après la construction de `resultats` :
```ts
// Un indice est "optionnel" (au-delà du contexte normal du mode) si :
// - moyen : la 1ère lettre a été demandée en plus (le nb de lettres est déjà automatique)
// - difficile : l'un des deux a été demandé (rien n'est automatique)
// - facile : jamais, les deux indices sont déjà le contexte normal
const hintWasOptional =
  difficulty === 'moyen' ? usedFirstLetter :
  difficulty === 'difficile' ? (usedLetterCount || usedFirstLetter) :
  false
if (hintWasOptional) setHadOptionalHint(true)
```
`difficulty`, `usedFirstLetter`, `usedLetterCount` ajoutés aux dépendances du `useCallback` de `handleValidate` (nécessaires puisque désormais lus dans son corps). `hadOptionalHint` réinitialisé à `false` uniquement au démarrage d'une nouvelle partie, jamais remis à `false` en cours de partie — conforme à la consigne.

### 5. Props passées à ExerciseBilan

```tsx
<ExerciseBilan
  exercise="spelling"
  errors={TOTAL_WORDS - correctFirstPass}
  difficulty={difficulty}
  hasRevisionBonus={hasRevisionBonus}
  listName={listName || undefined}
  blocksPerfect={hadOptionalHint}
  onDone={() => { setGameState('select'); setWords([]) }}
/>
```
`difficulty={difficulty}` remplace le `"moyen"` figé de la Phase 1. `blocksPerfect={hadOptionalHint}` ajouté.

### 6. Masquage conditionnel des boutons d'indices

```tsx
{difficulty === 'difficile' && (
  <button onClick={() => { setShowLetterCount(true); setUsedLetterCount(true) }} style={{...}}>
    Nombre de lettres
  </button>
)}
{difficulty !== 'facile' && (
  <button onClick={() => { setShowFirstLetter(true); setUsedFirstLetter(true) }} style={{...}}>
    Première lettre
  </button>
)}
```
- **facile** : les deux boutons masqués (les deux indices déjà auto-affichés).
- **moyen** : "Nombre de lettres" masqué (auto-affiché), "Première lettre" visible et cliquable.
- **difficile** : les deux visibles et cliquables (comportement inchangé par rapport à avant cette fonctionnalité).

### 7. Renommage des libellés

- `"# Lettres {usedLetterCount && '(-pts)'}"` → `"Nombre de lettres"`
- `"A_ 1ère lettre {usedFirstLetter && '(-pts)'}"` → `"Première lettre"`

Le bouton "🔊 Écouter {usedListen && '(-pts)'}" n'a pas été touché (non mentionné dans la consigne — hors périmètre de cette passe).

---

## Trace mentale des 3 modes — quand `hadOptionalHint` devient-il vrai ?

### Apprenti (facile)
`showLetterCount` et `showFirstLetter` sont posés à `true` automatiquement pour **chaque** mot par l'effet. Les deux boutons sont masqués (`difficulty === 'difficile'` faux, `difficulty !== 'facile'` faux) — **aucun clic n'est possible**, donc `usedLetterCount`/`usedFirstLetter` restent `false` du début à la fin. Dans `handleValidate`, la branche `difficulty === 'facile'` tombe directement sur `false` dans le ternaire. **`hadOptionalHint` ne devient jamais vrai en mode facile**, quel que soit le déroulement de la partie — exactement la garantie demandée.

### Aventurier (moyen)
`showLetterCount = true` automatiquement (bouton "Nombre de lettres" masqué). `showFirstLetter = false` (bouton "Première lettre" visible et cliquable).
- Si l'élève ne clique **jamais** sur "Première lettre" sur les 10 mots : `usedFirstLetter` reste `false` à chaque validation → `hintWasOptional = false` à chaque mot → `hadOptionalHint` reste `false` toute la partie.
- Si l'élève clique sur "Première lettre" pour, disons, le mot n°4 : à la validation de ce mot n°4, `usedFirstLetter === true` → `hintWasOptional = true` → `setHadOptionalHint(true)`. **`hadOptionalHint` devient vrai à partir de ce moment précis** et le reste jusqu'à la fin de la partie, même si l'élève n'utilise plus jamais cet indice sur les mots suivants.

### Légende (difficile)
`showLetterCount = false`, `showFirstLetter = false` — rien n'est automatique, les deux boutons sont visibles et cliquables pour chaque mot (comportement identique à avant l'ajout des modes).
- Si l'élève ne clique **ni** "Nombre de lettres" **ni** "Première lettre" sur aucun des 10 mots : `usedLetterCount` et `usedFirstLetter` restent `false` à chaque validation → `hadOptionalHint` reste `false` toute la partie.
- Si l'élève clique sur **l'un ou l'autre** (ou les deux) pour n'importe quel mot, par exemple "Nombre de lettres" sur le mot n°7 : à la validation de ce mot, `usedLetterCount === true` → `hintWasOptional = (true || false) = true` → `setHadOptionalHint(true)`. **`hadOptionalHint` devient vrai dès le premier usage de n'importe quel indice**, et reste vrai jusqu'à la fin.

---

## Build + Lint

```
npm run build   → ✓ built in 926ms  (0 erreur TypeScript)
```

```
npx eslint src/pages/spelling.tsx
→ 8 problèmes (5 erreurs, 3 warnings) — identiques (mêmes lignes de code, décalées suite
  aux ajouts) à ceux déjà documentés lors des interventions précédentes, tous pré-existants
  sur du code non touché par cette fonctionnalité.
```

**0 nouvelle erreur, 0 nouveau warning introduits.**
