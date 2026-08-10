export interface SubjectItem {
  id: number | string
  name: string
  emoji: string
  color: string
  isCustom: boolean
  hidden: boolean
  position: number
}

export interface Note {
  id: string
  user_id: string
  subject_id: number | string
  title: string
  content: string
  archived: boolean
  archive_folder: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface Postit {
  id: string
  user_id: string
  subject_id: number | string
  content: string
  color: 'yellow' | 'green' | 'pink' | 'blue'
  size: 'small' | 'square' | 'large'
  icon: string | null
  pinned: boolean
  archived: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface WordListItem {
  id: string
  user_id: string
  language: string
  name: string
  list_type: string
  created_at: string
}

export interface WordEntry {
  id: string
  list_id: string
  source_word: string
  target_word: string | null
  context?: string | null
  created_at: string
}

export type SubjectTab = 'evals' | 'notes' | 'postits' | 'wordlists'

export const COLOR_PALETTE = [
  '#2a9d8f', '#e9c46a', '#e76f51', '#e63946',
  '#4CAF50', '#5c6bc0', '#e07a9b', '#795548',
  '#00BCD4', '#9C27B0',
]

export const FIXED_SUBJECTS = [
  { id: 1, name: 'Français',  emoji: '📖', color: '#4CAF50' },
  { id: 2, name: 'Maths',     emoji: '🔢', color: '#2196F3' },
  { id: 3, name: 'Allemand',  emoji: '🇩🇪', color: '#FF9800' },
  { id: 4, name: 'Anglais',   emoji: '🇬🇧', color: '#9C27B0' },
  { id: 5, name: 'Grec',      emoji: '🏛️', color: '#00BCD4' },
  { id: 6, name: 'Arabe',     emoji: '🌙', color: '#F44336' },
  { id: 7, name: 'Géo',       emoji: '🌍', color: '#795548' },
  { id: 8, name: 'Histoire',  emoji: '⏳', color: '#607D8B' },
]

export const POSTIT_COLORS = { yellow: '#fff9c4', green: '#c8e6c9', pink: '#f8bbd0', blue: '#bbdefb' }

export const POSTIT_SIZES = {
  small:  { width: '160px', height: '80px' },
  square: { width: '200px', height: '200px' },
  large:  { width: '320px', height: '120px' },
}

export const POSTIT_ICONS = ['❤️', '✏️', '⚠️', '⭐', '📌', '✅', '💡', '🔍', '❓', '🎯']

export const WORD_LIST_TYPES: Record<string, string> = {
  vocabulaire: 'Vocabulaire',
  conjugaison: 'Conjugaison',
  dictée: 'Dictée',
}

export function getPreview(html: string): string {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > 60 ? plain.substring(0, 60) + '…' : plain
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CH')
}

export function fmtDateDMY(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}
