# Rapport — Récapitulatif détaillé ajouté à Maths.tsx

## 1. State `resultats` ajouté

```ts
const [resultats, setResultats] = useState<{
  question: string; userAnswer: string; correctAnswer: string; correct: boolean
}[]>([])
```
Réinitialisé dans `startGame()` (`setResultats([])`), aux côtés de `setResults([])`.

Alimenté dans `checkAnswer()` — point de validation unique, partagé par les 4 sous-modes (voir investigation précédente), au moment exact où `correct` est calculé, avant l'avancement à la question suivante :
```ts
const checkAnswer = () => {
  if (feedback || !userAnswer) return
  const correct = parseInt(userAnswer) === questions[currentIndex].answer
  const newResults = [...results, correct]

  setFeedback(correct ? 'correct' : 'incorrect')
  setResults(newResults)
  setResultats(prev => [...prev, {
    question: questions[currentIndex].text,
    userAnswer,
    correctAnswer: String(questions[currentIndex].answer),
    correct,
  }])

  setTimeout(() => {
    ...
```
`questions[currentIndex].text` (l'énoncé déjà formaté par le générateur du sous-mode courant) et `userAnswer` (la saisie brute de l'élève, encore présente à cet instant) sont utilisés tels quels — aucune adaptation par sous-mode n'a été nécessaire, conformément à ce qu'avait confirmé l'investigation (structure `Question` commune aux 4 générateurs).

## 2. Récapitulatif affiché sous ExerciseBilan

Même format que les autres exercices (colonne numéro fixe à gauche, contenu à droite) :
```tsx
<div style={{ maxWidth: '560px', margin: '0 auto', marginTop: '1.5rem', paddingBottom: '2rem' }}>
  <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
    <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
    {resultats.map((r, i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', gap: '0.75rem' }}>
        <span style={{ width: '3.5rem', flexShrink: 0, textAlign: 'center', color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>
          {i + 1}
        </span>
        <div style={{ flex: 1, fontSize: '0.85rem' }}>
          <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
            {r.correct
              ? `✓ ${r.question} = ${r.correctAnswer}`
              : `✗ ${r.question} — ta réponse : ${r.userAnswer} → ${r.correctAnswer}`
            }
          </span>
        </div>
      </div>
    ))}
  </div>
</div>
```
Une seule ligne de contenu par entrée (format exact demandé : "✓ {question} = {correctAnswer}" ou "✗ {question} — ta réponse : {userAnswer} → {correctAnswer}"), pas de ligne d'en-tête séparée puisque non demandée ici.

## Exemples de rendu, 2 sous-modes différents

**Multiplications** — question `"6 × 7"`, réponse attendue `42` :
- Réussi (saisie "42") : `✓ 6 × 7 = 42`
- Raté (saisie "41") : `✗ 6 × 7 — ta réponse : 41 → 42`

**Équations** (niveau moyen) — question `"3x + 8 = 23"`, réponse attendue `x = 5` :
- Réussi (saisie "5") : `✓ 3x + 8 = 23 = 5`
- Raté (saisie "4") : `✗ 3x + 8 = 23 — ta réponse : 4 → 5`

**Remarque** : pour les équations, le rendu réussi affiche deux signes "=" à la suite (`3x + 8 = 23 = 5`) puisque l'énoncé contient déjà un "=" — c'est le résultat exact et littéral du format `"✓ {question} = {correctAnswer}"` demandé, appliqué sans adaptation particulière au cas équation. Si un format plus lisible est souhaité pour ce sous-mode spécifiquement (ex. "✓ 3x + 8 = 23 → x = 5"), il faudra me le préciser — non modifié ici, la consigne donnée a été suivie à la lettre.

Pour référence, les deux autres sous-modes suivent le même schéma sans ambiguïté :
- **Calcul mental** — `"47 + 82"` → réussi : `✓ 47 + 82 = 129`
- **Divisions** — `"84 ÷ 12"` → raté (saisie "6") : `✗ 84 ÷ 12 — ta réponse : 6 → 7`

## Build + Lint

```
npm run build   → ✓ built in 992ms  (0 erreur TypeScript)
```

```
npx eslint src/pages/Maths.tsx
→ 0 problème
```

**0 erreur, 0 warning** — comme pour `LireHeure.tsx`, ce fichier n'avait aucun résidu de lint avant l'intervention et n'en a introduit aucun.
