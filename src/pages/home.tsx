import { useEffect, useState } from 'react'
import HomeGreeting from './home/HomeGreeting'
import HomeStreaks from './home/HomeStreaks'
import HomeMissions from './home/HomeMissions'
import HomeHistory from './home/HomeHistory'
import HomeWeekSection from './home/HomeWeekSection'
import { supabase } from '../lib/supabase'
import { generateGreeting } from '../lib/greeting'
import type { Evaluation, Revision } from '../type/index'
import type { Event as AppEvent } from '../type/index'
import { logActivity, updateLastSeen } from '../services/activity'
import { useToast } from '../components/Toast'
import { addPlannerDigoos } from '../services/digoos'
import { fetchMissions as fetchMissionsData, claimMission, type Mission } from '../services/missions'
import { updateStreakRecords } from '../services/progress'
import {
  parseLocalDate,
  getWeekBounds,
  inRange,
  type PastFilter,
} from '../lib/dates'
import { computeDayStreak, computeMonthStreak, computeMonthSteps } from '../lib/streaks'

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

type FilterKey = 'evaluations' | 'revisions' | 'events' | 'reminders'
type TypeFilters = Record<FilterKey, boolean>

// ==================== MAIN COMPONENT ====================

export default function Home() {
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

  useEffect(() => { fetchAll() }, [])

  const handleClaimMission = async (missionId: string) => {
    await claimMission(missionId)
    const data = await fetchMissionsData(['pending', 'claimed'])
    setMissions(data)
    showToast('Mission signalée comme accomplie !')
  }

  const fetchAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const targetId = user?.id
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
    updateLastSeen()

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
    await updateStreakRecords(localDayStreak, localWeekStreak, localMonthStreak, progressData || {})

    setLoading(false)
  }

  // ---- Computed values ----
  const todayStr = new Date().toISOString().split('T')[0]
  const { start: weekStart, end: weekEnd } = getWeekBounds(0)

  // Activity counts by date
  const dateCounts: Record<string, number> = {}
  dailyActivity.forEach(a => {
    const d = a.date.split('T')[0]
    dateCounts[d] = (dateCounts[d] || 0) + 1
  })
  const todayCount = dateCounts[todayStr] || 0

  const dayStreak = computeDayStreak(dateCounts)
  const monthStreak = computeMonthStreak(dailyActivity)
  const monthSteps = computeMonthSteps(dailyActivity, todayStr)

  const weekStreak = progressData?.week_streak || 0
  const digoosThisWeek = progressData?.digoos_this_week || 0

  const weekActivity = dailyActivity.filter(a => inRange(a.date.split('T')[0], weekStart, weekEnd))
  const exercisesThisWeek = weekActivity.length

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

  if (loading) return <p style={{ color: '#888', padding: '2rem', textAlign: 'center' }}>Chargement...</p>

  return (
    <div>
      {/* ==================== 0. SALUTATION ==================== */}
      <HomeGreeting greeting={greeting} />

      {/* ==================== 1. SÉRIES EN COURS ==================== */}
      <HomeStreaks
        progressData={progressData}
        dayStreak={dayStreak}
        weekStreak={weekStreak}
        monthStreak={monthStreak}
        monthSteps={monthSteps}
        digoosThisWeek={digoosThisWeek}
        todayCount={todayCount}
      />

      {/* ==================== 2. SEMAINE EN COURS ==================== */}
      <HomeWeekSection
        evaluations={evaluations} revisions={revisions} events={events}
        reminders={reminders} subjects={subjects}
        weekOffset={0} isCurrentWeek={true}
        digoosThisWeek={digoosThisWeek} exercisesThisWeek={exercisesThisWeek}
        typeFilters={typeFilters} onTypeFilterToggle={toggleFilter}
        onToggleRevision={toggleRevision} onToggleReminder={toggleReminder}
        onUpdateEvalField={updateEvalField}
      />

      {/* ==================== 3. SEMAINES À VENIR ==================== */}
      <HomeWeekSection
        evaluations={evaluations} revisions={revisions} events={events}
        reminders={reminders} subjects={subjects}
        weekOffset={1} isCurrentWeek={false}
        typeFilters={typeFilters} onTypeFilterToggle={toggleFilter}
        onToggleRevision={toggleRevision} onToggleReminder={toggleReminder}
      />
      <HomeWeekSection
        evaluations={evaluations} revisions={revisions} events={events}
        reminders={reminders} subjects={subjects}
        weekOffset={2} isCurrentWeek={false}
        typeFilters={typeFilters} onTypeFilterToggle={toggleFilter}
        onToggleRevision={toggleRevision} onToggleReminder={toggleReminder}
      />

      {/* ==================== 4. MISSIONS ==================== */}
      <HomeMissions missions={missions} onClaim={handleClaimMission} />

      {/* ==================== 5. ÉVÉNEMENTS PASSÉS ==================== */}
      <HomeHistory
        evaluations={evaluations}
        revisions={revisions}
        events={events}
        reminders={reminders}
        subjects={subjects}
        pastFilter={pastFilter}
        onPastFilterChange={setPastFilter}
        typeFilters={typeFilters}
        onTypeFilterToggle={toggleFilter}
      />
    </div>
  )
}
