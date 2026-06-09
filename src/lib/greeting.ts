export interface GreetingContext {
  firstName: string
  hour: number
  daysSinceLastSeen: number
  digoosThisWeek: number
  weekStreak: number
  nextEval?: { topic: string; daysUntil: number }
  isFirstDayOfWeek: boolean
  hasBirthday: boolean
}

export const generateGreeting = (ctx: GreetingContext): string => {
  const { firstName, hour, daysSinceLastSeen, digoosThisWeek,
          weekStreak, nextEval, isFirstDayOfWeek, hasBirthday } = ctx
  const name = firstName || ''

  if (hasBirthday) {
    return `Joyeux anniversaire ${name} ! 🎂 C'est ton grand jour — j'espère qu'il sera aussi bien que ta dernière série d'exercices !`
  }

  if (daysSinceLastSeen >= 5) {
    return `Ça fait ${daysSinceLastSeen} jours qu'on ne s'est pas vus, ${name} ! Content de te retrouver. On reprend ?`
  }

  if (daysSinceLastSeen >= 2) {
    return `Bon retour ${name} ! Tu m'avais manqué. C'est reparti ? 💪`
  }

  if (nextEval && nextEval.daysUntil <= 1) {
    return `${hour < 12 ? 'Bonjour' : 'Salut'} ${name} ! Ton évaluation de ${nextEval.topic} c'est demain. Dernière ligne droite !`
  }

  if (nextEval && nextEval.daysUntil <= 2) {
    return `${hour < 12 ? 'Bonjour' : 'Salut'} ${name} ! Dans 2 jours tu as ${nextEval.topic}. On vise le 6 ?`
  }

  if (digoosThisWeek >= 1000) {
    return `${hour < 12 ? 'Bonjour' : 'Salut'} ${name} ! Quelle semaine — ${digoosThisWeek} Digoos déjà ! Tu es en feu 🔥`
  }

  if (digoosThisWeek >= 100) {
    return `${hour < 12 ? 'Bonjour' : 'Salut'} ${name} ! Belle semaine jusqu'ici avec ${digoosThisWeek} Digoos. Continue !`
  }

  if (isFirstDayOfWeek) {
    return `Bonne semaine ${name} ! C'est parti pour une nouvelle série d'exercices 📅`
  }

  if (weekStreak >= 5) {
    return `${hour < 12 ? 'Bonjour' : 'Salut'} ${name} ! ${weekStreak} semaines actives de suite — bravo pour ta régularité, c'est la clé ! 🏆`
  }

  if (hour >= 20) {
    return `Bonsoir ${name} ! Une petite session avant de dormir, et après dodo. Le cerveau consolide pendant la nuit 🌙`
  }

  if (hour < 12) {
    return `Bonjour ${name} ! Prêt·e pour une bonne session de travail ? 📚`
  }

  if (hour < 18) {
    return `Salut ${name} ! Bonne après-midi — on révise un peu ? 🎯`
  }

  return `Bonsoir ${name} ! Une dernière session avant de se détendre ? 😊`
}
