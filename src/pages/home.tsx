import { useEffect, useState } from 'react'
import { Delta } from '../components/Delta'
import { EmptyState } from '../components/EmptyState'
import { supabase } from '../lib/supabase'
import { generateGreeting } from '../lib/greeting'
import type { Evaluation, Revision } from '../type/index'
import type { Event as AppEvent } from '../type/index'
import { logActivity } from '../services/activity'
import { useToast } from '../components/Toast'
import { addPlannerDigoos } from '../services/digoos'
import { parseLocalDate } from '../lib/dates'
import ProgressCircle from './rewards/ProgressCircle'

// ==================== INTERFACES ====================

interface Mission {
  id: string
  name: string
  description: string
  deadline: string
  reward_type: 'digoos' | 'irl_reward'
  reward_amount: number | null
  status: 'pending' | 'claimed'
}

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
  record_days?: number
  record_weeks?: number
  record_months?: number
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

function formatMissionDeadline(deadline: string): string {
  const d = new Date(deadline)
  const datePart = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const h = d.getHours(), m = d.getMinutes()
  if (h === 0 && m === 0) return datePart.charAt(0).toUpperCase() + datePart.slice(1)
  const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart.charAt(0).toUpperCase() + datePart.slice(1)} à ${timePart}`
}

function toDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekBounds(weekOffset: number): { start: string; end: string } {
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

function getISOWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime())
    / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

function formatWeekRange(weekOffset: number): string {
  const { start, end } = getWeekBounds(weekOffset)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  const startStr = parseLocalDate(start).toLocaleDateString('fr-FR', opts)
  const endStr = parseLocalDate(end).toLocaleDateString('fr-FR', opts)
  return `du lundi ${startStr} au dimanche ${endStr}`
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

// ==================== MAIN COMPONENT ====================

export default function Home({ userId }: { userId?: string }) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState<string>('')
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [typeFilters, setTypeFilters] = useState<TypeFilters>({
    evaluations: true, revisions: true, events: true, reminders: true,
  })
  const [pastFilter, setPastFilter] = useState<PastFilter>('30days')

  useEffect(() => { fetchAll() }, [userId])

  const fetchMissions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const targetId = userId || user?.id
    if (!targetId) return
    const { data } = await supabase.from('missions')
      .select('id, name, description, deadline, reward_type, reward_amount, status')
      .eq('child_id', targetId)
      .in('status', ['pending', 'claimed'])
      .order('deadline')
    if (data) setMissions(data as Mission[])
  }

  const handleClaimMission = async (missionId: string) => {
    await supabase.from('missions').update({ status: 'claimed', claimed_at: new Date().toISOString() }).eq('id', missionId)
    fetchMissions()
    showToast('Mission signalée comme accomplie !')
  }

  const fetchAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const targetId = userId || user?.id
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const twoYearsAgo = `${now.getFullYear() - 2}-01-01`

    const [progressRes, evalsRes, revisionsRes, eventsRes, remindersRes, activityRes, fixedRes, prefsRes, profileRes, missionsRes] =
      await Promise.all([
        supabase.from('progress').select('week_streak, digoos_this_week, digoos, record_days, record_weeks, record_months').eq('user_id', targetId).single(),
        supabase.from('evaluations').select('*').eq('user_id', targetId).order('evaluation_date'),
        supabase.from('revisions').select('*').eq('user_id', targetId).order('revision_date'),
        supabase.from('events').select('*').eq('user_id', targetId).order('event_date'),
        supabase.from('reminders').select('*').eq('user_id', targetId).order('deadline_date'),
        supabase.from('daily_activity').select('date').eq('user_id', targetId).gte('date', twoYearsAgo),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('user_subjects').select('id, subject_id, custom_name, custom_emoji, hidden').eq('user_id', targetId),
        supabase.from('profiles').select('first_name, birth_date, last_seen_at').eq('id', targetId).single(),
        supabase.from('missions').select('id, name, description, deadline, reward_type, reward_amount, status').eq('child_id', targetId).in('status', ['pending', 'claimed']).order('deadline'),
      ])

    if (progressRes.data) setProgressData(progressRes.data as ProgressData)
    if (evalsRes.data) setEvaluations(evalsRes.data)
    if (revisionsRes.data) setRevisions(revisionsRes.data)
    if (eventsRes.data) setEvents(eventsRes.data)
    if (remindersRes.data) setReminders(remindersRes.data as Reminder[])
    if (missionsRes.data) setMissions(missionsRes.data as Mission[])
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
      ? Math.ceil((parseLocalDate(nextEvalItem.evaluation_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined

    const birthDate = profile?.birth_date
    const hasBirthday = birthDate
      ? parseLocalDate(birthDate).getMonth() === now.getMonth() && parseLocalDate(birthDate).getDate() === now.getDate()
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

    // Mise à jour des records de séries
    const actData = (activityRes.data as DailyActivity[] | null) || []
    const localDateCounts: Record<string, number> = {}
    actData.forEach(a => {
      const d = a.date.split('T')[0]
      localDateCounts[d] = (localDateCounts[d] || 0) + 1
    })
    let localDayStreak = 0
    for (let i = 0; i < 366; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      const count = localDateCounts[ds] || 0
      if (i === 0 && count > 0) localDayStreak++
      else if (i > 0 && count >= 3) localDayStreak++
      else if (i > 0) break
    }
    let localMonthStreak = 0
    for (let i = 0; i < 24; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - i, 1)
      const prefix = d.toISOString().substring(0, 7)
      if (actData.some(a => a.date.startsWith(prefix))) localMonthStreak++
      else break
    }
    const localWeekStreak = (progressRes.data as ProgressData | null)?.week_streak || 0
    const updateRecords = async (dayS: number, weekS: number, monthS: number) => {
      const updates: Record<string, number> = {}
      if (dayS > (progressData?.record_days || 0)) updates.record_days = dayS
      if (weekS > (progressData?.record_weeks || 0)) updates.record_weeks = weekS
      if (monthS > (progressData?.record_months || 0)) updates.record_months = monthS
      if (Object.keys(updates).length > 0 && targetId) {
        await supabase.from('progress').update(updates).eq('user_id', targetId)
      }
    }
    await updateRecords(localDayStreak, localWeekStreak, localMonthStreak)

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
  const activeWeeksThisMonth = new Set(monthAct.map(a => getISOWeekNumber(parseLocalDate(a.date.split('T')[0])))).size
  const monthSteps = Math.min(activeDaysThisMonth, 15) + Math.min(activeWeeksThisMonth, 2) + Math.min(monthAct.length, 15)

  const weekStreak = progressData?.week_streak || 0
  const digoosThisWeek = progressData?.digoos_this_week || 0
  const weekColor = digoosThisWeek < 100 ? '#e63946' : digoosThisWeek < 1000 ? '#a5d6a7' : '#2a9d8f'

  const weekActivity = dailyActivity.filter(a => inRange(a.date.split('T')[0], weekStart, weekEnd))
  const exercisesThisWeek = weekActivity.length
  const currentWeekNo = getISOWeekNumber(parseLocalDate(weekStart))

  const getSubjectName = (id: unknown) =>
    subjects.find(s => String(s.id) === String(id))?.name || '?'

  // ---- Mutations ----
  const toggleFilter = (key: FilterKey) =>
    setTypeFilters(prev => ({ ...prev, [key]: !prev[key] }))

  const updateEvalField = async (id: string, field: 'readiness' | 'grade', value: string) => {
    const numVal = value === '' ? null : parseFloat(value)
    await supabase.from('evaluations').update({ [field]: numVal }).eq('id', id)
    await logActivity({ action_type: 'grade_updated', metadata: { field } })
    if (numVal !== null) {
      if (field === 'grade') await addPlannerDigoos('grade_received')
      else await addPlannerDigoos('eval_added')
    }
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
            background: typeFilters[key] ? '#2a9d8f' : 'var(--color-border)',
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
  const renderWeekSection = (start: string, end: string, weekNo: number, isCurrentWeek: boolean, weekOffset: number) => {
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
              background: '#fff8e0', color: '#b8860b', fontSize: '0.78rem', fontWeight: 'bold',
            }}>
              {digoosThisWeek} <Delta size={16} />
            </span>
          ) : undefined
        )}

        <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.75rem' }}>
          {formatWeekRange(weekOffset)}
        </div>

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
                  <tr style={{ background: 'var(--color-background)' }}>
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
          <div style={{ flex: 1, textAlign: 'center' }}>
            <ProgressCircle
              value={todayCount} max={3} streak={dayStreak}
              label="Jours" color="#2a9d8f"
            />
            <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '0.1rem' }}>
              Ton record : {Math.max(dayStreak, progressData?.record_days || 0)} jour{Math.max(dayStreak, progressData?.record_days || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <ProgressCircle
              value={digoosThisWeek} max={1000} streak={weekStreak}
              label="Semaines" color={weekColor}
            />
            <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '0.1rem' }}>
              Ton record : {Math.max(weekStreak, progressData?.record_weeks || 0)} semaine{Math.max(weekStreak, progressData?.record_weeks || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <ProgressCircle
              value={monthSteps} max={32} streak={monthStreak}
              label="Mois" color="#e9c46a"
            />
            <div style={{ fontSize: '0.7rem', color: '#bbb', marginTop: '0.1rem' }}>
              Ton record : {Math.max(monthStreak, progressData?.record_months || 0)} mois
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 2. SEMAINE EN COURS ==================== */}
      {renderWeekSection(weekStart, weekEnd, currentWeekNo, true, 0)}

      {/* ==================== 3. SEMAINES À VENIR ==================== */}
      {renderWeekSection(w1Start, w1End, getISOWeekNumber(parseLocalDate(w1Start)), false, 1)}
      {renderWeekSection(w2Start, w2End, getISOWeekNumber(parseLocalDate(w2Start)), false, 2)}

      {/* ==================== 4. MISSIONS ==================== */}
      {missions.length > 0 && (
        <div style={cardStyle}>
          {sectionHeader('🎯 Missions')}
          {missions.map(m => (
            <div key={m.id} style={{
              borderLeft: '4px solid #e76f51',
              background: '#fff8f5',
              borderRadius: '0.75rem',
              padding: '0.85rem 1rem',
              marginBottom: '0.75rem',
            }}>
              <div style={{ fontWeight: 'bold', color: '#e76f51', fontSize: '0.95rem' }}>{m.name}</div>
              {m.description && (
                <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.2rem' }}>{m.description}</div>
              )}
              <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.3rem' }}>
                Deadline : {formatMissionDeadline(m.deadline)}
              </div>
              {m.reward_type === 'digoos' && m.reward_amount !== null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', background: '#fff8e0', color: '#b8860b', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold' }}>
                  Récompense : {m.reward_amount} <Delta size={14} />
                </div>
              )}
              {m.reward_type === 'irl_reward' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', background: 'var(--color-background)', color: '#2a9d8f', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold' }}>
                  🎁 Récompense IRL
                </div>
              )}
              {m.status === 'pending' ? (
                <button onClick={() => handleClaimMission(m.id)} style={{ marginTop: '0.5rem', padding: '0.4rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', width: '100%' }}>
                  ✅ Mission accomplie !
                </button>
              ) : (
                <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.75rem', background: '#fff8e0', color: '#b8860b', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 'bold', display: 'inline-block' }}>
                  ⏳ En attente de validation parent
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ==================== 5. ÉVÉNEMENTS PASSÉS ==================== */}
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
