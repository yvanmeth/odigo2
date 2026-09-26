# Rapport — Bouton du haut masqué quand un récapitulatif est présent

## Changement effectué (ExerciseBilan.tsx)

**Bouton du haut conditionné sur `!hasRecap`** — [ExerciseBilan.tsx:352-355](src/components/ExerciseBilan.tsx#L352-L355) :
```tsx
{/* Sur un exercice sans récapitulatif (hasRecap false), le bouton sticky ne
    s'affiche pas — celui-ci reste alors le seul moyen de continuer. */}
{!hasRecap && renderContinueButton('top')}
```
Auparavant `renderContinueButton('top')` s'affichait toujours ; il ne s'affiche désormais que si `hasRecap` est `false` (aucun `children` fourni). Quand `hasRecap` est `true`, seul le bouton sticky en bas (`renderContinueButton('sticky')`, déjà conditionné sur `hasRecap` depuis la tâche précédente) reste affiché — garantissant qu'un seul bouton "Obtenir les Δ" est visible à la fois.

`hasRecap` est calculé en amont dans le composant (`const hasRecap = Children.toArray(children).filter(Boolean).length > 0`, [ligne 204](src/components/ExerciseBilan.tsx#L204)), donc aucune duplication de logique.

## Ajustement de l'espacement bas de la carte Bilan

**Padding bas de la carte augmenté de `2rem` à `2.25rem` lorsque `hasRecap` est vrai** — [ExerciseBilan.tsx:255](src/components/ExerciseBilan.tsx#L255) :
```tsx
padding: hasRecap ? '2rem 1.75rem 2.25rem' : '2rem 1.75rem',
```
Sans bouton, le dernier élément visible de la carte est le bloc "Récompenses" (fond `#f8fffe`) ; avec le padding d'origine (`2rem` partout), l'espace restant sous ce bloc aurait été symétrique au padding du haut mais visuellement plus "léger" que quand le bouton plein (`background: var(--color-primary)`) ancrait le bas de la carte. Le padding bas légèrement supérieur (`2.25rem` contre `2rem` en haut) compense ce manque de poids visuel et évite que la carte paraisse tronquée ou mal équilibrée.

## Build & Lint

- `npm run build` → **0 erreur TypeScript**, build réussi (seul l'avertissement préexistant sur la taille des chunks, sans rapport).
- `npx eslint src/components/ExerciseBilan.tsx` → **0 erreur, 0 avertissement**.

## Comportement résultant

- Exercice **avec** récapitulatif (`children` fourni, cas des 14 fichiers migrés) : seul le bouton sticky en bas reste visible, restant accroché pendant tout le défilement du récapitulatif.
- Exercice **sans** récapitulatif (aucun `children`, filet de sécurité) : le bouton du haut reste affiché comme avant, avec un espacement bas de carte inchangé (`2rem`) — comportement identique à avant cette tâche.
