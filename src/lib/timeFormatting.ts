export type TimeExpression = {
  text: string
  words: string[]
}

// ─── French ──────────────────────────────────────────────────────────────────
// hour 1 → "une heure" (feminine agreement with "heure")
const HOURS_FR = ['', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze']
// cardinal numbers for minutes (complement 1-29); minute 1 → "un" (masculine, no gender in compressed form)
const NUMS_FR = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit',
  'dix-neuf', 'vingt', 'vingt et un', 'vingt-deux', 'vingt-trois', 'vingt-quatre',
  'vingt-cinq', 'vingt-six', 'vingt-sept', 'vingt-huit', 'vingt-neuf',
]

function hourLabelFR(h: number): string {
  return `${HOURS_FR[h]} heure${h === 1 ? '' : 's'}`
}

export function formatTimeFR(hour: number, minute: number): TimeExpression {
  const nextHour = hour === 12 ? 1 : hour + 1
  const h = hourLabelFR(hour)
  const nh = hourLabelFR(nextHour)

  if (minute === 0) return { text: h, words: [h] }
  if (minute === 15) return { text: `${h} et quart`, words: [h, 'et quart'] }
  if (minute === 30) return { text: `${h} et demie`, words: [h, 'et demie'] }
  if (minute === 45) return { text: `${nh} moins le quart`, words: [nh, 'moins', 'le quart'] }
  if (minute < 30) {
    const m = NUMS_FR[minute]
    return { text: `${h} ${m}`, words: [h, m] }
  }
  // minute 31-59 hors 45 : heure suivante moins le complément
  const m = NUMS_FR[60 - minute]
  return { text: `${nh} moins ${m}`, words: [nh, 'moins', m] }
}

// ─── English ─────────────────────────────────────────────────────────────────
const HOURS_EN = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const NUMS_EN = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four',
  'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine',
]

export function formatTimeEN(hour: number, minute: number): TimeExpression {
  const nextHour = hour === 12 ? 1 : hour + 1
  const h = HOURS_EN[hour]
  const nh = HOURS_EN[nextHour]

  if (minute === 0) return { text: `${h} o'clock`, words: [h, "o'clock"] }
  if (minute === 15) return { text: `quarter past ${h}`, words: ['quarter', 'past', h] }
  if (minute === 30) return { text: `half past ${h}`, words: ['half past', h] }
  if (minute === 45) return { text: `quarter to ${nh}`, words: ['quarter', 'to', nh] }
  if (minute < 30) {
    const m = NUMS_EN[minute]
    return { text: `${m} past ${h}`, words: [m, 'past', h] }
  }
  const m = NUMS_EN[60 - minute]
  return { text: `${m} to ${nh}`, words: [m, 'to', nh] }
}

// ─── German ──────────────────────────────────────────────────────────────────
// "ein Uhr" (before "Uhr") vs "eins" (standalone in all other positions)
const HOURS_DE_UHR = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf']
const HOURS_DE     = ['', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf']
const NUMS_DE = [
  '', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn',
  'neunzehn', 'zwanzig', 'einundzwanzig', 'zweiundzwanzig', 'dreiundzwanzig', 'vierundzwanzig',
  'fünfundzwanzig', 'sechsundzwanzig', 'siebenundzwanzig', 'achtundzwanzig', 'neunundzwanzig',
]

export function formatTimeDE(hour: number, minute: number): TimeExpression {
  const nextHour = hour === 12 ? 1 : hour + 1
  const hUhr = HOURS_DE_UHR[hour] // "ein" (used only before Uhr)
  const h    = HOURS_DE[hour]     // "eins" (used in nach/vor)
  const nh   = HOURS_DE[nextHour] // next hour standalone (halb, viertel vor, vor)

  if (minute === 0) return { text: `${hUhr} Uhr`, words: [hUhr, 'Uhr'] }
  // "halb vier" = 3h30 : NEXT hour, not current — critical German rule
  if (minute === 30) return { text: `halb ${nh}`, words: ['halb', nh] }
  if (minute === 15) return { text: `viertel nach ${h}`, words: ['viertel', 'nach', h] }
  if (minute === 45) return { text: `viertel vor ${nh}`, words: ['viertel', 'vor', nh] }
  if (minute < 30) {
    const m = NUMS_DE[minute]
    return { text: `${m} nach ${h}`, words: [m, 'nach', h] }
  }
  const m = NUMS_DE[60 - minute]
  return { text: `${m} vor ${nh}`, words: [m, 'vor', nh] }
}

// ─── Greek ───────────────────────────────────────────────────────────────────
// Hours 1-4 use feminine forms (agreement with "ώρα"), 5-12 use standard form
const HOURS_EL = ['', 'μία', 'δύο', 'τρεις', 'τέσσερις', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα', 'δέκα', 'έντεκα', 'δώδεκα']
// Minute numbers use neuter cardinal forms
const NUMS_EL = [
  '', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα', 'δέκα',
  'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεπτά', 'δεκαοκτώ',
  'δεκαεννέα', 'είκοσι', 'είκοσι ένα', 'είκοσι δύο', 'είκοσι τρία', 'είκοσι τέσσερα',
  'είκοσι πέντε', 'είκοσι έξι', 'είκοσι επτά', 'είκοσι οκτώ', 'είκοσι εννέα',
]

export function formatTimeEL(hour: number, minute: number): TimeExpression {
  const nextHour = hour === 12 ? 1 : hour + 1
  const h  = HOURS_EL[hour]     // current hour (feminine form for 1-4)
  const nh = HOURS_EL[nextHour] // next hour (feminine form for 1-4)

  if (minute === 0) return { text: `${h} η ώρα`, words: [h, 'η ώρα'] }
  if (minute === 15) return { text: `${h} και τέταρτο`, words: [h, 'και', 'τέταρτο'] }
  if (minute === 30) return { text: `${h} και μισή`, words: [h, 'και', 'μισή'] }
  if (minute === 45) return { text: `${nh} παρά τέταρτο`, words: [nh, 'παρά', 'τέταρτο'] }
  if (minute < 30) {
    const m = NUMS_EL[minute]
    return { text: `${h} και ${m}`, words: [h, 'και', m] }
  }
  const m = NUMS_EL[60 - minute]
  return { text: `${nh} παρά ${m}`, words: [nh, 'παρά', m] }
}
