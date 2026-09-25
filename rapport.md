# Rapport — Retrait de la mention "+1 bonus streak !" (DefiHistoireGeo.tsx)

## Changement appliqué

**Avant** :
```tsx
{feedback === 'correct'
  ? <>✓ Bravo !{streak >= 3 && <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>🔥 +1 bonus streak !</span>}</>
  : `✗ Réponse : ${currentQuestion.answer}`}
```

**Après** :
```tsx
{feedback === 'correct'
  ? <>✓ Bravo !{streak >= 3 && <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>🔥</span>}</>
  : `✗ Réponse : ${currentQuestion.answer}`}
```
([DefiHistoireGeo.tsx:371](src/pages/DefiHistoireGeo.tsx#L371))

Le 🔥 reste affiché à partir de 3 bonnes réponses d'affilée (`streak >= 3`), comme signal visuel encourageant, sans plus aucune mention chiffrée d'un "bonus" — le state interne `score`/streak (obsolète depuis l'intégration d'`ExerciseBilan`, qui seul détermine la récompense réelle) n'est donc plus suggéré comme ayant un impact sur le gain final. Rien d'autre modifié : le calcul interne du streak/score (HUD "score pts" pendant le jeu) reste inchangé, seul ce texte de feedback est retiré, conformément à la demande.

## Build + Lint

```
npm run build   → ✓ built in 952ms  (0 erreur TypeScript)
```

```
npx eslint src/pages/DefiHistoireGeo.tsx
→ 1 problème (1 erreur, 0 warning) — strictement identique à l'état précédent
  (react-hooks/set-state-in-effect sur le useEffect de mélange des choix QCM,
  non touché par ce changement, pattern déjà documenté comme accepté dans
  CLAUDE.md).
```

**0 nouvelle erreur, 0 nouveau warning introduits.**
