import type { Evaluation, Revision } from '../../type/index'
import type { Event as AppEvent } from '../../type/index'

export type { Evaluation, Revision, AppEvent }

export interface SubjectOption {
  id: number | string
  name: string
  emoji?: string | null
  isCustom: boolean
}

export type Tab = 'evaluations' | 'revisions' | 'events' | 'reminders' | 'missions'
export type PlannerView = 'list' | 'calendar'
export type CalendarView = 'day' | 'week' | 'month'

export interface Reminder {
  id: string
  user_id: string
  title: string
  description?: string
  deadline_date: string
  deadline_time?: string
  odigo_remind: 'each_login' | 'one_day' | 'one_week' | 'never'
  completed: boolean
  created_at: string
}

export interface CalendarItem {
  id: string
  type: 'evaluation' | 'revision' | 'event' | 'reminder' | 'mission'
  title: string
  date: string
  startTime?: string
  endTime?: string
  color: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}

export const PLANNER_COLORS = {
  evaluation: '#e76f51',
  revision: '#5c6bc0',
  event: '#2a9d8f',
  reminder: '#e9a825',
  mission: '#f4a261',
} as const

export const ODIGO_REMIND_LABELS: Record<string, string> = {
  each_login: 'À chaque connexion',
  one_day: 'Un jour avant',
  one_week: 'Une semaine avant',
  never: 'Jamais',
}

export const formatDate = (d: string): string => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}
