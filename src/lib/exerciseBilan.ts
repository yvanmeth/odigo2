export type Difficulty = 'facile' | 'moyen' | 'difficile'

export type RecapItem = {
  label: string
  correct: boolean
  detail?: string
}

export const DAILY_CAP = 2000
export const DAILY_CAP_COEFF = 0.2

export interface BilanCalcInput {
  errors: number
  difficulty: Difficulty
  hasRevisionBonus: boolean
  dailySumBefore: number
  blocksPerfect?: boolean
}

export interface BilanCalcResult {
  stars: number
  isPerfect: boolean
  bonusStars: number
  bonusPerfect: number
  bonusRevision: number
  baseDigoos: number
  coefficient: number
  rawTotal: number
  total: number
  dailyCapApplied: boolean
}

export const calcBilan = (input: BilanCalcInput): BilanCalcResult => {
  const { errors, difficulty, hasRevisionBonus, dailySumBefore, blocksPerfect } = input

  const stars = errors > 8 ? 0 : errors >= 6 ? 1 : errors >= 3 ? 2 : 3
  const isPerfect = errors === 0 && !blocksPerfect
  const bonusStars = stars * 10
  const bonusPerfect = isPerfect ? 10 : 0
  const bonusRevision = hasRevisionBonus ? 5 : 0
  const baseDigoos = 5 + bonusStars + bonusPerfect + bonusRevision
  const coefficient = difficulty === 'facile' ? 0.8 : difficulty === 'difficile' ? 1.2 : 1.0
  const rawTotal = Math.ceil(baseDigoos * coefficient)
  const dailyCapApplied = dailySumBefore > DAILY_CAP
  const total = dailyCapApplied ? Math.ceil(rawTotal * DAILY_CAP_COEFF) : rawTotal

  return {
    stars, isPerfect,
    bonusStars, bonusPerfect, bonusRevision,
    baseDigoos, coefficient, rawTotal, total, dailyCapApplied,
  }
}

export const EXERCISE_LABELS: Record<string, string> = {
  maths: 'Maths',
  anagramme: 'Anagramme',
  'anagramme-francais': 'Anagramme français',
  conjugaison: 'Conjugaison',
  vocabulaire: 'Dictée',
  'conjugaison-etrangere': 'Conjugaison étrangère',
  qcm: 'QCM',
  spelling: 'Épellation',
  worddrop: 'Word Drop',
  flashcards: 'Flashcards',
  'puzzle-phrases': 'Puzzle Phrases',
  'defi-parents': 'Défi Parents',
  'histoire-geo': 'Histoire & Géo',
  'carte-suisse': 'Carte de la Suisse',
  'lire-heure': 'Lire l\'heure',
}
