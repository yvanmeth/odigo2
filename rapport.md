# Rapport — Libellé HUD pendant la phase de révision (flashcards.tsx)

## Changement appliqué

**Avant** :
```tsx
<div style={{ fontSize: '0.9rem', color: '#888' }}>
  {knownCount} sue{knownCount > 1 ? 's' : ''} · {remaining} restante{remaining > 1 ? 's' : ''}
</div>
```
**Après** :
```tsx
<div style={{ fontSize: '0.9rem', color: '#888' }}>
  {isReviewPhase
    ? <>Révision · {remaining} carte{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}</>
    : <>{knownCount} sue{knownCount > 1 ? 's' : ''} · {remaining} restante{remaining > 1 ? 's' : ''}</>
  }
</div>
```

Pendant `isReviewPhase` (uniquement atteignable en mode normal — `isReviewPhase` reste toujours `false` en mode libre, qui n'a pas de phase de révision), le HUD affiche désormais "Révision · N carte(s) restante(s)" au lieu du décompte "sue(s)". En dehors de la révision (mode normal 1er passage, ou mode libre dans son intégralité), l'affichage reste strictement identique à avant.

---

## Build + Lint

```
npm run build   → ✓ built in 986ms  (0 erreur TypeScript)
```

```
npx eslint src/pages/flashcards.tsx
→ 15 problèmes (12 erreurs, 3 warnings) — identiques (mêmes lignes de code) à ceux déjà
  documentés lors des interventions précédentes, tous pré-existants sur du code non
  touché par ce changement.
```

**0 nouvelle erreur, 0 nouveau warning introduits.**
