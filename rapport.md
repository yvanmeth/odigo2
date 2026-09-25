# Rapport — Refonte du récapitulatif de CarteSuisse.tsx

## 1. Tracking du canton cliqué

`resultats` enrichi avec `cantonCapital` (chef-lieu du canton demandé, nécessaire pour l'affichage du type "capitale") et `clickedCantonName` (nom résolu du canton réellement cliqué) :

```ts
const [resultats, setResultats] = useState<{
  canton: string
  cantonCapital: string
  questionType: QuestionType
  correct: boolean
  clickedCantonName: string
}[]>([])
```

Résolution dans le handler de clic ([CarteSuisse.tsx:135-152](src/pages/CarteSuisse.tsx#L135-L152)) :
```ts
const isCorrect = id === canton.id
const clickedCantonName = CANTONS.find(c => c.id === id)?.name ?? id
...
setResultats(prev => [...prev, {
  canton: canton.name,
  cantonCapital: canton.capital,
  questionType,
  correct: isCorrect,
  clickedCantonName,
}])
```
`clickedCantonName` est résolu via une recherche dans `CANTONS` par `id` (l'attribut `id` de l'élément SVG cliqué) — fonctionne aussi bien en cas de bonne réponse (où `clickedCantonName === canton.name`) qu'en cas d'erreur (où il diffère). Le fallback `?? id` ne devrait jamais se déclencher en pratique (le handler filtre déjà `id.startsWith('CH')`, garantissant une correspondance dans `CANTONS`), gardé par prudence.

## 2. Affichage conditionnel selon le type de question

```tsx
<strong>
  {r.questionType === 'nom' ? r.canton : `${r.cantonCapital} (${r.canton})`}
</strong>
...
<span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
  {r.correct ? '✓ Trouvé' : `✗ Raté (Tu as cliqué sur ${r.clickedCantonName})`}
</span>
```
([CarteSuisse.tsx:264-272](src/pages/CarteSuisse.tsx#L264-L272))

La mention technique "(nom)"/"(chef-lieu)" a disparu. Plus aucune trace du mot `questionType` dans l'affichage — il ne sert plus qu'à choisir la mise en forme.

## Exemples de rendu obtenus

**Type "nom", raté** (`questionType: 'nom'`, `canton: 'Uri'`, `correct: false`, `clickedCantonName: 'Zurich'`) :
```
Uri
✗ Raté (Tu as cliqué sur Zurich)
```

**Type "capitale", raté** (`questionType: 'capitale'`, `canton: 'Vaud'`, `cantonCapital: 'Lausanne'`, `correct: false`, `clickedCantonName: 'Genève'`) :
```
Lausanne (Vaud)
✗ Raté (Tu as cliqué sur Genève)
```

**Type "nom", trouvé** (`canton: 'Berne'`, `correct: true`) :
```
Berne
✓ Trouvé
```

**Type "capitale", trouvé** (`canton: 'Fribourg'`, `cantonCapital: 'Fribourg'`, `correct: true`) :
```
Fribourg (Fribourg)
✓ Trouvé
```
(cas particulier où chef-lieu et nom du canton coïncident — comportement normal, non traité différemment, fidèle à la donnée)

Ces rendus correspondent exactement aux deux exemples attendus fournis dans la demande.

## Build + Lint

```
npm run build   → ✓ built in 941ms  (0 erreur TypeScript)
```

```
npx eslint src/pages/CarteSuisse.tsx
→ 2 problèmes (0 erreur, 2 warnings) — strictement identiques à l'état
  précédent (react-hooks/exhaustive-deps sur getCantonFill/finishGame,
  catégorie déjà présente avant cette intervention).
```

**0 nouvelle erreur, 0 nouveau warning introduits.**
