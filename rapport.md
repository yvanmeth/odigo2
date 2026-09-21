# Rapport — Correction bug stopPropagation dans vocabulaire.tsx

## Modification effectuée

Ajout de `e.stopPropagation()` dans `handleKey`, juste après la détection de la touche Entrée :

```ts
// src/pages/vocabulaire.tsx
const handleKey = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.stopPropagation()          // ← ajouté
    if (!feedback) valider()
    else suivant()
  }
}
```

## Effet

L'événement natif `keydown` ne remonte plus jusqu'à `document` quand il est traité par l'input. Le listener document (qui gère "Entrée = Suivant" pendant l'affichage du feedback) ne reçoit plus les events originant de l'input actif.

Chemins après correction :

| Situation | Input | handleKey | stopPropagation | Listener document |
|---|---|---|---|---|
| Saisie active, Entrée | enabled | fire | bloque la propagation | ❌ ne reçoit pas |
| Feedback affiché, Entrée | disabled | ne fire pas | non appelé | ✅ reçoit → suivant() |

## Build et lint

```
✓ Build : succès
✓ Lint vocabulaire.tsx : 3 erreurs pré-existantes inchangées (lignes 89, 91, 128)
  Aucune erreur nouvelle.
```
