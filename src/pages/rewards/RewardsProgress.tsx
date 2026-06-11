import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Delta } from '../../components/Delta'
import { addDigoos } from '../../services/digoos'
import {
  WEEK_THRESHOLD, WEEK_VERY_ACTIVE_THRESHOLD, ALL_BADGES,
  playBadgeSound, getCurrentWeekKey, getWeekLabel, getWeekRange, mondayForWeekKey,
} from './helpers'
import type { Badge, Progress } from './types'

interface RewardsProgressProps {
  progress: Progress | null
  onDigoosUpdate: () => void
}

const DAY_REWARD = 10
const WEEK_REWARD = 50
const MONTH_REWARD = 200
const FIRST_MONTH = '2026-06'
const MONTH_MIN_ACTIVE_DAYS = 15
const MONTH_MIN_ACTIVE_WEEKS = 2
const MONTH_MIN_EXERCISES = 15

const getMonthKey = (dateStr: string) => dateStr.slice(0, 7)

const getMonthsRange = (start: string, end: string): string[] => {
  const months: string[] = []
  let [year, month] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month++
    if (month > 12) { month = 1; year++ }
  }
  return months
}

export default function RewardsProgress({ progress, onDigoosUpdate }: RewardsProgressProps) {
  const [activeDays, setActiveDays] = useState<string[]>([])
  const [exerciseDates, setExerciseDates] = useState<string[]>([])

  const userId = progress?.user_id

  useEffect(() => {
    fetchActivityData()
  }, [userId])

  const fetchActivityData = async () => {
    if (!userId) return
    const { data } = await supabase.from('daily_activity').select('date, action_type').eq('user_id', userId)
    if (data) {
      setActiveDays([...new Set(data.map(a => a.date))])
      setExerciseDates(data.filter(a => a.action_type === 'exercise_completed').map(a => a.date))
    }
  }

  const currentWeek = getCurrentWeekKey()
  const weekProgress = progress ? Math.min((progress.digoos_this_week / WEEK_THRESHOLD) * 100, 100) : 0
  const isCurrentWeekActive = progress ? progress.digoos_this_week >= WEEK_THRESHOLD : false

  const handleClaimBadge = async (badge: Badge) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !progress) return
    playBadgeSound()
    await addDigoos(10, 'badge')
    const updatedClaimed = [...(progress.claimed_badges || []), badge.id]
    await supabase.from('progress').update({ claimed_badges: updatedClaimed }).eq('user_id', user.id)
    onDigoosUpdate()
  }

  const weekRange = getWeekRange(currentWeek)
  const isWeekActive = (weekKey: string): boolean =>
    (progress?.active_weeks || []).some((w: any) => (typeof w === 'string' ? w : w.week) === weekKey)

  const getWeekDigoos = (weekKey: string): number =>
    (progress?.active_weeks || [])
      .filter((w: any) => (typeof w === 'string' ? w : w.week) === weekKey)
      .reduce((sum: number, w: any) => sum + (typeof w === 'object' ? (w.digoos || 0) : 0), 0)

  const getWeekColor = (weekKey: string, isFuture: boolean): string => {
    if (isFuture) return '#f5f5f5'
    if (weekKey === currentWeek) return '#e9c46a'
    if (!isWeekActive(weekKey)) return '#e0e0e0'
    const weekDigoos = getWeekDigoos(weekKey)
    if (weekDigoos >= WEEK_VERY_ACTIVE_THRESHOLD) return '#2a9d8f'
    if (weekDigoos >= WEEK_THRESHOLD) return '#a5d6a7'
    return '#e0e0e0'
  }

  // ==================== RÉCOMPENSES À RÉCUPÉRER ====================

  // Jours actifs
  const unclaimedDays = activeDays.filter(d => !(progress?.claimed_days || []).includes(d))

  // Semaines actives (>= WEEK_THRESHOLD Digoos)
  const activeWeeksAboveThreshold = (progress?.active_weeks || []).filter(w => (w.digoos || 0) >= WEEK_THRESHOLD)
  const unclaimedWeeks = activeWeeksAboveThreshold
    .filter(w => !(progress?.claimed_weeks || []).includes(w.week))
    .map(w => w.week)

  // Mois actifs
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const months = getMonthsRange(FIRST_MONTH, currentMonthKey)

  const isMonthActive = (monthKey: string): boolean => {
    const activeDaysInMonth = activeDays.filter(d => getMonthKey(d) === monthKey).length
    const activeWeeksEndingInMonth = activeWeeksAboveThreshold.filter(w => {
      const monday = mondayForWeekKey(w.week)
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      return getMonthKey(sunday.toISOString().split('T')[0]) === monthKey
    }).length
    const exercisesInMonth = exerciseDates.filter(d => getMonthKey(d) === monthKey).length
    return activeDaysInMonth >= MONTH_MIN_ACTIVE_DAYS
      && activeWeeksEndingInMonth >= MONTH_MIN_ACTIVE_WEEKS
      && exercisesInMonth >= MONTH_MIN_EXERCISES
  }

  const unclaimedMonths = months.filter(m => isMonthActive(m) && !(progress?.claimed_months || []).includes(m))

  const claimAllDays = async () => {
    if (!userId || unclaimedDays.length === 0) return
    const newClaimed = [...(progress?.claimed_days || []), ...unclaimedDays]
    const totalAmount = unclaimedDays.length * DAY_REWARD
    await supabase.from('progress').update({ claimed_days: newClaimed }).eq('user_id', userId)
    await addDigoos(totalAmount, 'reward')
    onDigoosUpdate()
    fetchActivityData()
  }

  const claimAllWeeks = async () => {
    if (!userId || unclaimedWeeks.length === 0) return
    const newClaimed = [...(progress?.claimed_weeks || []), ...unclaimedWeeks]
    const totalAmount = unclaimedWeeks.length * WEEK_REWARD
    await supabase.from('progress').update({ claimed_weeks: newClaimed }).eq('user_id', userId)
    await addDigoos(totalAmount, 'reward')
    onDigoosUpdate()
    fetchActivityData()
  }

  const claimAllMonths = async () => {
    if (!userId || unclaimedMonths.length === 0) return
    const newClaimed = [...(progress?.claimed_months || []), ...unclaimedMonths]
    const totalAmount = unclaimedMonths.length * MONTH_REWARD
    await supabase.from('progress').update({ claimed_months: newClaimed }).eq('user_id', userId)
    await addDigoos(totalAmount, 'reward')
    onDigoosUpdate()
    fetchActivityData()
  }

  const claimButtonStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem',
    background: '#2a9d8f', color: 'white',
    border: 'none', borderRadius: '0.5rem',
    cursor: 'pointer', fontWeight: 'bold',
    fontSize: '0.9rem',
  }

  return (
    <div>
      {/* Récompenses à récupérer */}
      <div style={{ marginBottom: '1.5rem', background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>🎁 Récompenses à récupérer</h3>

        {/* Jours actifs */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'bold', color: '#333' }}>🌟 Jours actifs</span>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>{unclaimedDays.length} jour(s) non récupéré(s)</span>
          </div>
          {unclaimedDays.length > 0 ? (
            <button onClick={claimAllDays} style={claimButtonStyle}>
              Récupérer tout — +{unclaimedDays.length * DAY_REWARD} <Delta size={16} />
            </button>
          ) : (
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Tout est récupéré ✓</p>
          )}
        </div>

        {/* Semaines actives */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'bold', color: '#333' }}>🔥 Semaines actives</span>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>{unclaimedWeeks.length} semaine(s) non récupérée(s)</span>
          </div>
          {unclaimedWeeks.length > 0 ? (
            <button onClick={claimAllWeeks} style={claimButtonStyle}>
              Récupérer tout — +{unclaimedWeeks.length * WEEK_REWARD} <Delta size={16} />
            </button>
          ) : (
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Tout est récupéré ✓</p>
          )}
        </div>

        {/* Mois actifs */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 'bold', color: '#333' }}>🏆 Mois actifs</span>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>{unclaimedMonths.length} mois non récupéré(s)</span>
          </div>
          {unclaimedMonths.length > 0 ? (
            <button onClick={claimAllMonths} style={claimButtonStyle}>
              Récupérer tout — +{unclaimedMonths.length * MONTH_REWARD} <Delta size={16} />
            </button>
          ) : (
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Tout est récupéré ✓</p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>

        {/* Digoos accumulés */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>💰 Digoos</h3>
          <div style={{ color: '#555', fontSize: '0.9rem' }}>
            Cette semaine : <strong style={{ color: isCurrentWeekActive ? '#2a9d8f' : '#e9c46a' }}>{progress?.digoos_this_week || 0}</strong> / {WEEK_THRESHOLD}
          </div>
          <div style={{ marginTop: '0.5rem', background: '#f0f0f0', borderRadius: '1rem', height: '8px', overflow: 'hidden' }}>
            <div className="progress-bar" style={{ width: `${weekProgress}%`, background: isCurrentWeekActive ? '#2a9d8f' : '#e9c46a', height: '100%', borderRadius: '1rem' }} />
          </div>
          {isCurrentWeekActive && <div style={{ color: '#2a9d8f', fontSize: '0.8rem', marginTop: '0.25rem' }}>✅ Semaine active !</div>}
        </div>

        {/* Streak semaines */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>🔥 Série de semaines</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#e9c46a', marginBottom: '0.25rem' }}>
            {progress?.week_streak || 0}
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>semaines consécutives actives</div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {weekRange.map(({ key, isFuture }) => (
              <div
                key={key}
                title={getWeekLabel(key)}
                style={{
                  width: '32px', height: '32px', borderRadius: '0.3rem',
                  background: getWeekColor(key, isFuture),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', color: isFuture ? '#bbb' : 'white', fontWeight: 'bold', cursor: 'default',
                }}
              >
                {key.split('-S')[1]}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem' }}>
            🟠 en cours · 🟢 active · 🟩 très active · ⬜ inactive · 🔲 à venir
          </div>
        </div>

      </div>

      {/* Badges */}
      <div style={{ marginTop: '1.5rem', background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem', fontSize: '1rem' }}>
          🏅 Badges ({progress?.claimed_badges?.length || 0}/{ALL_BADGES.length})
        </h3>
        <div>
          {ALL_BADGES.map(badge => {
            const conditionMet = progress ? badge.condition(progress) : false
            const claimed = !!progress?.claimed_badges?.includes(badge.id)
            const obtainable = conditionMet && !claimed
            const statusLabel = claimed ? 'Terminé ✓' : obtainable ? 'Obtenu' : 'En cours'
            const statusBg = claimed ? '#f0faf8' : obtainable ? '#e9c46a' : '#f5f5f5'
            const statusColor = claimed ? '#2a9d8f' : obtainable ? 'white' : '#888'
            return (
              <div key={badge.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: '1.5rem' }}>{badge.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>{badge.label}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>{badge.description}</div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>{progress ? badge.progressLabel(progress) : ''}</div>
                <span
                  onClick={() => obtainable && handleClaimBadge(badge)}
                  onMouseEnter={e => { if (obtainable) e.currentTarget.style.background = '#dfb15a' }}
                  onMouseLeave={e => { if (obtainable) e.currentTarget.style.background = '#e9c46a' }}
                  style={{
                    padding: '0.35rem 0.85rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 'bold',
                    background: statusBg, color: statusColor,
                    cursor: obtainable ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {statusLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
