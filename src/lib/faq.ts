export interface FAQItem {
  id: string
  tags: string[]
  question: string
  answer: string
  audience: 'child' | 'parent' | 'both'
}

export const FAQ: FAQItem[] = [
  {
    id: 'parents_voir',
    audience: 'child',
    tags: ['parents', 'voir', 'voient', 'accès', 'surveillance'],
    question: 'Que peuvent voir mes parents ?',
    answer: `Tes parents peuvent voir ton tableau de bord, ton planificateur (évaluations, révisions, événements, rappels), tes listes de mots et tes matières. Ils peuvent aussi voir combien de Δ tu as gagnés cette semaine et ton niveau d'activité général. C'est fait pour qu'ils puissent t'aider à t'organiser, t'encourager et célébrer tes progrès avec toi — pas pour te surveiller !`
  },
  {
    id: 'parents_pas_voir',
    audience: 'child',
    tags: ['parents', 'pas voir', 'privé', 'secret', 'cachent'],
    question: 'Que ne peuvent-ils pas voir ?',
    answer: `Tes parents ne peuvent pas voir le détail de tes conversations avec Odigo. Tes notes personnelles dans les matières leur sont également invisibles. Ton espace de travail reste le tien.`
  },
  {
    id: 'odigo_prive',
    audience: 'child',
    tags: ['odigo', 'discussion', 'conversation', 'chat', 'privé', 'parents lisent'],
    question: 'Mes parents peuvent-ils lire mes discussions avec Odigo ?',
    answer: `Non. Tes conversations avec Odigo sont privées. Tes parents peuvent voir que tu utilises ODIGO et combien de Δ tu gagnes, mais pas ce que tu dis à Odigo. Tu peux lui parler librement !`
  },
  {
    id: 'digoos_fonctionnement',
    audience: 'child',
    tags: ['digoos', 'delta', 'monnaie', 'fonctionnent', 'c\'est quoi'],
    question: 'Comment fonctionnent les Δ ?',
    answer: `Les Δ sont la monnaie d'ODIGO. Tu en gagnes en faisant des exercices, en utilisant le planificateur, et en ayant des jours, semaines et mois actifs. Tu peux les dépenser dans la Boutique pour personnaliser ton espace, jouer à des jeux, ou obtenir des récompenses créées par tes parents.`
  },
  {
    id: 'digoos_gagner',
    audience: 'child',
    tags: ['gagner', 'digoos', 'delta', 'comment', 'obtenir'],
    question: 'Comment gagner des Δ ?',
    answer: `Tu gagnes des Δ en faisant des exercices (les 10 premiers de la journée rapportent 100%, du 11e au 20e c'est 80%, et à partir du 21e c'est 60%), en ajoutant des entrées dans ton planificateur, en cochant des révisions comme faites, et en réclamant tes récompenses de jours, semaines et mois actifs dans l'onglet Progrès. Tout est expliqué en détail dans la page Récompenses, onglet "Comment ça marche".`
  },
  {
    id: 'digoos_depenser',
    audience: 'child',
    tags: ['dépenser', 'digoos', 'delta', 'acheter', 'boutique'],
    question: 'Comment dépenser mes Δ ?',
    answer: `Va dans la page Récompenses, onglet Boutique. Tu y trouveras les récompenses créées par tes parents (cinéma, sorties, cadeaux...), et Digooland où tu peux acheter des thèmes de couleur, des titres, et jouer à des jeux comme le Jeu des allumettes ou l'Histoire interactive.`
  },
  {
    id: 'jour_actif',
    audience: 'child',
    tags: ['jour actif', 'jour', 'actif', 'compte', 'journée'],
    question: 'Comment fonctionne un jour actif ?',
    answer: `Un jour est actif si tu fais au moins 1 exercice ou 1 action dans le planificateur dans la journée. Un jour actif te rapporte 10 Δ à réclamer dans l'onglet Progrès et récompenses.`
  },
  {
    id: 'semaine_active',
    audience: 'child',
    tags: ['semaine active', 'semaine', 'active', 'conditions'],
    question: 'Comment fonctionne une semaine active ?',
    answer: `Une semaine est active si tu remplis 3 conditions : gagner au moins 300 Δ dans la semaine, avoir au moins 3 jours actifs, et ajouter au moins une entrée dans le planificateur. Une semaine active te rapporte 50 Δ à réclamer dans l'onglet Progrès et récompenses.`
  },
  {
    id: 'mois_actif',
    audience: 'child',
    tags: ['mois actif', 'mois', 'actif', 'conditions'],
    question: 'Comment fonctionne un mois actif ?',
    answer: `Un mois est actif si tu remplis 3 conditions : avoir au moins 15 jours actifs dans le mois, avoir au moins 2 semaines actives, et compléter au moins 15 exercices. Un mois actif te rapporte 200 Δ à réclamer dans l'onglet Progrès et récompenses.`
  },
  {
    id: 'odigo_aide',
    audience: 'child',
    tags: ['odigo', 'aide', 'faire', 'utilité', 'questions'],
    question: 'Qu\'est-ce qu\'Odigo peut faire pour moi ?',
    answer: `Odigo est ton compagnon d'apprentissage. Tu peux lui poser des questions sur le fonctionnement d'ODIGO, lui parler de tes évaluations à venir, ou simplement discuter. Il connaît ton planning et peut t'encourager ou te rappeler des choses importantes. Il ne juge jamais et est toujours là pour t'aider.`
  },
  {
    id: 'planificateur_enfant',
    audience: 'child',
    tags: ['planificateur', 'modifier', 'éditer', 'changer', 'parents'],
    question: 'Que puis-je modifier dans le planificateur ?',
    answer: `Tu peux ajouter, modifier et supprimer toutes tes entrées (évaluations, révisions, événements, rappels). Tu peux aussi cocher tes révisions comme faites, et saisir ta note obtenue après une évaluation. Ton planificateur t'appartient — tes parents peuvent y contribuer pour t'aider, mais c'est toi qui l'utilises au quotidien.`
  },
  {
    id: 'notes_parents',
    audience: 'child',
    tags: ['notes', 'parents', 'voient', 'visibles', 'cours'],
    question: 'Mes notes sont-elles visibles par mes parents ?',
    answer: `Tes notes de cours (dans l'onglet Notes de chaque matière) sont privées, tes parents ne les voient pas. En revanche, les notes obtenues à tes évaluations (que tu saisis toi-même dans le planificateur) sont visibles par tes parents — c'est voulu pour qu'ils puissent suivre ta progression.`
  },
  // FAQ PARENTS
  {
    id: 'parent_voir',
    audience: 'parent',
    tags: ['voir', 'accès', 'enfant', 'activité', 'données'],
    question: 'Que puis-je voir de l\'activité de mon enfant ?',
    answer: `En mode parent, vous accédez au tableau de bord de votre enfant : son planning (évaluations, révisions, événements, rappels), ses listes de mots, ses matières et notes d'évaluation, son solde de Δ et son niveau d'activité hebdomadaire. Vous pouvez aussi voir ses récompenses en attente d'utilisation.`
  },
  {
    id: 'parent_pas_voir',
    audience: 'parent',
    tags: ['pas voir', 'privé', 'conversations', 'odigo', 'notes'],
    question: 'Que ne puis-je pas voir ?',
    answer: `Vous ne pouvez pas lire les conversations de votre enfant avec Odigo. Ses notes personnelles de cours (dans les matières) vous sont également inaccessibles. ODIGO respecte l'espace personnel de l'enfant tout en vous donnant les informations essentielles pour l'accompagner.`
  },
  {
    id: 'parent_planificateur',
    audience: 'parent',
    tags: ['planificateur', 'modifier', 'éditer', 'accès', 'enfant'],
    question: 'Que puis-je modifier dans le planificateur de mon enfant ?',
    answer: `En mode vue enfant, vous pouvez ajouter, modifier et supprimer des évaluations, des révisions, des événements et des rappels. Vous pouvez aussi saisir ou modifier la note attendue et la note obtenue sur une évaluation. En revanche, vous ne pouvez pas cocher une révision comme "faite" à la place de votre enfant — cette action reste réservée à l'enfant, car c'est lui qui doit valider son propre travail.`
  },
  {
    id: 'parent_lier',
    audience: 'parent',
    tags: ['lier', 'compte', 'enfant', 'code', 'invitation', 'connecter'],
    question: 'Comment lier mon compte à celui de mon enfant ?',
    answer: `Dans votre espace parent, cliquez sur "Générer un code d'invitation". Transmettez ce code à votre enfant. Lors de sa connexion, il entre ce code dans ses Paramètres pour lier les deux comptes. Vous pouvez lier jusqu'à 5 enfants.`
  },
  {
    id: 'parent_listes',
    audience: 'parent',
    tags: ['listes', 'mots', 'modifier', 'créer', 'vocabulaire'],
    question: 'Puis-je modifier les listes de mots de mon enfant ?',
    answer: `Oui. En mode vue enfant, accédez à la page Listes de mots. Vous pouvez créer de nouvelles listes, modifier les mots existants, supprimer des listes, et même importer des mots depuis une image. C'est particulièrement utile pour préparer les révisions de vocabulaire.`
  },
  {
    id: 'parent_recompenses',
    audience: 'parent',
    tags: ['récompenses', 'IRL', 'créer', 'ajouter', 'boutique'],
    question: 'Comment créer des récompenses IRL ?',
    answer: `Dans votre espace parent, section "Récompenses IRL", cliquez sur "+ Ajouter une récompense". Donnez-lui un nom (ex: "Soirée cinéma"), un coût en Δ, une description optionnelle, une quantité disponible et une date de validité si besoin. Une fois créée, elle apparaît automatiquement dans la Boutique de votre enfant. Conseil : commencez par des petites récompenses accessibles pour calibrer le système. Un enfant motivé peut gagner des Δ plus vite qu'on ne le pense — mieux vaut ajuster progressivement plutôt que de fixer des prix qui décourageraient.`
  },
  {
    id: 'parent_digoos',
    audience: 'parent',
    tags: ['digoos', 'delta', 'système', 'fonctionne', 'monnaie'],
    question: 'Comment fonctionne le système de Δ ?',
    answer: `Les Δ sont la monnaie d'ODIGO qui récompense la régularité. Votre enfant en gagne en faisant des exercices (avec un système dégressif pour éviter l'accumulation en une seule journée), en utilisant le planificateur, et en atteignant des objectifs hebdomadaires et mensuels. Il peut les dépenser dans la Boutique ou pour obtenir les récompenses IRL que vous avez créées.`
  },
]

// Fonction de recherche FAQ
export const findFAQ = (
  query: string,
  audience: 'child' | 'parent'
): FAQItem | null => {
  const q = query.toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')

  return FAQ.find(item =>
    (item.audience === audience || item.audience === 'both') &&
    item.tags.some(tag =>
      q.includes(tag.normalize('NFD')
        .replace(/\p{Diacritic}/gu, ''))
    )
  ) || null
}
