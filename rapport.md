# Rapport — Alignement à gauche du récapitulatif (spelling.tsx)

## Changement appliqué

**Avant** :
```tsx
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.85rem' }}>
  <span style={{ color: '#555' }}><strong>{r.mot}</strong></span>
  <span style={{ color: r.type === 'perfect' ? '#2a9d8f' : r.type === 'ok' ? '#e9c46a' : '#e63946', fontWeight: 'bold' }}>
    ...
  </span>
</div>
```
**Après** :
```tsx
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.85rem', textAlign: 'left' }}>
  <span style={{ color: '#555' }}><strong>{r.mot}</strong></span>
  <span style={{ color: r.type === 'perfect' ? '#2a9d8f' : r.type === 'ok' ? '#e9c46a' : '#e63946', fontWeight: 'bold' }}>
    ...
  </span>
</div>
```
`textAlign: 'left'` ajouté sur le conteneur de la colonne de droite (mot + ligne de résultat empilés), forçant l'alignement à gauche indépendamment de tout centrage hérité d'un élément ancestral.

---

## Build + Lint

```
npm run build   → ✓ built in 926ms  (0 erreur TypeScript)
```

```
npx eslint src/pages/spelling.tsx
→ 8 problèmes (5 erreurs, 3 warnings) — identiques (mêmes lignes de code) à ceux déjà
  documentés lors des interventions précédentes sur ce fichier, tous pré-existants sur
  du code non touché par ce changement.
```

**0 nouvelle erreur, 0 nouveau warning introduits.**
