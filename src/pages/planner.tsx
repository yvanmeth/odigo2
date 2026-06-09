import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Evaluation, Revision } from '../type/index'
import type { Event as AppEvent } from '../type/index'
import { logActivity } from '../services/activity'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useToast } from '../components/Toast'
import { EmptyState } from '../components/EmptyState'

// ==================== TYPES ====================

interface SubjectOption {
  id: number | string
  name: string
  emoji?: string | null
  isCustom: boolean
}

type Tab = 'evaluations' | 'revisions' | 'events' | 'reminders'
type PlannerView = 'list' | 'calendar'
type CalendarView = 'day' | 'week' | 'month'

interface Reminder {
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

interface CalendarItem {
  id: string
  type: 'evaluation' | 'revision' | 'event' | 'reminder'
  title: string
  date: string
  startTime?: string
  endTime?: string
  color: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any
}

// ==================== CONSTANTS ====================

const ODIGO_REMIND_LABELS: Record<string, string> = {
  each_login: 'À chaque connexion',
  one_day: 'Un jour avant',
  one_week: 'Une semaine avant',
  never: 'Jamais',
}

// ==================== HELPERS ====================

const formatDate = (d: string) => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const toDateStr = (d: Date): string => d.toISOString().split('T')[0]

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

const getWeekDays = (date: Date): Date[] => {
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

const getMonthGrid = (date: Date): Date[] => {
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

const formatDateHeader = (date: Date, view: CalendarView): string => {
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

const parseTime = (t: string): { h: number; m: number } => {
  const [hStr, mStr] = t.split(':')
  return { h: parseInt(hStr, 10), m: parseInt(mStr, 10) }
}

const buildCalendarItems = (
  evals: Evaluation[],
  revs: Revision[],
  evts: AppEvent[],
  rems: Reminder[],
  subs: SubjectOption[]
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
  return items
}

// ==================== COMPONENT ====================

export default function Planner({ userId, isParent: _isParent }: { userId?: string; isParent?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('evaluations')
  const [view, setPlannerView] = useState<PlannerView>('list')
  const [calView, setCalView] = useState<CalendarView>('week')
  const [calDate, setCalDate] = useState(new Date())
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const { showToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null)
  const [editPopoverPos, setEditPopoverPos] = useState({ x: 0, y: 0 })
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Form — évaluations
  const [evalDate, setEvalDate] = useState('')
  const [evalSubject, setEvalSubject] = useState('')
  const [evalTopic, setEvalTopic] = useState('')
  const [evalReadiness, setEvalReadiness] = useState('')
  const [evalGrade, setEvalGrade] = useState('')
  const [evalStartTime, setEvalStartTime] = useState('')
  const [evalEndTime, setEvalEndTime] = useState('')

  // Form — révisions
  const [revDate, setRevDate] = useState('')
  const [revStartTime, setRevStartTime] = useState('')
  const [revEndTime, setRevEndTime] = useState('')
  const [revDetails, setRevDetails] = useState('')
  const [revEvalId, setRevEvalId] = useState('')

  // Form — événements
  const [evtTitle, setEvtTitle] = useState('')
  const [evtDate, setEvtDate] = useState('')
  const [evtStartTime, setEvtStartTime] = useState('')
  const [evtEndTime, setEvtEndTime] = useState('')
  const [evtDetails, setEvtDetails] = useState('')
  const [evtRepeat, setEvtRepeat] = useState(false)

  // Form — rappels
  const [remTitle, setRemTitle] = useState('')
  const [remDescription, setRemDescription] = useState('')
  const [remDeadlineDate, setRemDeadlineDate] = useState('')
  const [remDeadlineTime, setRemDeadlineTime] = useState('')
  const [remOdigoRemind, setRemOdigoRemind] = useState<Reminder['odigo_remind']>('never')

  useEffect(() => { fetchAll() }, [userId])

  useEffect(() => {
    if (!gridRef.current || view !== 'calendar') return
    if (calView !== 'day' && calView !== 'week') return
    const startHour = calView === 'day' ? 6 : 7
    const pxPerHour = calView === 'day' ? 60 : 40
    const now = new Date()
    const scrollTo = Math.max(0, (now.getHours() - startHour - 1) * pxPerHour)
    gridRef.current.scrollTop = scrollTo
  }, [view, calView, calDate])

  const fetchAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const targetId = userId || user?.id
    const [evalsRes, revsRes, eventsRes, fixedRes, remindersRes, prefsRes] = await Promise.all([
      supabase.from('evaluations').select('*').eq('user_id', targetId).order('evaluation_date'),
      supabase.from('revisions').select('*').eq('user_id', targetId).order('revision_date'),
      supabase.from('events').select('*').eq('user_id', targetId).order('event_date'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('reminders').select('*').eq('user_id', targetId).order('deadline_date'),
      supabase.from('user_subjects').select('*').eq('user_id', targetId),
    ])
    if (evalsRes.data) setEvaluations(evalsRes.data)
    if (revsRes.data) setRevisions(revsRes.data)
    if (eventsRes.data) setEvents(eventsRes.data)
    if (remindersRes.data) setReminders(remindersRes.data)

    const userPrefs = prefsRes.data || []
    const hiddenFixedIds = userPrefs.filter(p => p.subject_id && p.hidden).map(p => p.subject_id)
    const visibleFixed: SubjectOption[] = (fixedRes.data || [])
      .filter((s: { id: number; name: string }) => !hiddenFixedIds.includes(s.id))
      .map((s: { id: number; name: string }) => ({ id: s.id, name: s.name, emoji: null, isCustom: false }))
    const customSubjects: SubjectOption[] = userPrefs
      .filter(p => p.custom_name && !p.hidden)
      .map(p => ({ id: p.id, name: p.custom_name, emoji: p.custom_emoji || '📚', isCustom: true }))
    setSubjects([...visibleFixed, ...customSubjects])
    setLoading(false)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null) }

  // ---- Évaluations ----
  const handleEditEval = (e: Evaluation) => {
    setEvalDate(e.evaluation_date); setEvalSubject(String(e.subject_id)); setEvalTopic(e.topic)
    setEvalReadiness(e.readiness !== null && e.readiness !== undefined ? String(e.readiness) : '')
    setEvalGrade(e.grade !== null && e.grade !== undefined ? String(e.grade) : '')
    setEvalStartTime(e.start_time || ''); setEvalEndTime(e.end_time || '')
    setEditingId(e.id); setShowForm(true)
  }

  const handleSaveEval = async () => {
    if (!evalDate || !evalSubject || !evalTopic) return
    const selectedSubject = subjects.find(s => String(s.id) === evalSubject)
    const payload = {
      evaluation_date: evalDate,
      subject_id: selectedSubject?.isCustom ? evalSubject : parseInt(evalSubject),
      topic: evalTopic,
      readiness: evalReadiness ? parseFloat(evalReadiness) : null,
      grade: evalGrade ? parseFloat(evalGrade) : null,
      start_time: evalStartTime || null, end_time: evalEndTime || null,
    }
    if (editingId) {
      await supabase.from('evaluations').update(payload).eq('id', editingId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('evaluations').insert({ ...payload, user_id: user?.id })
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'evaluation' } })
      showToast('Évaluation ajoutée')
    }
    setEvalDate(''); setEvalSubject(''); setEvalTopic(''); setEvalReadiness('')
    setEvalGrade(''); setEvalStartTime(''); setEvalEndTime('')
    closeForm(); fetchAll()
  }

  // ---- Révisions ----
  const handleEditRev = (r: Revision) => {
    setRevDate(r.revision_date); setRevStartTime(r.start_time || ''); setRevEndTime(r.end_time || '')
    setRevDetails(r.details || ''); setRevEvalId(r.evaluation_id || '')
    setEditingId(r.id); setShowForm(true)
  }

  const handleSaveRev = async () => {
    if (!revDate) return
    const payload = {
      revision_date: revDate, start_time: revStartTime || null, end_time: revEndTime || null,
      details: revDetails || null, evaluation_id: revEvalId || null,
    }
    if (editingId) {
      await supabase.from('revisions').update(payload).eq('id', editingId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('revisions').insert({ ...payload, user_id: user?.id, completed: false })
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'revision' } })
      showToast('Révision ajoutée')
    }
    setRevDate(''); setRevStartTime(''); setRevEndTime(''); setRevDetails(''); setRevEvalId('')
    closeForm(); fetchAll()
  }

  // ---- Événements ----
  const handleEditEvt = (ev: AppEvent) => {
    setEvtTitle(ev.title); setEvtDate(ev.event_date); setEvtStartTime(ev.start_time || '')
    setEvtEndTime(ev.end_time || ''); setEvtDetails(ev.details || ''); setEvtRepeat(false)
    setEditingId(ev.id); setShowForm(true)
  }

  const handleSaveEvt = async () => {
    if (!evtTitle || !evtDate) return
    if (!editingId && evtRepeat) {
      const { data: { user } } = await supabase.auth.getUser()
      const dates: string[] = []
      const cur = new Date(evtDate)
      const end = new Date('2028-12-31')
      while (cur <= end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 7) }
      await supabase.from('events').insert(dates.map(d => ({
        user_id: user?.id, title: evtTitle, event_date: d,
        start_time: evtStartTime || null, end_time: evtEndTime || null, details: evtDetails || null,
      })))
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'event_repeat' } })
      showToast(`${dates.length} événements récurrents ajoutés`)
    } else {
      const payload = {
        title: evtTitle, event_date: evtDate,
        start_time: evtStartTime || null, end_time: evtEndTime || null, details: evtDetails || null,
      }
      if (editingId) {
        await supabase.from('events').update(payload).eq('id', editingId)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('events').insert({ ...payload, user_id: user?.id })
        await logActivity({ action_type: 'planner_entry', metadata: { type: 'event' } })
        showToast('Événement ajouté')
      }
    }
    setEvtTitle(''); setEvtDate(''); setEvtStartTime(''); setEvtEndTime(''); setEvtDetails(''); setEvtRepeat(false)
    closeForm(); fetchAll()
  }

  // ---- Rappels ----
  const handleEditReminder = (r: Reminder) => {
    setRemTitle(r.title); setRemDescription(r.description || ''); setRemDeadlineDate(r.deadline_date)
    setRemDeadlineTime(r.deadline_time || ''); setRemOdigoRemind(r.odigo_remind)
    setEditingId(r.id); setShowForm(true)
  }

  const handleSaveReminder = async () => {
    if (!remTitle || !remDeadlineDate) return
    const payload = {
      title: remTitle, description: remDescription || null, deadline_date: remDeadlineDate,
      deadline_time: remDeadlineTime || null, odigo_remind: remOdigoRemind,
    }
    if (editingId) {
      const { error } = await supabase.from('reminders').update(payload).eq('id', editingId)
      if (error) console.error('Reminder update error:', error)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reminders').insert({
        user_id: user?.id, ...payload, completed: false,
      })
      if (error) { console.error('Reminder insert error:', error); showToast('Une erreur est survenue', 'error') }
      else { await logActivity({ action_type: 'planner_entry', metadata: { type: 'reminder' } }); showToast('Rappel ajouté') }
    }
    setRemTitle(''); setRemDescription(''); setRemDeadlineDate(''); setRemDeadlineTime(''); setRemOdigoRemind('never')
    closeForm(); fetchAll()
  }

  const handleDelete = async (table: string, id: string) => {
    await supabase.from(table).delete().eq('id', id)
    showToast('Supprimé', 'info')
    fetchAll()
  }

  const navigateCal = (dir: -1 | 1) => {
    setCalDate(prev => {
      const d = new Date(prev)
      if (calView === 'day') d.setDate(d.getDate() + dir)
      else if (calView === 'week') d.setDate(d.getDate() + dir * 7)
      else { d.setMonth(d.getMonth() + dir); d.setDate(1) }
      return d
    })
  }

  const handleCalendarEdit = (item: CalendarItem) => {
    setEditingItem(null)
    setPlannerView('list')
    if (item.type === 'evaluation') { setActiveTab('evaluations'); handleEditEval(item.raw as Evaluation) }
    else if (item.type === 'revision') { setActiveTab('revisions'); handleEditRev(item.raw as Revision) }
    else if (item.type === 'event') { setActiveTab('events'); handleEditEvt(item.raw as AppEvent) }
    else if (item.type === 'reminder') { setActiveTab('reminders'); handleEditReminder(item.raw as Reminder) }
  }

  const handleCalendarDelete = (item: CalendarItem) => {
    const tableMap: Record<CalendarItem['type'], string> = {
      evaluation: 'evaluations', revision: 'revisions', event: 'events', reminder: 'reminders',
    }
    handleDelete(tableMap[item.type], item.id)
    setEditingItem(null)
  }

  const getSubjectName = (id: unknown) => subjects.find(s => String(s.id) === String(id))?.name || '?'

  const calendarItems = buildCalendarItems(evaluations, revisions, events, reminders, subjects)

  // ---- Styles partagés ----
  const tabStyle = (tab: Tab) => ({
    padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' as const,
    background: activeTab === tab ? '#2a9d8f' : '#e0f0ee',
    color: activeTab === tab ? 'white' : '#2a9d8f',
    fontWeight: activeTab === tab ? 'bold' : 'normal', fontSize: '0.9rem',
  })

  const inputStyle = {
    width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd',
    fontSize: '0.9rem', boxSizing: 'border-box' as const, marginBottom: '0.75rem',
  }

  const cardStyle = {
    background: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.75rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  const actionBtnStyle = {
    background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem',
    padding: '0.3rem 0.6rem', cursor: 'pointer' as const, fontSize: '0.85rem',
  }

  const navBtnStyle = {
    padding: '0.35rem 0.65rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' as const,
    background: '#e0f0ee', color: '#2a9d8f', fontSize: '0.9rem',
  }

  const chipClick = (item: CalendarItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingItem(item)
    setEditPopoverPos({ x: Math.min(e.clientX, window.innerWidth - 210), y: Math.min(e.clientY + 8, window.innerHeight - 130) })
  }

  // ---- Vue Jour ----
  const renderDayView = () => {
    const S = 6, E = 22, PPH = 60
    const totalH = (E - S) * PPH
    const hours = Array.from({ length: E - S + 1 }, (_, i) => S + i)
    const dayStr = toDateStr(calDate)
    const dayItems = calendarItems.filter(i => i.date === dayStr)
    const allDay = dayItems.filter(i => !i.startTime)
    const timed = dayItems.filter(i => !!i.startTime)
    const now = new Date()
    const isToday = isSameDay(calDate, now)
    const nowTop = isToday ? (now.getHours() - S) * PPH + now.getMinutes() : -1

    return (
      <div>
        {allDay.length > 0 && (
          <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '0.3rem' }}>Toute la journée</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {allDay.map(item => (
                <div key={item.id} onClick={e => chipClick(item, e)}
                  style={{ background: item.color, color: 'white', borderRadius: '0.4rem', padding: '0.3rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={gridRef} style={{ overflowY: 'auto', maxHeight: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', height: `${totalH}px`, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              {hours.map(h => (
                <div key={h} style={{ position: 'absolute', top: `${(h - S) * PPH - 8}px`, right: '6px', fontSize: '0.68rem', color: '#ccc', userSelect: 'none' }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            <div style={{ position: 'relative', borderLeft: '1px solid #f0f0f0' }}>
              {hours.map(h => (
                <div key={`hl-${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH}px`, left: 0, right: 0, borderTop: h > S ? '1px solid #f0f0f0' : 'none' }} />
              ))}
              {hours.slice(0, hours.length - 1).map(h => (
                <div key={`hh-${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH + 30}px`, left: 0, right: 0, borderTop: '1px dashed #f8f8f8' }} />
              ))}
              {isToday && nowTop >= 0 && nowTop <= totalH && (
                <div style={{ position: 'absolute', top: `${nowTop}px`, left: 0, right: 0, borderTop: '2px solid #e63946', zIndex: 10 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e63946', position: 'absolute', left: '-4px', top: '-4px' }} />
                </div>
              )}
              {timed.map(item => {
                const { h, m } = parseTime(item.startTime!)
                const top = (h - S) * PPH + m
                let ht = 30
                if (item.endTime) {
                  const end = parseTime(item.endTime)
                  ht = Math.max(30, end.h * 60 + end.m - h * 60 - m)
                }
                return (
                  <div key={item.id} onClick={e => chipClick(item, e)} style={{
                    position: 'absolute', top: `${top}px`, left: '2px', right: '4px', height: `${ht}px`,
                    background: item.color, borderRadius: '0.4rem', padding: '0.2rem 0.5rem',
                    cursor: 'pointer', overflow: 'hidden', color: 'white', fontSize: '0.78rem', zIndex: 5,
                  }}>
                    <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                    {ht >= 40 && <div style={{ opacity: 0.85, fontSize: '0.72rem' }}>{item.startTime}{item.endTime ? `–${item.endTime}` : ''}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- Vue Semaine ----
  const renderWeekView = () => {
    const S = 7, E = 21, PPH = 40
    const totalH = (E - S) * PPH
    const hours = Array.from({ length: E - S }, (_, i) => S + i)
    const days = getWeekDays(calDate)
    const todayStr = toDateStr(new Date())
    const now = new Date()

    return (
      <div>
        {/* Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid #e0f0ee' }}>
          <div />
          {days.map((day, i) => {
            const ds = toDateStr(day)
            const isToday = ds === todayStr
            const isWE = i >= 5
            return (
              <div key={i} style={{ textAlign: 'center', padding: '0.4rem 0.2rem', background: isWE ? '#fafafa' : 'white', borderLeft: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '0.68rem', color: isToday ? '#2a9d8f' : '#999', fontWeight: isToday ? 'bold' : 'normal', textTransform: 'uppercase' }}>
                  {day.toLocaleDateString('fr-CH', { weekday: 'short' })}
                </div>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: isToday ? '#2a9d8f' : 'transparent', color: isToday ? 'white' : '#333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', fontWeight: 'bold' }}>
                  {day.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Toute la journée */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid #e0f0ee', background: '#fafafa', minHeight: '24px' }}>
          <div style={{ fontSize: '0.6rem', color: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>tj</div>
          {days.map((day, i) => {
            const ds = toDateStr(day)
            const items = calendarItems.filter(it => it.date === ds && !it.startTime)
            return (
              <div key={i} style={{ borderLeft: '1px solid #f0f0f0', background: i >= 5 ? '#fafafa' : 'white', padding: '2px' }}>
                {items.slice(0, 3).map(item => (
                  <div key={item.id} onClick={e => chipClick(item, e)} style={{ background: item.color, color: 'white', borderRadius: '0.2rem', padding: '0.1rem 0.3rem', fontSize: '0.65rem', marginBottom: '1px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                ))}
                {items.length > 3 && <div style={{ fontSize: '0.6rem', color: '#888' }}>+{items.length - 3}</div>}
              </div>
            )
          })}
        </div>

        {/* Grille horaire */}
        <div ref={gridRef} style={{ overflowY: 'auto', maxHeight: '600px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', height: `${totalH}px` }}>
            {/* Labels heure */}
            <div style={{ position: 'relative' }}>
              {hours.map(h => (
                <div key={h} style={{ position: 'absolute', top: `${(h - S) * PPH - 8}px`, right: '6px', fontSize: '0.62rem', color: '#ccc' }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {/* Colonnes jours */}
            {days.map((day, colIdx) => {
              const ds = toDateStr(day)
              const timed = calendarItems.filter(it => it.date === ds && !!it.startTime)
              const isWE = colIdx >= 5
              const isTodayCol = ds === todayStr
              const nowTop = isTodayCol ? (now.getHours() - S) * PPH + Math.floor(now.getMinutes() * PPH / 60) : -1
              return (
                <div key={colIdx} style={{ position: 'relative', borderLeft: '1px solid #f0f0f0', background: isWE ? '#fafafa' : 'white' }}>
                  {hours.map(h => (
                    <div key={`l${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH}px`, left: 0, right: 0, borderTop: '1px solid #f0f0f0' }} />
                  ))}
                  {hours.map(h => (
                    <div key={`m${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH + 20}px`, left: 0, right: 0, borderTop: '1px dashed #f8f8f8' }} />
                  ))}
                  {nowTop >= 0 && nowTop <= totalH && (
                    <div style={{ position: 'absolute', top: `${nowTop}px`, left: 0, right: 0, borderTop: '2px solid #e63946', zIndex: 10 }} />
                  )}
                  {timed.map(item => {
                    const { h, m } = parseTime(item.startTime!)
                    const top = (h - S) * PPH + Math.floor(m * PPH / 60)
                    let ht = 20
                    if (item.endTime) {
                      const end = parseTime(item.endTime)
                      ht = Math.max(20, Math.floor((end.h * 60 + end.m - h * 60 - m) * PPH / 60))
                    }
                    return (
                      <div key={item.id} onClick={e => chipClick(item, e)} style={{
                        position: 'absolute', top: `${top}px`, left: '1px', right: '1px', height: `${ht}px`,
                        background: item.color, borderRadius: '0.25rem', padding: '0.1rem 0.3rem',
                        cursor: 'pointer', overflow: 'hidden', color: 'white', fontSize: '0.65rem', zIndex: 5,
                      }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ---- Vue Mois ----
  const renderMonthView = () => {
    const grid = getMonthGrid(calDate)
    const currentMonth = calDate.getMonth()
    const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f0faf8' }}>
          {DAY_NAMES.map((name, i) => (
            <div key={name} style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 'bold', color: i >= 5 ? '#888' : '#2a9d8f' }}>
              {name}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {grid.map((day, idx) => {
            const ds = toDateStr(day)
            const isCurrentMonth = day.getMonth() === currentMonth
            const isToday = isSameDay(day, new Date())
            const isWE = idx % 7 >= 5
            const dayItems = calendarItems.filter(i => i.date === ds)
            const showAll = expandedDay === ds
            const displayed = showAll ? dayItems : dayItems.slice(0, 3)
            const extra = dayItems.length - 3

            return (
              <div key={idx} style={{
                border: '1px solid #f0f0f0', minHeight: '90px', padding: '0.3rem',
                background: isWE ? '#fafafa' : 'white', opacity: isCurrentMonth ? 1 : 0.4,
              }}>
                <div style={{ marginBottom: '0.2rem' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: isToday ? '#2a9d8f' : 'transparent',
                    color: isToday ? 'white' : '#333',
                    fontSize: '0.75rem', fontWeight: isToday ? 'bold' : 'normal',
                  }}>
                    {day.getDate()}
                  </span>
                </div>
                {displayed.map(item => (
                  <div key={item.id} onClick={e => chipClick(item, e)} style={{
                    background: item.color, color: 'white', borderRadius: '0.3rem',
                    padding: '0.1rem 0.35rem', fontSize: '0.68rem', marginBottom: '0.1rem',
                    cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {item.startTime && <span style={{ opacity: 0.85, marginRight: '0.2rem' }}>{item.startTime.slice(0, 5)}</span>}
                    {item.title}
                  </div>
                ))}
                {!showAll && extra > 0 && (
                  <div onClick={e => { e.stopPropagation(); setExpandedDay(ds) }} style={{ fontSize: '0.65rem', color: '#888', cursor: 'pointer', fontWeight: 'bold' }}>
                    +{extra} autres
                  </div>
                )}
                {showAll && extra > 0 && (
                  <div onClick={e => { e.stopPropagation(); setExpandedDay(null) }} style={{ fontSize: '0.65rem', color: '#888', cursor: 'pointer' }}>
                    Voir moins ▲
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  const viewToggle = (v: PlannerView) => ({
    padding: '0.45rem 0.85rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' as const,
    background: view === v ? '#2a9d8f' : 'transparent',
    color: view === v ? 'white' : '#2a9d8f',
    fontSize: '0.85rem', fontWeight: view === v ? 'bold' : 'normal',
  })

  const calViewToggle = (v: CalendarView) => ({
    padding: '0.35rem 0.65rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' as const,
    background: calView === v ? '#2a9d8f' : 'transparent',
    color: calView === v ? 'white' : '#2a9d8f',
    fontSize: '0.8rem', fontWeight: calView === v ? 'bold' : 'normal',
  })

  return (
    <div>
      {/* ── Barre supérieure ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '0.2rem', background: '#f0faf8', borderRadius: '0.5rem', padding: '0.2rem', marginRight: '0.5rem' }}>
          <button style={viewToggle('list')} onClick={() => setPlannerView('list')}>📋 Liste</button>
          <button style={viewToggle('calendar')} onClick={() => setPlannerView('calendar')}>📅 Calendrier</button>
        </div>
        {view === 'list' && (
          <>
            <button style={tabStyle('evaluations')} onClick={() => { setActiveTab('evaluations'); closeForm() }}>📝 Évaluations</button>
            <button style={tabStyle('revisions')} onClick={() => { setActiveTab('revisions'); closeForm() }}>📖 Révisions</button>
            <button style={tabStyle('events')} onClick={() => { setActiveTab('events'); closeForm() }}>📅 Événements</button>
            <button style={tabStyle('reminders')} onClick={() => { setActiveTab('reminders'); closeForm() }}>✅ Rappels</button>
          </>
        )}
      </div>

      {/* ── Vue Calendrier ── */}
      {view === 'calendar' && (
        <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #e0f0ee', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button onClick={() => navigateCal(-1)} style={navBtnStyle}>←</button>
              <button onClick={() => setCalDate(new Date())} style={navBtnStyle}>Aujourd'hui</button>
              <button onClick={() => navigateCal(1)} style={navBtnStyle}>→</button>
            </div>
            <div style={{ flex: 1, fontWeight: 'bold', color: '#333', fontSize: '0.9rem', textAlign: 'center' }}>
              {formatDateHeader(calDate, calView)}
            </div>
            <div style={{ display: 'flex', gap: '0.2rem', background: '#f0faf8', borderRadius: '0.5rem', padding: '0.2rem' }}>
              <button style={calViewToggle('day')} onClick={() => setCalView('day')}>Jour</button>
              <button style={calViewToggle('week')} onClick={() => setCalView('week')}>Semaine</button>
              <button style={calViewToggle('month')} onClick={() => setCalView('month')}>Mois</button>
            </div>
          </div>
          {calView === 'day' && renderDayView()}
          {calView === 'week' && renderWeekView()}
          {calView === 'month' && renderMonthView()}
        </div>
      )}

      {/* ── Vue Liste ── */}
      {view === 'list' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <button
              onClick={() => { if (showForm) { closeForm() } else { setShowForm(true) } }}
              style={{ padding: '0.6rem 1.2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {showForm ? '✕ Annuler' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Plus size={16} />Ajouter</span>}
            </button>
          </div>

          {/* Formulaire évaluations */}
          {showForm && activeTab === 'evaluations' && (
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>{editingId ? "Modifier l'évaluation" : 'Nouvelle évaluation'}</h3>
              <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)} style={inputStyle} />
              <select value={evalSubject} onChange={e => setEvalSubject(e.target.value)} style={inputStyle}>
                <option value="">Choisir une matière</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.emoji ? `${s.emoji} ${s.name}` : s.name}</option>)}
              </select>
              <input type="text" placeholder="Sujet / Chapitre" value={evalTopic} onChange={e => setEvalTopic(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Note attendue (0-6)" min="0" max="6" step="0.5" value={evalReadiness} onChange={e => setEvalReadiness(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="Note obtenue (0-6)" min="0" max="6" step="0.5" value={evalGrade} onChange={e => setEvalGrade(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="time" value={evalStartTime} onChange={e => setEvalStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
                <input type="time" value={evalEndTime} onChange={e => setEvalEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
              </div>
              <button onClick={handleSaveEval} style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          )}

          {/* Formulaire révisions */}
          {showForm && activeTab === 'revisions' && (
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>{editingId ? 'Modifier la révision' : 'Nouvelle révision'}</h3>
              <input type="date" value={revDate} onChange={e => setRevDate(e.target.value)} style={inputStyle} />
              <select value={revEvalId} onChange={e => setRevEvalId(e.target.value)} style={inputStyle}>
                <option value="">Lier à une évaluation (optionnel)</option>
                {evaluations.map(e => <option key={e.id} value={e.id}>{formatDate(e.evaluation_date)} — {getSubjectName(e.subject_id)} — {e.topic}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="time" value={revStartTime} onChange={e => setRevStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
                <input type="time" value={revEndTime} onChange={e => setRevEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
              </div>
              <textarea placeholder="Détails (optionnel)" value={revDetails} onChange={e => setRevDetails(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
              <button onClick={handleSaveRev} style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          )}

          {/* Formulaire événements */}
          {showForm && activeTab === 'events' && (
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>{editingId ? "Modifier l'événement" : 'Nouvel événement'}</h3>
              <input type="text" placeholder="Titre" value={evtTitle} onChange={e => setEvtTitle(e.target.value)} style={inputStyle} />
              <input type="date" value={evtDate} onChange={e => setEvtDate(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="time" value={evtStartTime} onChange={e => setEvtStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
                <input type="time" value={evtEndTime} onChange={e => setEvtEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
              </div>
              <textarea placeholder="Détails (optionnel)" value={evtDetails} onChange={e => setEvtDetails(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: editingId ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={evtRepeat} onChange={e => setEvtRepeat(e.target.checked)} disabled={!!editingId} />
                <span style={{ color: editingId ? '#ccc' : '#555', fontSize: '0.9rem' }}>🔁 Répéter chaque semaine (jusqu'au 31/12/2028)</span>
              </label>
              <button onClick={handleSaveEvt} style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          )}

          {/* Formulaire rappels */}
          {showForm && activeTab === 'reminders' && (
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>{editingId ? 'Modifier le rappel' : 'Nouveau rappel'}</h3>
              <input type="text" placeholder="Titre" value={remTitle} onChange={e => setRemTitle(e.target.value)} style={inputStyle} />
              <textarea placeholder="Description (optionnel)" value={remDescription} onChange={e => setRemDescription(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="date" value={remDeadlineDate} onChange={e => setRemDeadlineDate(e.target.value)} style={{ ...inputStyle, width: '60%' }} />
                <input type="time" value={remDeadlineTime} onChange={e => setRemDeadlineTime(e.target.value)} style={{ ...inputStyle, width: '40%' }} />
              </div>
              <select value={remOdigoRemind} onChange={e => setRemOdigoRemind(e.target.value as Reminder['odigo_remind'])} style={inputStyle}>
                <option value="each_login">À chaque connexion</option>
                <option value="one_day">Un jour avant</option>
                <option value="one_week">Une semaine avant</option>
                <option value="never">Jamais</option>
              </select>
              <button onClick={handleSaveReminder} style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                {editingId ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          )}

          {/* Liste évaluations */}
          {activeTab === 'evaluations' && (
            <div>
              {evaluations.length === 0 && <EmptyState emoji="📝" title="Aucune évaluation" subtitle="Ajoute ta première évaluation pour commencer." actionLabel="+ Ajouter" onAction={() => setShowForm(true)} />}
              {evaluations.map(e => (
                <div key={e.id} style={cardStyle}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{getSubjectName(e.subject_id)} — {e.topic}</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>{formatDate(e.evaluation_date)}{e.start_time ? ` · ${e.start_time}` : ''}</div>
                    {e.readiness !== null && e.readiness !== undefined && <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>Note attendue : {e.readiness}/6</div>}
                    {e.grade !== null && e.grade !== undefined && <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>Note obtenue : {e.grade}/6</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => handleEditEval(e)} style={actionBtnStyle}><Pencil size={14} /></button>
                    <button onClick={() => handleDelete('evaluations', e.id)} style={actionBtnStyle}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liste révisions */}
          {activeTab === 'revisions' && (
            <div>
              {revisions.length === 0 && <EmptyState emoji="📖" title="Aucune révision planifiée" subtitle="Planifie tes révisions pour rester organisé." actionLabel="+ Ajouter" onAction={() => setShowForm(true)} />}
              {revisions.map(r => (
                <div key={r.id} style={cardStyle}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{formatDate(r.revision_date)}{r.start_time ? ` · ${r.start_time}` : ''}</div>
                    {r.details && <div style={{ fontSize: '0.85rem', color: '#888' }}>{r.details}</div>}
                    <div style={{ fontSize: '0.85rem', color: r.completed ? '#2a9d8f' : '#e63946' }}>{r.completed ? '✓ Fait' : '○ À faire'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={async () => { await supabase.from('revisions').update({ completed: !r.completed }).eq('id', r.id); await logActivity({ action_type: 'revision_checked', metadata: { completed: !r.completed } }); fetchAll() }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                    >
                      {r.completed ? '✅' : '⬜'}
                    </button>
                    <button onClick={() => handleEditRev(r)} style={actionBtnStyle}><Pencil size={14} /></button>
                    <button onClick={() => handleDelete('revisions', r.id)} style={actionBtnStyle}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liste événements */}
          {activeTab === 'events' && (
            <div>
              {events.length === 0 && <EmptyState emoji="📅" title="Aucun événement" subtitle="Ajoute des événements importants à ton agenda." actionLabel="+ Ajouter" onAction={() => setShowForm(true)} />}
              {events.map(ev => (
                <div key={ev.id} style={cardStyle}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>{formatDate(ev.event_date)}{ev.start_time ? ` · ${ev.start_time}` : ''}</div>
                    {ev.details && <div style={{ fontSize: '0.85rem', color: '#888' }}>{ev.details}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => handleEditEvt(ev)} style={actionBtnStyle}><Pencil size={14} /></button>
                    <button onClick={() => handleDelete('events', ev.id)} style={actionBtnStyle}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liste rappels */}
          {activeTab === 'reminders' && (
            <div>
              {reminders.length === 0 && <EmptyState emoji="🔔" title="Aucun rappel" subtitle="Crée des rappels pour ne rien oublier." actionLabel="+ Ajouter" onAction={() => setShowForm(true)} />}
              {reminders.map(r => (
                <div key={r.id} style={cardStyle}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{r.title}</div>
                    {r.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{r.description}</div>}
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>{formatDate(r.deadline_date)}{r.deadline_time ? ` · ${r.deadline_time}` : ''}</div>
                    <div style={{ fontSize: '0.8rem', color: '#2a9d8f', marginTop: '0.2rem' }}>🔔 {ODIGO_REMIND_LABELS[r.odigo_remind]}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={async () => { await supabase.from('reminders').update({ completed: !r.completed }).eq('id', r.id); fetchAll() }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                    >
                      {r.completed ? '✅' : '⬜'}
                    </button>
                    <button onClick={() => handleEditReminder(r)} style={actionBtnStyle}><Pencil size={14} /></button>
                    <button onClick={() => handleDelete('reminders', r.id)} style={actionBtnStyle}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Popover édition calendrier ── */}
      {editingItem && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 499 }} onClick={() => setEditingItem(null)} />
          <div style={{
            position: 'fixed', left: editPopoverPos.x, top: editPopoverPos.y, zIndex: 500,
            background: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '0.75rem 1rem', minWidth: '190px',
          }}>
            <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.88rem', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid #f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
              {editingItem.title}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button onClick={() => handleCalendarEdit(editingItem)} style={{ background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                ✏️ Modifier
              </button>
              <button onClick={() => handleCalendarDelete(editingItem)} style={{ background: '#fee', color: '#e63946', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                🗑️
              </button>
              <button onClick={() => setEditingItem(null)} style={{ background: 'none', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '1rem', marginLeft: 'auto' }}>
                ✕
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
