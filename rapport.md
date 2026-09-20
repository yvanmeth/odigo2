# Rapport — Correction timing pendingEditItem / evalListId au montage de PlannerList

> Build : ✅ `npm run build` — 0 erreur TypeScript, 0 erreur Vite.
> Lint : ⚠️ 7 problèmes dans PlannerList.tsx — tous **pré-existants** (lignes 131, 154, 176, 183). Aucune erreur introduite.

---

## Fichier modifié

**`src/pages/planner/PlannerList.tsx`** — une seule suppression dans l'effet `[evalSubject, userId]`

## Correction appliquée

### Avant
```ts
if (!evalSubject) { setListsForSubject([]); setEvalListId(''); return }
```

### Après
```ts
if (!evalSubject) { setListsForSubject([]); return }
```

---

## Pourquoi cette suppression suffit

`setEvalListId('')` dans la branche early-return n'est pas nécessaire parce que le sélecteur de liste est conditionné par :
```tsx
{evalSubject && listsForSubject.length > 0 && (...)}
```
Quand `evalSubject` est vide, le sélecteur est déjà invisible — forcer `evalListId` à vide dans ce cas n'a aucun effet visible.

En revanche, ce `setEvalListId('')` causait un conflit de timing au premier montage de `PlannerList` (déclenché depuis la vue calendrier via `handleCalendarEdit`) :

1. `PlannerList` monte avec `pendingEditItem` déjà non-null et `evalSubject = ''` (état initial)
2. Les deux effets s'exécutent dans le même cycle de rendu, dans l'ordre de déclaration :
   - Effet `pendingEditItem` → `setEvalListId("abc-uuid")` (queued)
   - Effet `evalSubject` (initial, `evalSubject = ''`) → `setEvalListId('')` (queued, **écrasait** le précédent)
3. Dernier appel gagnant : `evalListId = ''` — pré-remplissage perdu

Après suppression : l'effet `evalSubject` sur le montage initial (avec `evalSubject = ''`) ne touche plus `evalListId`. Le batch ne contient que `setEvalListId("abc-uuid")` du `pendingEditItem` effect → valeur préservée.

Le reset de `evalListId` lors d'un vrai changement de matière par l'utilisateur reste assuré par la ligne :
```ts
setEvalListId(prev => lists.some(l => l.id === prev) ? prev : '')
```
qui s'exécute après le chargement des listes (quand `evalSubject` est non-vide).
