# Rapport — Restructuration du récapitulatif de PuzzlePhrases.tsx

## Changement appliqué

**Fichier** : `src/pages/PuzzlePhrases.tsx` (bloc récapitulatif de l'écran `result`)

**Avant** (ligne unique, phrase + résultat côte à côte avec badge superposé) :
```tsx
{resultats.map((r, i) => (
  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem', gap: '0.5rem' }}>
    <span style={{ color: '#555', flex: 1 }}>
      <strong>{r.french}</strong>
      {r.attempt === 2 && (
        <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#e9c46a', fontWeight: 'normal' }}>2e essai</span>
      )}
    </span>
    {r.attempt === 2 ? (
      <span style={{ textAlign: 'right', color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
        1er essai : {r.premierEssai || '—'} ✗ · 2e essai : {r.correct ? `✓ ${r.attendu}` : `✗ ${r.donne} → ${r.attendu}`}
      </span>
    ) : (
      <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold', textAlign: 'right' }}>
        {r.correct ? `✓ ${r.attendu}` : `✗ ${r.donne} → ${r.attendu}`}
      </span>
    )}
  </div>
))}
```

**Après** (numéro + colonne empilée verticalement) :
```tsx
{resultats.map((r, i) => (
  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', gap: '0.75rem' }}>
    <span style={{ width: '1.5rem', flexShrink: 0, textAlign: 'center', color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>
      {i + 1}
    </span>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.85rem' }}>
      <span style={{ color: '#555' }}><strong>{r.french}</strong></span>
      {r.attempt === 2 ? (
        <>
          <span style={{ color: '#e63946' }}>1er essai : {r.premierEssai || '—'} ✗</span>
          <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
            2e essai : {r.correct ? `✓ ${r.attendu}` : `✗ ${r.donne} → ${r.attendu}`}
          </span>
        </>
      ) : (
        <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
          {r.correct ? `✓ ${r.attendu}` : `✗ ${r.donne} → ${r.attendu}`}
        </span>
      )}
    </div>
  </div>
))}
```

## Détail des changements

- **Colonne numéro** : `<span>` de largeur fixe `1.5rem`, `flexShrink: 0`, texte centré, couleur discrète `#aaa`. Le conteneur parent (`display: flex, alignItems: 'center'`) centre verticalement ce numéro par rapport à la hauteur totale du bloc — qu'il fasse 2 lignes (attempt 1) ou 3 lignes (attempt 2, avec la phrase + 2 lignes de résultat).
- **Colonne principale** : `<div>` en `flexDirection: 'column'` contenant :
  - la phrase française en gras, toujours en premier ;
  - **si `attempt === 1`** : une seule ligne résultat (✓ vert ou ✗ rouge), inchangée dans son contenu ;
  - **si `attempt === 2`** : deux lignes distinctes empilées — `1er essai : {premierEssai} ✗` en rouge, puis `2e essai : ✓/✗ ...` colorée selon le résultat final.
- **Badge "2e essai" superposé retiré** : l'information est désormais portée explicitement par la ligne "1er essai : ...", donc le petit badge à côté de la phrase (`<span>2e essai</span>` en superposition) a été supprimé.
- **Séparateur** : `borderBottom: '1px solid #f5f5f5'` conservé à l'identique entre chaque bloc question.

Tout le contenu logique existant (texte de la phrase, valeurs `attendu`/`donne`/`premierEssai`, couleurs vert/rouge, calcul `r.attempt === 2`) est conservé sans modification — seule la disposition visuelle change.

---

## Build + Lint

```
npm run build   → ✓ built in 1.00s  (0 erreur TypeScript)
```

```
npx eslint src/pages/PuzzlePhrases.tsx
→ 1 erreur — pré-existante, sur du code non modifié :
  - L.162 react-hooks/set-state-in-effect (fetchLists() appelée dans useEffect(() => {...}, []))
```

**0 nouvelle erreur introduite.**
