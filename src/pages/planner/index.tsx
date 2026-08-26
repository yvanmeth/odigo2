import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Evaluation, Revision, AppEvent, Reminder, SubjectOption, PlannerView, CalendarItem } from './types'
import { buildCalendarItems, type PlannerMission } from './helpers'
import { useToast } from '../../components/Toast'
import PlannerList from './PlannerList'
import PlannerCalendar from './PlannerCalendar'

export default function Planner({ isParent: _isParent }: { isParent?: boolean }) {
  const { showToast } = useToast()
  const [view, setPlannerView] = useState<PlannerView>('list')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [missions, setMissions] = useState<PlannerMission[]>([])
  const [resolvedUserId, setResolvedUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingEditItem, setPendingEditItem] = useState<CalendarItem | null>(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const targetId = user?.id
    setResolvedUserId(targetId || '')
    const [evalsRes, revsRes, eventsRes, fixedRes, remindersRes, prefsRes, missionsRes] = await Promise.all([
      supabase.from('evaluations').select('*').eq('user_id', targetId).order('evaluation_date'),
      supabase.from('revisions').select('*').eq('user_id', targetId).order('revision_date'),
      supabase.from('events').select('*').eq('user_id', targetId).order('event_date'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('reminders').select('*').eq('user_id', targetId).order('deadline_date'),
      supabase.from('user_subjects').select('*').eq('user_id', targetId),
      supabase.from('missions').select('id, name, description, deadline, reward_type, reward_amount, status').eq('child_id', targetId).in('status', ['pending', 'claimed', 'completed']).order('deadline'),
    ])
    if (evalsRes.data) setEvaluations(evalsRes.data)
    if (revsRes.data) setRevisions(revsRes.data)
    if (eventsRes.data) setEvents(eventsRes.data)
    if (remindersRes.data) setReminders(remindersRes.data)
    if (missionsRes.data) setMissions(missionsRes.data as PlannerMission[])

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

  const handleDelete = async (table: string, id: string) => {
    await supabase.from(table).delete().eq('id', id)
    showToast('Supprimé', 'info')
    fetchAll()
  }

  const handleDeleteEvent = async (event: AppEvent, mode: 'single' | 'following' | 'all') => {
    if (!event.recurrence_id || mode === 'single') {
      await supabase.from('events').delete().eq('id', event.id)
    } else if (mode === 'following') {
      await supabase.from('events').delete()
        .eq('recurrence_id', event.recurrence_id)
        .gte('event_date', event.event_date)
    } else if (mode === 'all') {
      await supabase.from('events').delete()
        .eq('recurrence_id', event.recurrence_id)
    }
    fetchAll()
    showToast('Événement(s) supprimé(s)', 'info')
  }

  const handleCalendarEdit = (item: CalendarItem) => {
    setPendingEditItem(item)
    setPlannerView('list')
  }

  const calendarItems = buildCalendarItems(evaluations, revisions, events, reminders, subjects, missions)

  const viewToggle = (v: PlannerView) => ({
    padding: '0.45rem 0.85rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' as const,
    background: view === v ? '#2a9d8f' : 'transparent',
    color: view === v ? 'white' : '#2a9d8f',
    fontSize: '0.85rem', fontWeight: view === v ? 'bold' : ('normal' as const),
  })

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      {/* Barre supérieure — toggle liste / calendrier */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '0.2rem', background: 'var(--color-background)', borderRadius: '0.5rem', padding: '0.2rem' }}>
          <button style={viewToggle('list')} onClick={() => setPlannerView('list')}>📋 Liste</button>
          <button style={viewToggle('calendar')} onClick={() => setPlannerView('calendar')}>📅 Calendrier</button>
        </div>
      </div>

      {view === 'calendar' && (
        <PlannerCalendar
          items={calendarItems}
          onEdit={handleCalendarEdit}
          onDelete={handleDelete}
          onDeleteEvent={handleDeleteEvent}
          userId={resolvedUserId}
          subjects={subjects}
          evaluations={evaluations}
          onRefresh={fetchAll}
        />
      )}

      {view === 'list' && (
        <PlannerList
          evaluations={evaluations}
          revisions={revisions}
          events={events}
          reminders={reminders}
          subjects={subjects}
          missions={missions}
          onRefresh={fetchAll}
          onDelete={handleDelete}
          onDeleteEvent={handleDeleteEvent}
          pendingEditItem={pendingEditItem}
          onPendingEditConsumed={() => setPendingEditItem(null)}
        />
      )}
    </div>
  )
}
