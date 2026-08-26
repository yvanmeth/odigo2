export type PastFilter = 'all' | 'year' | '30days' | 'none'

export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date()
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const formatDateDMY = (dateStr: string): string => {
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

export const isToday = (dateStr: string): boolean => {
  const d = parseLocalDate(dateStr)
  const today = new Date()
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
}

export const toDateStr = (d: Date): string => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getWeekBounds = (weekOffset: number): { start: string; end: string } => {
  const now = new Date()
  const day = now.getDay()
  const daysToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + daysToMon + weekOffset * 7)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: toDateStr(mon), end: toDateStr(sun) }
}

export const getISOWeekNumber = (date: Date): number => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime())
    / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

export const formatWeekRange = (weekOffset: number): string => {
  const { start, end } = getWeekBounds(weekOffset)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  const startStr = parseLocalDate(start).toLocaleDateString('fr-FR', opts)
  const endStr = parseLocalDate(end).toLocaleDateString('fr-FR', opts)
  return `du lundi ${startStr} au dimanche ${endStr}`
}

export const inRange = (dateStr: string, start: string, end: string): boolean =>
  dateStr >= start && dateStr <= end

export const isPastInFilter = (dateStr: string, filter: PastFilter, todayStr: string): boolean => {
  if (filter === 'none' || dateStr >= todayStr) return false
  if (filter === 'all') return true
  if (filter === 'year') return dateStr.startsWith(String(new Date().getFullYear()))
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return dateStr >= d.toISOString().split('T')[0]
}

export const formatMissionDeadline = (deadline: string): string => {
  const d = new Date(deadline)
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const h = d.getHours(), m = d.getMinutes()
  if (h === 0 && m === 0) return datePart.charAt(0).toUpperCase() + datePart.slice(1)
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart.charAt(0).toUpperCase() + datePart.slice(1)} à ${timePart}`
}
