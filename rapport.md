# Rapport — Investigation : sélecteur de liste dans le formulaire d'évaluation

> Tâche : read-only. Aucun fichier modifié.

---

## 1. Requête exacte (identique dans PlannerList.tsx:161-164 et CalendarCreateModal.tsx:65-68)

```ts
const { data } = await supabase.from('word_lists')
  .select('id, name, list_type')
  .eq('user_id', userId)
  .eq('subject_id', evalSubject)   // ← seul filtre de sélection
  .order('name')
```

**Filtre : `subject_id = evalSubject` uniquement.** Pas de filtre sur `list_type` ni sur `language`.
Le type `'dictée'` n'est pas exclu. Si la liste avait un `subject_id` correspondant à la matière Français, elle apparaîtrait.

---

## 2. Où et quand `subject_id` est écrit sur `word_lists`

Deux points d'écriture :

**SubjectWordlists.tsx:61** — création depuis Matières → Français → Listes de mots :
```ts
subject_id: String(subjectId)   // toujours renseigné, valeur correcte garantie
```

**wordlists.tsx:151** — création depuis la page Listes de mots globale :
```ts
subject_id: langToSubjectId[newListLang] != null ? String(langToSubjectId[newListLang]) : null
```
Renseigné si `language = 'Français'` figure dans `LANGUAGES` (oui, ligne 30) **ET** qu'un subject `name = 'Français'` existe dans la table `subjects`. La map `langToSubjectId` est construite par :
```ts
supabase.from('subjects').select('id, name').in('name', LANGUAGES)
// LANGUAGES = ['Anglais', 'Allemand', 'Grec', 'Espagnol', 'Arabe', 'Italien', 'Français']
```

Ces deux chemins n'existaient pas avant le commit `c0b7b59`. Toute liste créée avant ce commit a `subject_id = NULL`.

---

## 3. Deux scénarios possibles

| Scénario | Cause | Symptôme visible |
|---|---|---|
| A — Migration **non appliquée** | Colonne `subject_id` absente en base → requête PostgREST en erreur → `data = null` → `listsForSubject = []` | Le sélecteur n'apparaît **jamais** pour aucune matière |
| B — Migration **appliquée**, liste créée avant `c0b7b59` | `subject_id = NULL` sur "Première dictée en français" → ne correspond pas au filtre `.eq('subject_id', evalSubject)` | Le sélecteur peut apparaître pour d'autres listes récentes, mais pas pour cette liste-ci |

---

## 4. Conclusion

Le filtre lui-même **n'est pas trop restrictif** — il ne discrimine ni `list_type` ni `language`.

Le problème est dans les données :

- **Scénario A** (migration non appliquée) : appliquer la migration SQL en priorité, puis vérifier.
  ```sql
  ALTER TABLE word_lists ADD COLUMN IF NOT EXISTS subject_id TEXT;
  -- + GRANT + RLS policy si nécessaire
  ```

- **Scénario B** (liste créée avant le fix) : mettre à jour `subject_id` sur les listes existantes via l'UI (si un champ de réassignation existe) ou via SQL :
  ```sql
  -- Exemple : retrouver l'id du subject 'Français' et l'affecter
  UPDATE word_lists
  SET subject_id = (SELECT id FROM subjects WHERE name = 'Français' LIMIT 1)::text
  WHERE language = 'Français' AND subject_id IS NULL;
  ```

**Pour distinguer les deux** : si le sélecteur apparaît pour une matière ayant une liste créée récemment (après `c0b7b59`) → scénario B. Si le sélecteur n'apparaît jamais → scénario A.
