import { useEffect, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { supabase } from '../lib/supabase'
import { generateGreeting } from '../lib/greeting'
import type { Evaluation, Revision } from '../type/index'
import type { Event as AppEvent } from '../type/index'
import { logActivity } from '../services/activity'

// ==================== INTERFACES ====================

interface Reminder {
  id: string
  user_id: string
  title: string
  deadline_date: string
  deadline_time?: string
  completed: boolean
  created_at: string
}

interface ProgressData {
  week_streak: number
  digoos_this_week: number
  digoos?: number
}

interface DailyActivity {
  date: string
}

interface SubjectRow { id: number; name: string }
interface UserSubjectRow {
  id: string
  subject_id: number | null
  custom_name: string | null
  custom_emoji: string | null
  hidden: boolean
}
interface SubjectOption { id: number | string; name: string; emoji: string | null }

type PastFilter = 'all' | 'year' | '30days' | 'none'
type FilterKey = 'evaluations' | 'revisions' | 'events' | 'reminders'
type TypeFilters = Record<FilterKey, boolean>

// ==================== HELPERS ====================

function getWeekBounds(weekOffset: number): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const daysToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + daysToMon + weekOffset * 7)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] }
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00')
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}.${m}.${y}`
}

function inRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end
}

function isPastInFilter(dateStr: string, filter: PastFilter, todayStr: string): boolean {
  if (filter === 'none' || dateStr >= todayStr) return false
  if (filter === 'all') return true
  if (filter === 'year') return dateStr.startsWith(String(new Date().getFullYear()))
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return dateStr >= d.toISOString().split('T')[0]
}

// ==================== PROGRESS CIRCLE ====================

function ProgressCircle({ value, max, streak, label, color }: {
  value: number; max: number; streak: number; label: string; color: string
}) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(value / max, 1))
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e0f0ee" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="48" y="48" textAnchor="middle" dominantBaseline="middle"
          fontSize="22" fontWeight="bold" fill="#333"
          style={{ transform: 'rotate(90deg)', transformOrigin: '48px 48px' }}
        >
          {streak}
        </text>
      </svg>
      <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export default function Home({ userId }: { userId?: string }) {
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState<string>('')
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [typeFilters, setTypeFilters] = useState<TypeFilters>({
    evaluations: true, revisions: true, events: true, reminders: true,
  })
  const [pastFilter, setPastFilter] = useState<PastFilter>('30days')

  useEffect(() => { fetchAll() }, [userId])

  const fetchAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const targetId = userId || user?.id
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const twoYearsAgo = `${now.getFullYear() - 2}-01-01`

    const [progressRes, evalsRes, revisionsRes, eventsRes, remindersRes, activityRes, fixedRes, prefsRes, profileRes] =
      await Promise.all([
        supabase.from('progress').select('week_streak, digoos_this_week, digoos').eq('user_id', targetId).single(),
        supabase.from('evaluations').select('*').eq('user_id', targetId).order('evaluation_date'),
        supabase.from('revisions').select('*').eq('user_id', targetId).order('revision_date'),
        supabase.from('events').select('*').eq('user_id', targetId).order('event_date'),
        supabase.from('reminders').select('*').eq('user_id', targetId).order('deadline_date'),
        supabase.from('daily_activity').select('date').eq('user_id', targetId).gte('date', twoYearsAgo),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('user_subjects').select('id, subject_id, custom_name, custom_emoji, hidden').eq('user_id', targetId),
        supabase.from('profiles').select('first_name, birth_date, last_seen_at').eq('id', targetId).single(),
      ])

    if (progressRes.data) setProgressData(progressRes.data as ProgressData)
    if (evalsRes.data) setEvaluations(evalsRes.data)
    if (revisionsRes.data) setRevisions(revisionsRes.data)
    if (eventsRes.data) setEvents(eventsRes.data)
    if (remindersRes.data) setReminders(remindersRes.data as Reminder[])
    if (activityRes.data) setDailyActivity(activityRes.data as DailyActivity[])

    const fixedSubjects: SubjectRow[] = (fixedRes.data as SubjectRow[] | null) || []
    const userPrefs: UserSubjectRow[] = (prefsRes.data as UserSubjectRow[] | null) || []
    const hiddenIds = userPrefs.filter(p => p.subject_id && p.hidden).map(p => p.subject_id)
    const visibleFixed: SubjectOption[] = fixedSubjects
      .filter(s => !hiddenIds.includes(s.id))
      .map(s => ({ id: s.id, name: s.name, emoji: null }))
    const customSubjects: SubjectOption[] = userPrefs
      .filter(p => p.custom_name && !p.hidden)
      .map(p => ({ id: p.id, name: p.custom_name!, emoji: p.custom_emoji }))
    setSubjects([...visibleFixed, ...customSubjects])

    // Mise à jour last_seen_at + calcul de la salutation
    const profile = profileRes.data as { first_name: string | null; birth_date: string | null; last_seen_at: string | null } | null
    if (targetId) {
      supabase.from('profiles').update({ last_seen_at: now.toISOString() }).eq('id', targetId)
    }

    const lastSeenAt = profile?.last_seen_at
    const daysSinceLastSeen = lastSeenAt
      ? Math.floor((now.getTime() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const upcomingEvals = ((evalsRes.data as Evaluation[] | null) || [])
      .filter(e => e.evaluation_date >= today)
      .sort((a, b) => a.evaluation_date.localeCompare(b.evaluation_date))
    const nextEvalItem = upcomingEvals[0]
    const daysUntilNextEval = nextEvalItem
      ? Math.ceil((new Date(nextEvalItem.evaluation_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined

    const birthDate = profile?.birth_date
    const hasBirthday = birthDate
      ? new Date(birthDate).getMonth() === now.getMonth() && new Date(birthDate).getDate() === now.getDate()
      : false

    const greetingText = generateGreeting({
      firstName: profile?.first_name || '',
      hour: now.getHours(),
      daysSinceLastSeen,
      digoosThisWeek: (progressRes.data as ProgressData | null)?.digoos_this_week || 0,
      weekStreak: (progressRes.data as ProgressData | null)?.week_streak || 0,
      nextEval: nextEvalItem ? { topic: nextEvalItem.topic, daysUntil: daysUntilNextEval! } : undefined,
      isFirstDayOfWeek: now.getDay() === 1,
      hasBirthday,
    })
    setGreeting(greetingText)

    setLoading(false)
  }

  // ---- Computed values ----
  const todayStr = new Date().toISOString().split('T')[0]
  const { start: weekStart, end: weekEnd } = getWeekBounds(0)
  const { start: w1Start, end: w1End } = getWeekBounds(1)
  const { start: w2Start, end: w2End } = getWeekBounds(2)

  // Activity counts by date
  const dateCounts: Record<string, number> = {}
  dailyActivity.forEach(a => {
    const d = a.date.split('T')[0]
    dateCounts[d] = (dateCounts[d] || 0) + 1
  })
  const todayCount = dateCounts[todayStr] || 0

  // Day streak: consecutive days going back; today counts if any activity
  let dayStreak = 0
  for (let i = 0; i < 366; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const count = dateCounts[ds] || 0
    if (i === 0 && count > 0) dayStreak++
    else if (i > 0 && count >= 3) dayStreak++
    else if (i > 0) break
  }

  // Month streak: consecutive months with any activity
  let monthStreak = 0
  for (let i = 0; i < 24; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    const prefix = d.toISOString().substring(0, 7)
    if (dailyActivity.some(a => a.date.startsWith(prefix))) monthStreak++
    else break
  }

  // Month progress steps (max 32)
  const thisMonthPrefix = todayStr.substring(0, 7)
  const monthAct = dailyActivity.filter(a => a.date.startsWith(thisMonthPrefix))
  const activeDaysThisMonth = new Set(monthAct.map(a => a.date.split('T')[0])).size
  const activeWeeksThisMonth = new Set(monthAct.map(a => getWeekNumber(a.date.split('T')[0]))).size
  const monthSteps = Math.min(activeDaysThisMonth, 15) + Math.min(activeWeeksThisMonth, 2) + Math.min(monthAct.length, 15)

  const weekStreak = progressData?.week_streak || 0
  const digoosThisWeek = progressData?.digoos_this_week || 0
  const weekColor = digoosThisWeek < 100 ? '#e63946' : digoosThisWeek < 1000 ? '#a5d6a7' : '#2a9d8f'

  const weekActivity = dailyActivity.filter(a => inRange(a.date.split('T')[0], weekStart, weekEnd))
  const exercisesThisWeek = weekActivity.length
  const currentWeekNo = getWeekNumber(todayStr)

  const getSubjectName = (id: unknown) =>
    subjects.find(s => String(s.id) === String(id))?.name || '?'

  // ---- Mutations ----
  const toggleFilter = (key: FilterKey) =>
    setTypeFilters(prev => ({ ...prev, [key]: !prev[key] }))

  const updateEvalField = async (id: string, field: 'readiness' | 'grade', value: string) => {
    const numVal = value === '' ? null : parseFloat(value)
    await supabase.from('evaluations').update({ [field]: numVal }).eq('id', id)
    await logActivity({ action_type: 'grade_updated', metadata: { field } })
    setEvaluations(prev => prev.map(e => e.id === id ? { ...e, [field]: numVal } : e))
  }

  const toggleRevision = async (r: Revision) => {
    const completed = !r.completed
    await supabase.from('revisions').update({ completed }).eq('id', r.id)
    setRevisions(prev => prev.map(rv => rv.id === r.id ? { ...rv, completed } : rv))
  }

  const toggleReminder = async (r: Reminder) => {
    const completed = !r.completed
    await supabase.from('reminders').update({ completed }).eq('id', r.id)
    setReminders(prev => prev.map(rm => rm.id === r.id ? { ...rm, completed } : rm))
  }

  // ---- Style constants ----
  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '1rem', padding: '1.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem',
  }
  const thStyle: React.CSSProperties = {
    padding: '0.6rem 0.75rem', textAlign: 'left', color: '#2a9d8f',
    fontSize: '0.82rem', fontWeight: 'bold',
  }
  const tdStyle: React.CSSProperties = {
    padding: '0.6rem 0.75rem', fontSize: '0.88rem', borderBottom: '1px solid #f5f5f5',
  }

  const sectionHeader = (title: string, badge?: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <div style={{ color: '#2a9d8f', fontSize: '1rem', fontWeight: 'bold' }}>{title}</div>
      {badge}
    </div>
  )

  const emptyMsg = (
    <EmptyState emoji="🌟" title="Semaine vierge" subtitle="Ajoute des évaluations, révisions ou événements dans le Planificateur." />
  )

  const filterButtons = (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' as const, marginBottom: '1rem' }}>
      {(['evaluations', 'revisions', 'events', 'reminders'] as FilterKey[]).map(key => {
        const labels: Record<FilterKey, string> = {
          evaluations: 'Évaluations', revisions: 'Révisions', events: 'Événements', reminders: 'Rappels',
        }
        return (
          <button key={key} onClick={() => toggleFilter(key)} style={{
            padding: '0.3rem 0.7rem', border: 'none', borderRadius: '0.4rem',
            cursor: 'pointer', fontSize: '0.8rem',
            background: typeFilters[key] ? '#2a9d8f' : '#e0f0ee',
            color: typeFilters[key] ? 'white' : '#2a9d8f',
          }}>
            {labels[key]}
          </button>
        )
      })}
    </div>
  )

  const inlineInput = (evalId: string, field: 'readiness' | 'grade', currentVal: number | null | undefined) => (
    <input
      key={`${field}-${evalId}-${currentVal ?? ''}`}
      type="number" min="0" max="6" step="0.5"
      defaultValue={currentVal ?? ''}
      onBlur={e => updateEvalField(evalId, field, e.target.value)}
      style={{
        width: '48px', border: 'none', borderBottom: '1px solid #2a9d8f',
        textAlign: 'center', background: 'transparent', fontSize: '0.9rem', padding: '0',
        outline: 'none',
      }}
    />
  )

  const groupLabel = (icon: string, label: string) => (
    <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', marginBottom: '0.5rem', marginTop: '0.25rem' }}>
      {icon} {label}
    </div>
  )

  // ---- Week section renderer ----
  const renderWeekSection = (start: string, end: string, weekNo: number, isCurrentWeek: boolean) => {
    const weekEvals = evaluations.filter(e => inRange(e.evaluation_date, start, end))
    const weekRevs = revisions.filter(r => inRange(r.revision_date, start, end))
    const weekEvts = events.filter(e => inRange(e.event_date, start, end))
    const weekRems = isCurrentWeek
      ? reminders.filter(r => !r.completed && (inRange(r.deadline_date, start, end) || r.deadline_date < todayStr))
      : reminders.filter(r => !r.completed && inRange(r.deadline_date, start, end))

    const hasContent =
      (typeFilters.evaluations && weekEvals.length > 0) ||
      (typeFilters.revisions && weekRevs.length > 0) ||
      (typeFilters.events && weekEvts.length > 0) ||
      (typeFilters.reminders && weekRems.length > 0)

    return (
      <div key={start} style={cardStyle}>
        {sectionHeader(
          `Semaine ${weekNo}${isCurrentWeek ? ' — en cours' : ''}`,
          isCurrentWeek ? (
            <span style={{
              padding: '0.2rem 0.65rem', borderRadius: '1rem',
              background: weekColor, color: 'white', fontSize: '0.78rem', fontWeight: 'bold',
            }}>
              {digoosThisWeek} Digoos
            </span>
          ) : undefined
        )}

        {isCurrentWeek && (
          <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: '1rem', marginTop: '-0.5rem' }}>
            {exercisesThisWeek} exercice{exercisesThisWeek !== 1 ? 's' : ''} cette semaine
          </div>
        )}

        {filterButtons}

        {!hasContent && emptyMsg}

        {/* Évaluations */}
        {typeFilters.evaluations && weekEvals.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {groupLabel('📝', 'Évaluations')}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f0faf8' }}>
                    {['Date', 'Matière', 'Sujet', 'Révisions', 'Note attendue', 'Note obtenue'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekEvals.map(e => {
                    const totalRev = revisions.filter(r => r.evaluation_id === e.id).length
                    const doneRev = revisions.filter(r => r.evaluation_id === e.id && r.completed).length
                    return (
                      <tr key={e.id}>
                        <td style={tdStyle}>{fmtDate(e.evaluation_date)}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{getSubjectName(e.subject_id)}</td>
                        <td style={tdStyle}>{e.topic}</td>
                        <td style={tdStyle}>
                          <span style={{ color: doneRev > 0 ? '#2a9d8f' : '#aaa' }}>
                            {doneRev}/{totalRev}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {isCurrentWeek ? inlineInput(e.id, 'readiness', e.readiness) : (e.readiness ?? '—')}
                        </td>
                        <td style={tdStyle}>
                          {isCurrentWeek ? inlineInput(e.id, 'grade', e.grade) : (e.grade ?? '—')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Révisions */}
        {typeFilters.revisions && weekRevs.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {groupLabel('📖', 'Révisions')}
            {weekRevs.map(r => {
              const linkedEval = evaluations.find(e => e.id === r.evaluation_id)
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.45rem 0', borderBottom: '1px solid #f5f5f5',
                }}>
                  <button
                    onClick={() => toggleRevision(r)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0', lineHeight: 1 }}
                  >
                    {r.completed ? '✅' : '⬜'}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', color: '#555' }}>{fmtDate(r.revision_date)}</span>
                    {r.details && (
                      <span style={{ fontSize: '0.82rem', color: '#888', marginLeft: '0.5rem' }}>{r.details}</span>
                    )}
                    {linkedEval && (
                      <span style={{ fontSize: '0.78rem', color: '#2a9d8f', marginLeft: '0.5rem' }}>
                        → {linkedEval.topic}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Événements */}
        {typeFilters.events && weekEvts.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {groupLabel('📅', 'Événements')}
            {weekEvts.map(ev => (
              <div key={ev.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#333' }}>{ev.title}</span>
                <span style={{ fontSize: '0.82rem', color: '#aaa', marginLeft: '0.6rem' }}>{fmtDate(ev.event_date)}</span>
                {ev.details && (
                  <div style={{ fontSize: '0.8rem', color: '#bbb', marginTop: '0.2rem' }}>{ev.details}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Rappels */}
        {typeFilters.reminders && weekRems.length > 0 && (
          <div>
            {groupLabel('🔔', 'Rappels')}
            {weekRems.map(r => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.45rem 0', borderBottom: '1px solid #f5f5f5',
              }}>
                <button
                  onClick={() => toggleReminder(r)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0', lineHeight: 1 }}
                >
                  {r.completed ? '✅' : '⬜'}
                </button>
                <div>
                  <span style={{ fontSize: '0.88rem', color: '#333', fontWeight: 'bold' }}>{r.title}</span>
                  <span style={{
                    fontSize: '0.78rem', marginLeft: '0.5rem',
                    color: r.deadline_date < todayStr ? '#e63946' : '#aaa',
                  }}>
                    {fmtDate(r.deadline_date)}
                    {r.deadline_date < todayStr && ' — en retard'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <p style={{ color: '#888', padding: '2rem', textAlign: 'center' }}>Chargement...</p>

  // ---- Past section ----
  const pastEvals = evaluations
    .filter(e => isPastInFilter(e.evaluation_date, pastFilter, todayStr))
    .sort((a, b) => b.evaluation_date.localeCompare(a.evaluation_date))
  const pastRevs = revisions
    .filter(r => isPastInFilter(r.revision_date, pastFilter, todayStr))
    .sort((a, b) => b.revision_date.localeCompare(a.revision_date))
  const pastEvts = events
    .filter(e => isPastInFilter(e.event_date, pastFilter, todayStr))
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
  const pastRems = reminders
    .filter(r => r.completed && isPastInFilter(r.deadline_date, pastFilter, todayStr))
    .sort((a, b) => b.deadline_date.localeCompare(a.deadline_date))

  const hasPastContent =
    (typeFilters.evaluations && pastEvals.length > 0) ||
    (typeFilters.revisions && pastRevs.length > 0) ||
    (typeFilters.events && pastEvts.length > 0) ||
    (typeFilters.reminders && pastRems.length > 0)

  const pastDurationBtns = (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' as const, marginBottom: '1rem' }}>
      {([['all', 'Tout'], ['year', 'Cette année'], ['30days', '30 derniers jours'], ['none', 'Aucun']] as [PastFilter, string][]).map(([val, label]) => (
        <button key={val} onClick={() => setPastFilter(val)} style={{
          padding: '0.3rem 0.7rem', border: 'none', borderRadius: '0.4rem',
          cursor: 'pointer', fontSize: '0.8rem',
          background: pastFilter === val ? '#888' : '#f0f0f0',
          color: pastFilter === val ? 'white' : '#666',
        }}>
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      {/* ==================== 0. SALUTATION ==================== */}
      {greeting && (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          borderLeft: '4px solid #2a9d8f',
          fontSize: '1.05rem',
          color: '#333',
          lineHeight: '1.5',
        }}>
          {greeting}
        </div>
      )}

      {/* ==================== 1. SÉRIES EN COURS ==================== */}
      <div style={cardStyle}>
        {sectionHeader('🔥 Séries en cours')}
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'space-around' }}>
          <ProgressCircle
            value={todayCount} max={3} streak={dayStreak}
            label="Jours" color="#2a9d8f"
          />
          <ProgressCircle
            value={digoosThisWeek} max={1000} streak={weekStreak}
            label="Semaines" color={weekColor}
          />
          <ProgressCircle
            value={monthSteps} max={32} streak={monthStreak}
            label="Mois" color="#e9c46a"
          />
        </div>
      </div>

      {/* ==================== 2. SEMAINE EN COURS ==================== */}
      {renderWeekSection(weekStart, weekEnd, currentWeekNo, true)}

      {/* ==================== 3. SEMAINES À VENIR ==================== */}
      {renderWeekSection(w1Start, w1End, getWeekNumber(w1Start), false)}
      {renderWeekSection(w2Start, w2End, getWeekNumber(w2Start), false)}

      {/* ==================== 4. ÉVÉNEMENTS PASSÉS ==================== */}
      <div style={cardStyle}>
        {sectionHeader('📋 Historique')}
        {pastDurationBtns}

        {pastFilter !== 'none' && (
          <>
            {filterButtons}
            {!hasPastContent && emptyMsg}

            {typeFilters.evaluations && pastEvals.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {groupLabel('📝', 'Évaluations')}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        {['Date', 'Matière', 'Sujet', 'Révisions', 'Note attendue', 'Note obtenue'].map(h => (
                          <th key={h} style={{ ...thStyle, color: '#aaa' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pastEvals.map(e => {
                        const totalRev = revisions.filter(r => r.evaluation_id === e.id).length
                        const doneRev = revisions.filter(r => r.evaluation_id === e.id && r.completed).length
                        return (
                          <tr key={e.id} style={{ opacity: 0.8 }}>
                            <td style={tdStyle}>{fmtDate(e.evaluation_date)}</td>
                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{getSubjectName(e.subject_id)}</td>
                            <td style={tdStyle}>{e.topic}</td>
                            <td style={tdStyle}>
                              <span style={{ color: '#aaa' }}>{doneRev}/{totalRev}</span>
                            </td>
                            <td style={tdStyle}>{e.readiness ?? '—'}</td>
                            <td style={tdStyle}>{e.grade ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {typeFilters.revisions && pastRevs.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {groupLabel('📖', 'Révisions')}
                {pastRevs.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', gap: '0.75rem', alignItems: 'center',
                    padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', opacity: 0.75,
                  }}>
                    <span style={{ fontSize: '1rem' }}>{r.completed ? '✅' : '⬜'}</span>
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>{fmtDate(r.revision_date)}</span>
                    {r.details && <span style={{ fontSize: '0.82rem', color: '#bbb' }}>{r.details}</span>}
                  </div>
                ))}
              </div>
            )}

            {typeFilters.events && pastEvts.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {groupLabel('📅', 'Événements')}
                {pastEvts.map(ev => (
                  <div key={ev.id} style={{
                    padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', opacity: 0.75,
                  }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#555' }}>{ev.title}</span>
                    <span style={{ fontSize: '0.8rem', color: '#bbb', marginLeft: '0.6rem' }}>{fmtDate(ev.event_date)}</span>
                  </div>
                ))}
              </div>
            )}

            {typeFilters.reminders && pastRems.length > 0 && (
              <div>
                {groupLabel('🔔', 'Rappels')}
                {pastRems.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', gap: '0.6rem', alignItems: 'center',
                    padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', opacity: 0.75,
                  }}>
                    <span style={{ fontSize: '1rem' }}>✅</span>
                    <span style={{ fontSize: '0.85rem', color: '#555' }}>{r.title}</span>
                    <span style={{ fontSize: '0.78rem', color: '#bbb' }}>{fmtDate(r.deadline_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
