import { parseLocalDate, getISOWeekNumber } from './dates'

export const computeDayStreak = (dateCounts: Record<string, number>): number => {
  let streak = 0
  for (let i = 0; i < 366; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const count = dateCounts[ds] || 0
    if (i === 0 && count > 0) streak++
    else if (i > 0 && count >= 1) streak++
    else if (i > 0) break
  }
  return streak
}

export const computeMonthStreak = (dailyActivity: { date: string }[]): number => {
  let streak = 0
  for (let i = 0; i < 24; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    const prefix = d.toISOString().substring(0, 7)
    if (dailyActivity.some(a => a.date.startsWith(prefix))) streak++
    else break
  }
  return streak
}

export const computeMonthSteps = (dailyActivity: { date: string }[], todayStr: string): number => {
  const thisMonthPrefix = todayStr.substring(0, 7)
  const monthAct = dailyActivity.filter(a => a.date.startsWith(thisMonthPrefix))
  const activeDaysThisMonth = new Set(monthAct.map(a => a.date.split('T')[0])).size
  const activeWeeksThisMonth = new Set(
    monthAct.map(a => getISOWeekNumber(parseLocalDate(a.date.split('T')[0])))
  ).size
  return Math.min(activeDaysThisMonth, 15) + Math.min(activeWeeksThisMonth, 2) + Math.min(monthAct.length, 15)
}
