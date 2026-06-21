import type { Evaluation, Revision, AppEvent, Reminder, SubjectOption, CalendarItem, CalendarView } from './types'

export interface PlannerMission {
  id: string
  name: string
  description: string
  deadline: string
  reward_type: 'digoos' | 'irl_reward'
  reward_amount: number | null
}

export const formatDate = (d: string): string => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export const toDateStr = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export const getWeekDays = (date: Date): Date[] => {
  const day = date.getDay()
  const daysToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(date)
  mon.setDate(date.getDate() + daysToMon)
  mon.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

export const getMonthGrid = (date: Date): Date[] => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = firstDay.getDay()
  const padStart = startDow === 0 ? 6 : startDow - 1
  const endDow = lastDay.getDay()
  const padEnd = endDow === 0 ? 0 : 7 - endDow
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - padStart)
  const gridEnd = new Date(lastDay)
  gridEnd.setDate(lastDay.getDate() + padEnd)
  const days: Date[] = []
  const cur = new Date(gridStart)
  while (cur <= gridEnd) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
  return days
}

export const formatDateHeader = (date: Date, view: CalendarView): string => {
  if (view === 'day') {
    const s = date.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  if (view === 'week') {
    const days = getWeekDays(date)
    const start = days[0], end = days[6]
    const weekNo = getWeekNumber(date)
    const crossMonth = start.getMonth() !== end.getMonth()
    const startStr = crossMonth
      ? start.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
      : start.toLocaleDateString('fr-CH', { day: 'numeric' })
    const endStr = end.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
    return `Semaine ${weekNo} — ${startStr} au ${endStr}`
  }
  const s = date.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const parseTime = (t: string): { h: number; m: number } => {
  const [hStr, mStr] = t.split(':')
  return { h: parseInt(hStr, 10), m: parseInt(mStr, 10) }
}

export const buildCalendarItems = (
  evals: Evaluation[],
  revs: Revision[],
  evts: AppEvent[],
  rems: Reminder[],
  subs: SubjectOption[],
  missions: PlannerMission[] = []
): CalendarItem[] => {
  const getName = (id: unknown) => subs.find(s => String(s.id) === String(id))?.name || '?'
  const items: CalendarItem[] = []
  evals.forEach(e => items.push({
    id: e.id, type: 'evaluation',
    title: `${getName(e.subject_id)} — ${e.topic}`,
    date: e.evaluation_date, startTime: e.start_time || undefined, endTime: e.end_time || undefined,
    color: '#2a9d8f', raw: e,
  }))
  revs.forEach(r => items.push({
    id: r.id, type: 'revision',
    title: r.details || 'Révision',
    date: r.revision_date, startTime: r.start_time || undefined, endTime: r.end_time || undefined,
    color: '#5c6bc0', raw: r,
  }))
  evts.forEach(ev => items.push({
    id: ev.id, type: 'event',
    title: ev.title,
    date: ev.event_date, startTime: ev.start_time || undefined, endTime: ev.end_time || undefined,
    color: '#e76f51', raw: ev,
  }))
  rems.forEach(r => items.push({
    id: r.id, type: 'reminder',
    title: r.title,
    date: r.deadline_date, startTime: r.deadline_time || undefined,
    color: '#e9c46a', raw: r,
  }))
  missions.forEach(m => {
    const dateStr = m.deadline.split('T')[0]
    const timePart = m.deadline.includes('T') ? m.deadline.split('T')[1]?.slice(0, 5) : undefined
    items.push({
      id: m.id, type: 'mission',
      title: `🎯 ${m.name}`,
      date: dateStr, startTime: timePart || undefined,
      color: '#e76f51', raw: m,
    })
  })
  return items
}
