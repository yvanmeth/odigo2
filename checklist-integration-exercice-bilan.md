# Checklist — Intégration d'un exercice au chantier Bilan/Δ

Document de référence pour intégrer `ExerciseBilan` dans un nouvel exercice. Basé sur les 4 intégrations déjà réalisées (Maths, Anagramme, AnagrammeFrancais, Vocabulaire) et tous les pièges rencontrés.

**Méthode recommandée** : toujours commencer par une commande d'investigation (lecture seule) avant toute commande de modification. Chaque point ci-dessous doit avoir une réponse connue avant de cadrer la commande d'intégration.

---

## 1. Nombre de questions

- [ ] L'exercice est-il déjà à 10 questions fixes ?
- [ ] Sinon, un sélecteur existe-t-il (5/8/10/15, 3/5/10, etc.) ? → **à retirer complètement**, toujours 10.
- [ ] Cas des listes de mots < 10 mots : chaque mot doit être utilisé au moins une fois, complément aléatoire pour atteindre 10 (règle validée pour tout exercice basé sur une liste).
- [ ] Cas des mécanismes à volume variable (ex: Flashcards "toute la liste") : nécessite une vraie refonte, pas un simple changement de constante — à traiter en dernier, cas par cas.

## 2. Calcul des erreurs

- [ ] Identifier le mécanisme actuel de détection d'une bonne/mauvaise réponse (comparaison exacte, essais multiples, streak interne...).
- [ ] `errors = 10 - (bonnes réponses au PREMIER passage)`.
- [ ] **Re-queue (mots/items ratés qui reviennent en fin de partie)** : mécanisme pédagogique à CONSERVER, mais sans impact sur le calcul d'erreurs. Utiliser un tracking "premier passage uniquement" (pattern déjà en place : un `Set`/tableau qui n'enregistre qu'une fois par item, cf. `motsVus` dans vocabulaire.tsx).
- [ ] Les indices/aides utilisés (traduction, lettre, écoute du mot, etc.) ne comptent JAMAIS comme une erreur — vérifier qu'ils n'affectent aucun `results`/`attempts`.

## 3. Suppression de l'ancien système de récompense

- [ ] Retirer tout appel à `addDigoos()` dans le fichier — `ExerciseBilan` s'en charge en interne.
- [ ] Retirer les states de score/Δ maison (`earnedDigoos`, `digoosEarned`, bonus streak `+5 si≥5`, etc.).
- [ ] Retirer tout affichage résiduel de score interne obsolète ("X pts", "+N Δ") qui ferait doublon avec `ExerciseBilan`.
- [ ] Garder `logActivity` (action_type: 'exercise_completed') — indépendant du système Bilan, à conserver tel quel.
- [ ] Garder `checkHighscore`/`HighscoreModal` s'il existe — indépendant des Δ (voir point 5).

## 4. Difficulté

- [ ] Un système de difficulté existe-t-il déjà (facile/moyen/difficile) ?
- [ ] Si oui, correspond-il à un critère réutilisable tel quel ? (ex: `Dire l'heure` : pile/quart/libre = facile/moyen/difficile)
- [ ] Si non, l'exercice a-t-il vraiment besoin d'un niveau de difficulté, ou reste-t-il fixe à "moyen" (×1) ? **Ne pas inventer un niveau artificiel si aucun critère naturel n'existe** (cf. décision prise pour Vocabulaire : pas de difficulté, coefficient toujours ×1).
- [ ] Si un critère naturel existe (ex: longueur des mots pour un exercice de langue), le niveau facile peut inclure une aide automatique (ex: 1ère lettre pré-placée) — cohérent avec "les indices ne comptent jamais comme erreur".
- [ ] `nbQ` (nombre de questions) ne doit JAMAIS servir de proxy de difficulté — ce sélecteur disparaît (point 1).

## 5. HighscoreModal — ordre d'affichage

- [ ] L'exercice utilise-t-il `HighscoreModal` ?
- [ ] Si oui, appliquer systématiquement le correctif d'ordre :
  - `finaliser()` appelle `setGameState('result')` IMMÉDIATEMENT (Bilan visible sans délai).
  - `logActivity` et `checkHighscore` en `Promise.all` (non bloquant, en parallèle).
  - Nouvel état `GameState` `'highscore'` : `HighscoreModal` s'affiche APRÈS le Bilan, jamais avant ni en superposition sur l'écran de jeu.
  - `ExerciseBilan.onDone` redirige vers `'highscore'` si `showHighscore`, sinon vers `'select'`.
  - **Raison** : sans ce correctif, les boutons "Rejouer"/"Quitter" de HighscoreModal court-circuitent l'affichage du Bilan et donc l'attribution des Δ.

## 6. Bonus Révision (exercices basés sur une liste de mots)

- [ ] L'exercice utilise-t-il une liste de mots (`word_lists`/`word_items`) ?
- [ ] Si oui : appeler `hasRevisionBonusForList(selectedListId)` (service déjà prêt : `src/services/revisionBonus.ts`) au démarrage de la partie, stocker en state, passer à `ExerciseBilan`.
- [ ] Passer aussi `listName` (nom de la liste, généralement déjà calculé ailleurs dans le fichier pour l'affichage) — sert à la fois au Bilan et à l'historique parent.
- [ ] Si l'exercice n'est pas basé sur une liste (ex: Maths, Dire l'heure) : ne pas passer `hasRevisionBonus` (reste `false` par défaut).

## 7. Récapitulatif détaillé (si l'exercice en a un)

- [ ] Si un écran de fin affiche déjà un récapitulatif détaillé (ex: phrases à trous avec réponses, liste mot par mot) : le CONSERVER, affiché SOUS le composant `ExerciseBilan` (pas remplacé par lui).
- [ ] Retirer de ce récapitulatif toute info redondante avec ce qu'affiche déjà `ExerciseBilan` (score, pourcentage, Δ gagnés) — ne garder que le détail propre à cet exercice.

## 8. Barre de progression

- [ ] Vérifier la formule : doit être `(index_courant + 1) / total`, JAMAIS `index_courant / total` — sinon la barre reste incomplète à la dernière question (bug rencontré sur Maths et Anagramme).

## 9. Props à passer à `ExerciseBilan`

```tsx
<ExerciseBilan
  exercise="identifiant_technique"     // cohérent avec EXERCISE_LABELS (lib/exerciseBilan.ts)
  errors={10 - correctCount}
  difficulty={difficulty}               // ou "moyen" fixe si pas de niveau (point 4)
  hasRevisionBonus={hasRevisionBonus}   // si liste de mots (point 6)
  listName={listName}                   // si liste de mots (point 6)
  subLabel={sousMode}                   // optionnel — si l'exercice a des sous-modes (ex: Maths "Multiplications")
  onDone={() => {
    if (showHighscore) setGameState('highscore')
    else { setGameState('select'); /* reset des states de partie */ }
  }}
/>
```

- [ ] Vérifier/ajouter l'entrée correspondante dans `EXERCISE_LABELS` (`src/lib/exerciseBilan.ts`) si absente.

## 10. UX complémentaire (à vérifier systématiquement)

- [ ] Focus automatique du champ de saisie à chaque nouvelle question (si applicable) — pattern déjà en place dans `spelling.tsx`, à répliquer si l'exercice a un champ texte.
- [ ] Touche Entrée pour valider une réponse ET pour passer à la question suivante après feedback (deux usages distincts d'Entrée à ne pas faire entrer en conflit).

## 11. Tests avant commit

- [ ] Partie avec quelques erreurs → vérifier le compteur d'erreurs et les étoiles obtenues.
- [ ] Partie parfaite → animation dorée, bonus perfect dans le détail du calcul.
- [ ] Difficulté (si applicable) → coefficient correct affiché (sous-total avant/après coefficient).
- [ ] Bonus Révision (si liste de mots) → test positif (évaluation future liée) ET contre-test (pas d'évaluation liée, ou évaluation passée).
- [ ] HighscoreModal (si présent) → bilan d'abord, highscore ensuite, tous les boutons fonctionnels sans court-circuiter l'attribution des Δ.
- [ ] Re-queue (si présente) → mot raté revient bien en fin de partie, mais le compteur d'erreurs reste basé sur le premier passage.
- [ ] Barre de progression pleine à la dernière question.
- [ ] Vérifier dans l'Historique Δ (compte parent ou pastille Δ) que la transaction apparaît avec le bon libellé.
- [ ] Vérifier dans l'onglet "Exercices" (mode parent) que la ligne apparaît avec les bonnes infos (date, heure, exercice, liste, difficulté, score).

---

## Pièges déjà rencontrés — à ne pas refaire

1. **`void supabase.from(...).insert(...)`** — le client Supabase utilise un pattern "thenable lazy" : le `void` empêche le déclenchement du `.then()` interne, donc la requête HTTP ne part JAMAIS. Toujours utiliser `await`, ou a minima `.then(() => {}, () => {})` si l'objet ne supporte pas `.catch()`.
2. **Timing `useEffect` au montage** : quand deux `useEffect` s'exécutent dans le même batch au premier rendu (ex: un `pendingEditItem` qui pré-remplit un champ + un `useEffect` qui reset ce même champ sur une dépendance vide), l'ordre de déclaration détermine qui gagne — peut écraser silencieusement un pré-remplissage. Vérifier ce cas chaque fois que deux effets touchent le même state.
3. **Deux onglets du navigateur sur deux comptes différents** (parent + session enfant) : le `localStorage` est partagé entre onglets du même navigateur — la session active peut être écrasée par l'autre onglet. Toujours tester avec un seul onglet actif à la fois.
4. **`subject_id`/`list_id` sur les données historiques** : toute nouvelle relation ajoutée entre deux tables existantes (ex: `word_lists.subject_id`, `evaluations.list_id`) ne s'applique qu'aux nouvelles lignes — un backfill explicite est nécessaire si des fonctionnalités doivent aussi couvrir les données existantes.

---

*Document créé le 21.09.2026, à mettre à jour à chaque nouvelle découverte lors des prochaines intégrations.*
