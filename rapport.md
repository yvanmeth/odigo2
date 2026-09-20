# Rapport — Correction bug ExerciseBilan + audit `void supabase.*`

---

## 1. Correction appliquée

**Fichier modifié** : `src/components/ExerciseBilan.tsx` ligne 180

### Avant (bug)
```ts
void supabase.from('exercise_results').insert({
  user_id: uid,
  exercise,
  errors,
  stars: bilan.stars,
  is_perfect: bilan.isPerfect,
  difficulty,
  digoos_earned: bilan.total,
  list_name: listName ?? null,
})
```

### Après (fix)
```ts
supabase.from('exercise_results').insert({
  user_id: uid,
  exercise,
  errors,
  stars: bilan.stars,
  is_perfect: bilan.isPerfect,
  difficulty,
  digoos_earned: bilan.total,
  list_name: listName ?? null,
}).then(() => {}, () => {})
```

### Pourquoi `.then(() => {}, () => {})` et pas `.catch(() => {})`

`PostgrestFilterBuilder` (le type retourné par `.insert()`) n'expose pas de méthode `.catch()` — TypeScript refusait la compilation avec :
```
error TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder<...>'. Did you mean 'match'?
```

Il implémente `PromiseLike<T>` (uniquement `.then()`), pas `Promise<T>`.
`.then(() => {}, () => {})` — deux no-ops pour onfulfilled et onrejected — est syntaxiquement correct, déclenche le fetch HTTP (confirmé dans le source de `@supabase/postgrest-js` : le fetch est initié à l'intérieur de `then()`), et ignore silencieusement les erreurs.

---

## 2. Audit : autres appels `void supabase.*` dans le projet

Recherche exhaustive (`grep -rn "void supabase\." src/`) :

**Résultat : aucun autre `void supabase.*` trouvé.**

Le bug était isolé à ExerciseBilan.tsx.

---

## 3. Audit élargi : appels Supabase sans `await` ni `.then()`/`.catch()`

Toutes les autres occurrences de `.insert()`, `.update()`, `.upsert()`, `.delete()` dans `src/` utilisent **`await`** :

| Fichier | Pattern | Statut |
|---|---|---|
| `services/digoos.ts` | `await supabase.from('progress').update(...)` etc. | ✅ |
| `services/activity.ts` | `await supabase.from('daily_activity').insert(...)` | ✅ |
| `pages/wordlists.tsx` | `await supabase.from('word_items').insert(...)` etc. | ✅ |
| `pages/settings.tsx` | `await supabase.from('profiles').upsert(...)` etc. | ✅ |
| `pages/planner/PlannerList.tsx` | `await supabase.from('evaluations').insert(...)` etc. | ✅ |
| `pages/planner/CalendarCreateModal.tsx` | `await supabase.from('events').insert(...)` etc. | ✅ |
| `pages/rewards/*.tsx` | `await supabase.from('progress').update(...)` etc. | ✅ |
| `pages/subjects/*.tsx` | `await supabase.from('notes').insert(...)` etc. | ✅ |
| `pages/parent/*.tsx` | `await supabase.from('missions').update(...)` etc. | ✅ |
| `pages/dashboard/index.tsx` | `await supabase.from('profiles').upsert(...)` etc. | ✅ |

**Aucun autre appel en souffrance identifié.**

---

## 4. Build et lint

| Commande | Résultat |
|---|---|
| `npm run build` | ✅ Succès — 2133 modules transformés, aucune erreur TypeScript |
| `npm run lint` | ✅ Aucune erreur nouvelle — les erreurs existantes (`react-hooks/immutability`, `react-hooks/set-state-in-effect`, etc.) sont toutes pré-existantes et sans rapport avec cette modification |

**ExerciseBilan.tsx : zéro erreur lint.**
