# Rapport — Accord grammatical + page DigoosHistory

## Build

**✅ 0 erreur TypeScript — build réussi**
```
✓ 2129 modules transformed.
✓ built in 1.30s
```

---

## 1. Correction accord grammatical (RewardsProgress.tsx)

Les 3 labels de réclamation utilisent maintenant un accord singulier/pluriel correct :

| Cas | Avant | Après |
|---|---|---|
| 1 jour | `"1 jour(s) actif(s)"` | `"1 jour actif"` |
| N jours | `"3 jour(s) actif(s)"` | `"3 jours actifs"` |
| 1 semaine | `"1 semaine(s) active(s)"` | `"1 semaine active"` |
| N semaines | `"2 semaine(s) active(s)"` | `"2 semaines actives"` |
| 1 mois | `"1 mois actif(s)"` | `"1 mois actif"` |
| N mois | `"3 mois actif(s)"` | `"3 mois actifs"` |

---

## 2. Nouvelle page — src/pages/DigoosHistory.tsx

### Fonctionnement

- Fetch les 20 dernières transactions de `digoos_transactions` pour l'utilisateur courant, triées par `created_at` décroissant.
- Groupes par mois (clé `YYYY-MM`), triés du plus récent au plus ancien.
- Le mois le plus récent est ouvert par défaut ; les autres sont repliés. Clic sur l'en-tête de mois pour déplier/replier.
- Chaque ligne : `"DD.MM à HHhMM"` | label | montant coloré (`+N Δ` en vert, `-N Δ` en rouge).
- Bouton "Voir plus" en bas — charge les 20 lignes suivantes par offset et les ajoute aux groupes existants ou crée de nouveaux groupes de mois.
- État vide : composant `EmptyState` avec emoji 📭.

### Accès

La pastille Δ (fond jaune `#fff8e0`) est maintenant cliquable dans **4 emplacements** :

| Emplacement | Fichier modifié |
|---|---|
| Sidebar desktop — mode étendu (pastille sous l'avatar) | `Sidebar.tsx` |
| Sidebar desktop — mode réduit (nombre Δ compact) | `Sidebar.tsx` |
| Sidebar mobile — panneau latéral (pastille sous l'avatar) | `Sidebar.tsx` |
| Barre supérieure mobile (coin droit) | `dashboard/index.tsx` |

### Routage (dashboard/index.tsx)

- Import de `DigoosHistory` ajouté.
- `activePage === 'digoos-history'` → rendu de `<DigoosHistory />`.
- Titre `<h1>` : `"Historique Δ"` pour cette page.
- Page ajoutée à la liste d'exclusion du fallback `"Contenu à venir..."`.
- Pas d'entrée dans `navItems` ni dans `exerciseCards` — accès uniquement via la pastille Δ.

---

## 3. Résultat lint

### DigoosHistory.tsx — 0 erreur, 0 warning ✅

### Autres fichiers — erreurs préexistantes uniquement

Les erreurs remontées pour `Sidebar.tsx`, `dashboard/index.tsx` et `RewardsProgress.tsx` sont **toutes préexistantes** dans le projet (non introduites par ce diff) :

| Fichier | Erreur | Préexistante ? |
|---|---|---|
| `Sidebar.tsx:214,333` | `no-extra-boolean-cast` (double négation `!!`) | ✅ Oui |
| `dashboard/index.tsx` | `react-hooks/immutability`, `no-explicit-any`, `exhaustive-deps` | ✅ Oui |
| `RewardsProgress.tsx` | `react-hooks/immutability` (`fetchActivityData` avant déclaration) | ✅ Oui |

Ces patterns sont documentés dans CLAUDE.md comme acceptés dans ce projet (`react-hooks/set-state-in-effect`, `react-hooks/immutability`).

---

## 4. Ce qui reste nécessaire avant que la page affiche des données

La table `digoos_transactions` doit être créée sur Supabase (SQL fourni dans le rapport précédent) :

```sql
CREATE TABLE digoos_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount      integer NOT NULL,
  balance_after integer NOT NULL,
  source      text NOT NULL,
  label       text NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE digoos_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON digoos_transactions TO authenticated;

CREATE POLICY "user_own" ON digoos_transactions
  FOR ALL USING (user_id = auth.uid());
```

Sans cette table, la page affichera l'état vide (EmptyState) et les inserts dans `addDigoos`/`deductDigoos` échoueront silencieusement.
