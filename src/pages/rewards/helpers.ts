import type { Badge } from './types'

export const WEEK_THRESHOLD = 300
export const WEEK_VERY_ACTIVE_THRESHOLD = 1000

export const ALL_BADGES: Badge[] = [
  { id: 'first_week', label: 'Premier pas', description: 'Première semaine active', icon: '🌱', condition: p => p.active_weeks.length >= 1, progressLabel: p => `${p.active_weeks.length}/1` },
  { id: 'two_weeks', label: 'En route', description: '2 semaines consécutives', icon: '🔥', condition: p => p.week_streak >= 2, progressLabel: p => `${p.week_streak}/2` },
  { id: 'five_weeks', label: 'Régulier', description: '5 semaines consécutives', icon: '⚡', condition: p => p.week_streak >= 5, progressLabel: p => `${p.week_streak}/5` },
  { id: 'ten_weeks', label: 'Champion', description: '10 semaines consécutives', icon: '🏆', condition: p => p.week_streak >= 10, progressLabel: p => `${p.week_streak}/10` },
  { id: 'twenty_weeks', label: 'Légendaire', description: '20 semaines consécutives', icon: '💎', condition: p => p.week_streak >= 20, progressLabel: p => `${p.week_streak}/20` },
  { id: 'hundred_digoos', label: 'Riche', description: '100 Digoos accumulés', icon: '💰', condition: p => p.digoos >= 100, progressLabel: p => `${p.digoos}/100` },
  { id: 'five_hundred_digoos', label: 'Millionnaire', description: '500 Digoos accumulés', icon: '🤑', condition: p => p.digoos >= 500, progressLabel: p => `${p.digoos}/500` },
]

export const playBadgeSound = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.connect(g); g.connect(ctx.destination)
  o.type = 'triangle'
  o.frequency.setValueAtTime(880, ctx.currentTime)
  o.frequency.setValueAtTime(1175, ctx.currentTime + 0.06)
  g.gain.setValueAtTime(0.1, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  o.start(); o.stop(ctx.currentTime + 0.25)
}

export const getCurrentWeekKey = () => {
  const now = new Date()
  const day = now.getDay()
  const hours = now.getHours()
  const offset = (day === 0 && hours < 18) ? 7 : 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset)
  monday.setHours(0, 0, 0, 0)
  const year = monday.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${year}-S${weekNum.toString().padStart(2, '0')}`
}

export const getWeekLabel = (key: string) => {
  const parts = key.split('-S')
  return `Semaine ${parts[1]} — ${parts[0]}`
}

export const weekKeyForDate = (d: Date) => {
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const year = monday.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return { key: `${year}-S${weekNum.toString().padStart(2, '0')}`, monday }
}

export const FIRST_DISPLAYED_WEEK = '2026-S23'
export const FUTURE_WEEKS_COUNT = 5

export const getWeekRange = (currentKey: string): { key: string; isFuture: boolean }[] => {
  const cursor = new Date(2026, 0, 1)
  cursor.setDate(cursor.getDate() - (cursor.getDay() === 0 ? 6 : cursor.getDay() - 1))
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 60 && weekKeyForDate(cursor).key !== FIRST_DISPLAYED_WEEK; i++) {
    cursor.setDate(cursor.getDate() + 7)
  }

  const weeks: { key: string; isFuture: boolean }[] = []
  let pastCurrent = false
  let futureCount = 0
  for (let i = 0; i < 500 && futureCount <= FUTURE_WEEKS_COUNT; i++) {
    const key = weekKeyForDate(cursor).key
    if (pastCurrent) futureCount++
    if (futureCount > FUTURE_WEEKS_COUNT) break
    weeks.push({ key, isFuture: pastCurrent })
    if (key === currentKey) pastCurrent = true
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export const mondayForWeekKey = (targetKey: string): Date => {
  const cursor = new Date(2026, 0, 1)
  cursor.setDate(cursor.getDate() - (cursor.getDay() === 0 ? 6 : cursor.getDay() - 1))
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 500; i++) {
    if (weekKeyForDate(cursor).key === targetKey) return new Date(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }
  return new Date(cursor)
}

export const isAfterSundayReset = () => {
  const now = new Date()
  return now.getDay() === 0 && now.getHours() >= 18
}

export const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}
