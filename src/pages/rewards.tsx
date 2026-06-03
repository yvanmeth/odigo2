import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Progress {
  user_id: string
  digoos: number
  digoos_this_week: number
  active_weeks: string[]
  week_streak: number
  badges: string[]
  last_week_reset: string
  updated_at: string
}

interface Badge {
  id: string
  label: string
  description: string
  icon: string
  condition: (p: Progress) => boolean
}

const WEEK_THRESHOLD = 100

const ALL_BADGES: Badge[] = [
  { id: 'first_week', label: 'Premier pas', description: 'Première semaine active', icon: '🌱', condition: p => p.active_weeks.length >= 1 },
  { id: 'two_weeks', label: 'En route', description: '2 semaines consécutives', icon: '🔥', condition: p => p.week_streak >= 2 },
  { id: 'five_weeks', label: 'Régulier', description: '5 semaines consécutives', icon: '⚡', condition: p => p.week_streak >= 5 },
  { id: 'ten_weeks', label: 'Champion', description: '10 semaines consécutives', icon: '🏆', condition: p => p.week_streak >= 10 },
  { id: 'twenty_weeks', label: 'Légendaire', description: '20 semaines consécutives', icon: '💎', condition: p => p.week_streak >= 20 },
  { id: 'hundred_digoos', label: 'Riche', description: '100 Digoos accumulés', icon: '💰', condition: p => p.digoos >= 100 },
  { id: 'five_hundred_digoos', label: 'Millionnaire', description: '500 Digoos accumulés', icon: '🤑', condition: p => p.digoos >= 500 },
]

// Calcule la clé de semaine courante (dimanche 18h → dimanche 18h)
const getCurrentWeekKey = () => {
  const now = new Date()
  const day = now.getDay() // 0=dim, 1=lun...
  const hours = now.getHours()
  
  // Si dimanche avant 18h, on est encore dans la semaine précédente
  const offset = (day === 0 && hours < 18) ? 7 : 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset)
  monday.setHours(0, 0, 0, 0)
  
  const year = monday.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${year}-S${weekNum.toString().padStart(2, '0')}`
}

const getWeekLabel = (key: string) => {
  const parts = key.split('-S')
  return `Semaine ${parts[1]} — ${parts[0]}`
}

const isAfterSundayReset = () => {
  const now = new Date()
  return now.getDay() === 0 && now.getHours() >= 18
}

export default function Rewards() {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [newBadges, setNewBadges] = useState<string[]>([])
  const [weekSummaryVisible, setWeekSummaryVisible] = useState(false)

  useEffect(() => {
    fetchProgress()
  }, [])

  const fetchProgress = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      const updated = await checkWeekReset(data, user.id)
      setProgress(updated)
      checkNewBadges(updated)
    } else {
      // Créer le profil de progression
      const newProgress: Partial<Progress> = {
        user_id: user.id,
        digoos: 0,
        digoos_this_week: 0,
        active_weeks: [],
        week_streak: 0,
        badges: [],
        last_week_reset: getCurrentWeekKey(),
      }
      await supabase.from('progress').insert(newProgress)
      setProgress(newProgress as Progress)
    }
    setLoading(false)
  }

  const checkWeekReset = async (p: Progress, userId: string) => {
    const currentWeek = getCurrentWeekKey()
    if (p.last_week_reset === currentWeek) return p

    // Nouvelle semaine — vérifier si la semaine passée était active
    const wasActive = p.digoos_this_week >= WEEK_THRESHOLD
    const updatedActiveWeeks = wasActive
      ? [...(p.active_weeks || []), p.last_week_reset].slice(-52) // garder 1 an
      : [...(p.active_weeks || [])].slice(-52)

    // Calculer le streak de semaines
    const newStreak = wasActive ? (p.week_streak || 0) + 1 : 0

    const updated = {
      ...p,
      digoos_this_week: 0,
      active_weeks: updatedActiveWeeks,
      week_streak: newStreak,
      last_week_reset: currentWeek,
    }

    await supabase.from('progress').update({
      digoos_this_week: 0,
      active_weeks: updatedActiveWeeks,
      week_streak: newStreak,
      last_week_reset: currentWeek,
    }).eq('user_id', userId)

    if (isAfterSundayReset()) setWeekSummaryVisible(true)

    return updated
  }

  const checkNewBadges = async (p: Progress) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const earned = ALL_BADGES
      .filter(b => b.condition(p) && !(p.badges || []).includes(b.id))
      .map(b => b.id)

    if (earned.length > 0) {
      const updatedBadges = [...(p.badges || []), ...earned]
      await supabase.from('progress').update({ badges: updatedBadges }).eq('user_id', user.id)
      setProgress(prev => prev ? { ...prev, badges: updatedBadges } : prev)
      setNewBadges(earned)
    }
  }

  const currentWeek = getCurrentWeekKey()
  const weekProgress = progress ? Math.min((progress.digoos_this_week / WEEK_THRESHOLD) * 100, 100) : 0
  const isCurrentWeekActive = progress ? progress.digoos_this_week >= WEEK_THRESHOLD : false

  // Générer les 10 dernières semaines pour affichage
  const getLast10Weeks = () => {
    const weeks = []
    const now = new Date()
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const day = d.getDay()
      const monday = new Date(d)
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      monday.setHours(0, 0, 0, 0)
      const year = monday.getFullYear()
      const startOfYear = new Date(year, 0, 1)
      const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
      weeks.push(`${year}-S${weekNum.toString().padStart(2, '0')}`)
    }
    return weeks
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      {/* Nouveaux badges */}
      {newBadges.length > 0 && (
        <div style={{ background: '#f0faf8', border: '2px solid #2a9d8f', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎉 Nouveau badge débloqué !</div>
          {newBadges.map(id => {
            const badge = ALL_BADGES.find(b => b.id === id)
            return badge ? (
              <div key={id} style={{ fontSize: '1.1rem', color: '#2a9d8f', fontWeight: 'bold' }}>
                {badge.icon} {badge.label}
              </div>
            ) : null
          })}
        </div>
      )}

      {/* Résumé semaine (dimanche 18h) */}
      {weekSummaryVisible && (
        <div style={{ background: '#fffbf0', border: '2px solid #e9c46a', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 'bold', color: '#e9c46a', marginBottom: '0.5rem' }}>📊 Résumé de la semaine</div>
          <p style={{ color: '#555', margin: 0 }}>
            {isCurrentWeekActive
              ? `✅ Semaine active ! Tu as accumulé ${progress?.digoos_this_week} Digoos.`
              : `⚠️ Semaine insuffisante. Il te manquait ${WEEK_THRESHOLD - (progress?.digoos_this_week || 0)} Digoos pour valider la semaine.`
            }
          </p>
          <button onClick={() => setWeekSummaryVisible(false)} style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', background: '#e9c46a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            OK
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>

        {/* Digoos */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>💰 Digoos</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>
            {progress?.digoos || 0}
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>Digoos accumulés</div>
          <div style={{ marginTop: '1rem', color: '#555', fontSize: '0.9rem' }}>
            Cette semaine : <strong style={{ color: isCurrentWeekActive ? '#2a9d8f' : '#e9c46a' }}>{progress?.digoos_this_week || 0}</strong> / {WEEK_THRESHOLD}
          </div>
          <div style={{ marginTop: '0.5rem', background: '#f0f0f0', borderRadius: '1rem', height: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${weekProgress}%`, background: isCurrentWeekActive ? '#2a9d8f' : '#e9c46a', height: '100%', borderRadius: '1rem', transition: 'width 0.3s ease' }} />
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

          {/* 10 dernières semaines */}
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {getLast10Weeks().map(week => {
              const isActive = progress?.active_weeks?.includes(week)
              const isCurrent = week === currentWeek
              return (
                <div
                  key={week}
                  title={getWeekLabel(week)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '0.3rem',
                    background: isCurrent
                      ? (isCurrentWeekActive ? '#2a9d8f' : '#e9c46a')
                      : isActive ? '#2a9d8f' : '#e0e0e0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'default',
                  }}
                >
                  {week.split('-S')[1]}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem' }}>
            🟢 active · 🟡 en cours · ⬜ inactive
          </div>
        </div>

        {/* Badges */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', gridColumn: 'span 1' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1rem' }}>🏅 Badges</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {ALL_BADGES.map(badge => {
              const unlocked = progress?.badges?.includes(badge.id)
              return (
                <div
                  key={badge.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    background: unlocked ? '#f0faf8' : '#f9f9f9',
                    border: `1px solid ${unlocked ? '#2a9d8f' : '#eee'}`,
                    opacity: unlocked ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{badge.icon}</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: unlocked ? '#2a9d8f' : '#aaa', fontSize: '0.9rem' }}>{badge.label}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{badge.description}</div>
                  </div>
                  {unlocked && <span style={{ marginLeft: 'auto', color: '#2a9d8f', fontSize: '1rem' }}>✓</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}