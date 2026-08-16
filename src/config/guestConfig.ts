export const GUEST_EXERCISES = [
  'qcm',
  'worddrop',
  'anagramme',
  'conjugaison-etrangere',
  'maths-calcul',
  'vocabulaire',
]

export const GUEST_MAX_FREE = 3
export const GUEST_MAX_TOTAL = 10

export const GUEST_LIST_IDS: Record<string, string> = {
  'Anglais': '7b304389-7bfd-4e4b-86f0-7c466847b484',
  'Allemand': 'ec76bc58-1afc-45bb-aa86-1726abf1137c',
  'Anglais-conjugaison': '972c9240-e852-4d12-a077-c2126e7124e2',
  'Allemand-conjugaison': '8aa413be-2909-4da2-9752-8e8d5c0ed0cb',
  'Français-conjugaison': '9da5be1c-c0bc-4405-8870-78ab58620d41',
  'Français-dictée': '4dd5cae8-47b6-45e0-b81a-a2d74e51df5f',
}

export const GUEST_CATEGORIES: {
  id: string
  label: string
  language: string | null
  exerciseCategory: 'langues' | 'francais' | 'maths'
  unlockedExercises: string[]
}[] = [
  {
    id: 'allemand',
    label: 'Allemand',
    language: 'Allemand',
    exerciseCategory: 'langues',
    unlockedExercises: ['worddrop', 'qcm', 'anagramme', 'conjugaison-etrangere'],
  },
  {
    id: 'anglais',
    label: 'Anglais',
    language: 'Anglais',
    exerciseCategory: 'langues',
    unlockedExercises: ['worddrop', 'qcm', 'anagramme', 'conjugaison-etrangere'],
  },
  {
    id: 'francais',
    label: 'Français',
    language: 'Français',
    exerciseCategory: 'francais',
    unlockedExercises: ['vocabulaire'],
  },
  {
    id: 'maths',
    label: 'Maths',
    language: null,
    exerciseCategory: 'maths',
    unlockedExercises: ['maths-calcul'],
  },
]
