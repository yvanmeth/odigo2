import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Evaluation, Revision, AppEvent, Reminder, SubjectOption, PlannerView, CalendarItem } from './types'
import { buildCalendarItems } from './helpers'
import { useToast } from '../../components/Toast'
import PlannerList from './PlannerList'
import PlannerCalendar from './PlannerCalendar'

export default function Planner({ userId, isParent: _isParent }: { userId?: string; isParent?: boolean }) {
  const { showToast } = useToast()
  const [view, setPlannerView] = useState<PlannerView>('list')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingEditItem, setPendingEditItem] = useState<CalendarItem | null>(null)

  useEffect(() => { fetchAll() }, [userId])

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

  const handleDelete = async (table: string, id: string) => {
    await supabase.from(table).delete().eq('id', id)
    showToast('Supprimé', 'info')
    fetchAll()
  }

  const handleCalendarEdit = (item: CalendarItem) => {
    setPendingEditItem(item)
    setPlannerView('list')
  }

  const calendarItems = buildCalendarItems(evaluations, revisions, events, reminders, subjects)

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
        <div style={{ display: 'flex', gap: '0.2rem', background: '#f0faf8', borderRadius: '0.5rem', padding: '0.2rem' }}>
          <button style={viewToggle('list')} onClick={() => setPlannerView('list')}>📋 Liste</button>
          <button style={viewToggle('calendar')} onClick={() => setPlannerView('calendar')}>📅 Calendrier</button>
        </div>
      </div>

      {view === 'calendar' && (
        <PlannerCalendar
          items={calendarItems}
          onEdit={handleCalendarEdit}
          onDelete={handleDelete}
        />
      )}

      {view === 'list' && (
        <PlannerList
          evaluations={evaluations}
          revisions={revisions}
          events={events}
          reminders={reminders}
          subjects={subjects}
          onRefresh={fetchAll}
          onDelete={handleDelete}
          pendingEditItem={pendingEditItem}
          onPendingEditConsumed={() => setPendingEditItem(null)}
        />
      )}
    </div>
  )
}
