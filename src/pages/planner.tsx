import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Evaluation, Revision } from '../type/index'
import type { Event as AppEvent } from '../type/index'
import { logActivity } from '../services/activity'

interface SubjectOption {
  id: number | string
  name: string
  emoji?: string | null
  isCustom: boolean
}

type Tab = 'evaluations' | 'revisions' | 'events' | 'reminders'

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

const ODIGO_REMIND_LABELS: Record<string, string> = {
  each_login: 'À chaque connexion',
  one_day: 'Un jour avant',
  one_week: 'Une semaine avant',
  never: 'Jamais',
}

const formatDate = (d: string) => {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function Planner({ userId, isParent: _isParent }: { userId?: string; isParent?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('evaluations')
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form states — évaluations
  const [evalDate, setEvalDate] = useState('')
  const [evalSubject, setEvalSubject] = useState('')
  const [evalTopic, setEvalTopic] = useState('')
  const [evalReadiness, setEvalReadiness] = useState('')
  const [evalGrade, setEvalGrade] = useState('')
  const [evalStartTime, setEvalStartTime] = useState('')
  const [evalEndTime, setEvalEndTime] = useState('')

  // Form states — révisions
  const [revDate, setRevDate] = useState('')
  const [revStartTime, setRevStartTime] = useState('')
  const [revEndTime, setRevEndTime] = useState('')
  const [revDetails, setRevDetails] = useState('')
  const [revEvalId, setRevEvalId] = useState('')

  // Form states — événements
  const [evtTitle, setEvtTitle] = useState('')
  const [evtDate, setEvtDate] = useState('')
  const [evtStartTime, setEvtStartTime] = useState('')
  const [evtEndTime, setEvtEndTime] = useState('')
  const [evtDetails, setEvtDetails] = useState('')

  // Form states — rappels
  const [remTitle, setRemTitle] = useState('')
  const [remDescription, setRemDescription] = useState('')
  const [remDeadlineDate, setRemDeadlineDate] = useState('')
  const [remDeadlineTime, setRemDeadlineTime] = useState('')
  const [remOdigoRemind, setRemOdigoRemind] = useState<Reminder['odigo_remind']>('never')

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

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  // ---- Évaluations ----

  const handleEditEval = (e: Evaluation) => {
    setEvalDate(e.evaluation_date)
    setEvalSubject(String(e.subject_id))
    setEvalTopic(e.topic)
    setEvalReadiness(e.readiness !== null && e.readiness !== undefined ? String(e.readiness) : '')
    setEvalGrade(e.grade !== null && e.grade !== undefined ? String(e.grade) : '')
    setEvalStartTime(e.start_time || '')
    setEvalEndTime(e.end_time || '')
    setEditingId(e.id)
    setShowForm(true)
  }

  const handleSaveEval = async () => {
    if (!evalDate || !evalSubject || !evalTopic) return
    const selectedSubject = subjects.find(s => String(s.id) === evalSubject)
    // Note : si evaluations.subject_id est de type integer en base, les UUIDs
    // de matières custom seront rejetés — migrer la colonne en text si besoin.
    const payload = {
      evaluation_date: evalDate,
      subject_id: selectedSubject?.isCustom ? evalSubject : parseInt(evalSubject),
      topic: evalTopic,
      readiness: evalReadiness ? parseFloat(evalReadiness) : null,
      grade: evalGrade ? parseFloat(evalGrade) : null,
      start_time: evalStartTime || null,
      end_time: evalEndTime || null,
    }
    if (editingId) {
      await supabase.from('evaluations').update(payload).eq('id', editingId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('evaluations').insert({ ...payload, user_id: user?.id })
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'evaluation' } })
    }
    setEvalDate(''); setEvalSubject(''); setEvalTopic(''); setEvalReadiness('')
    setEvalGrade(''); setEvalStartTime(''); setEvalEndTime('')
    closeForm()
    fetchAll()
  }

  // ---- Révisions ----

  const handleEditRev = (r: Revision) => {
    setRevDate(r.revision_date)
    setRevStartTime(r.start_time || '')
    setRevEndTime(r.end_time || '')
    setRevDetails(r.details || '')
    setRevEvalId(r.evaluation_id || '')
    setEditingId(r.id)
    setShowForm(true)
  }

  const handleSaveRev = async () => {
    if (!revDate) return
    const payload = {
      revision_date: revDate,
      start_time: revStartTime || null,
      end_time: revEndTime || null,
      details: revDetails || null,
      evaluation_id: revEvalId || null,
    }
    if (editingId) {
      await supabase.from('revisions').update(payload).eq('id', editingId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('revisions').insert({ ...payload, user_id: user?.id, completed: false })
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'revision' } })
    }
    setRevDate(''); setRevStartTime(''); setRevEndTime(''); setRevDetails(''); setRevEvalId('')
    closeForm()
    fetchAll()
  }

  // ---- Événements ----

  const handleEditEvt = (ev: AppEvent) => {
    setEvtTitle(ev.title)
    setEvtDate(ev.event_date)
    setEvtStartTime(ev.start_time || '')
    setEvtEndTime(ev.end_time || '')
    setEvtDetails(ev.details || '')
    setEditingId(ev.id)
    setShowForm(true)
  }

  const handleSaveEvt = async () => {
    if (!evtTitle || !evtDate) return
    const payload = {
      title: evtTitle,
      event_date: evtDate,
      start_time: evtStartTime || null,
      end_time: evtEndTime || null,
      details: evtDetails || null,
    }
    if (editingId) {
      await supabase.from('events').update(payload).eq('id', editingId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('events').insert({ ...payload, user_id: user?.id })
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'event' } })
    }
    setEvtTitle(''); setEvtDate(''); setEvtStartTime(''); setEvtEndTime(''); setEvtDetails('')
    closeForm()
    fetchAll()
  }

  // ---- Rappels ----

  const handleEditReminder = (r: Reminder) => {
    setRemTitle(r.title)
    setRemDescription(r.description || '')
    setRemDeadlineDate(r.deadline_date)
    setRemDeadlineTime(r.deadline_time || '')
    setRemOdigoRemind(r.odigo_remind)
    setEditingId(r.id)
    setShowForm(true)
  }

  const handleSaveReminder = async () => {
    if (!remTitle || !remDeadlineDate) return
    const payload = {
      title: remTitle,
      description: remDescription || null,
      deadline_date: remDeadlineDate,
      deadline_time: remDeadlineTime || null,
      odigo_remind: remOdigoRemind,
    }
    if (editingId) {
      const { error } = await supabase.from('reminders').update(payload).eq('id', editingId)
      if (error) console.error('Reminder update error:', error)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('reminders').insert({
        user_id: user?.id,
        title: remTitle,
        description: remDescription || null,
        deadline_date: remDeadlineDate,
        deadline_time: remDeadlineTime || null,
        odigo_remind: remOdigoRemind,
        completed: false,
      })
      if (error) console.error('Reminder insert error:', error)
      else await logActivity({ action_type: 'planner_entry', metadata: { type: 'reminder' } })
    }
    setRemTitle(''); setRemDescription(''); setRemDeadlineDate(''); setRemDeadlineTime(''); setRemOdigoRemind('never')
    closeForm()
    fetchAll()
  }

  const handleDelete = async (table: string, id: string) => {
    await supabase.from(table).delete().eq('id', id)
    fetchAll()
  }

  const getSubjectName = (id: unknown) => subjects.find(s => String(s.id) === String(id))?.name || '?'

  const tabStyle = (tab: Tab) => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    background: activeTab === tab ? '#2a9d8f' : '#e0f0ee',
    color: activeTab === tab ? 'white' : '#2a9d8f',
    fontWeight: activeTab === tab ? 'bold' : 'normal',
    fontSize: '0.9rem',
  })

  const inputStyle = {
    width: '100%',
    padding: '0.6rem',
    borderRadius: '0.5rem',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    boxSizing: 'border-box' as const,
    marginBottom: '0.75rem',
  }

  const cardStyle = {
    background: 'white',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    marginBottom: '0.75rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }

  const actionBtnStyle = {
    background: '#2a9d8f',
    color: 'white',
    border: 'none',
    borderRadius: '0.4rem',
    padding: '0.3rem 0.6rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        <button style={tabStyle('evaluations')} onClick={() => { setActiveTab('evaluations'); closeForm() }}>📝 Évaluations</button>
        <button style={tabStyle('revisions')} onClick={() => { setActiveTab('revisions'); closeForm() }}>📖 Révisions</button>
        <button style={tabStyle('events')} onClick={() => { setActiveTab('events'); closeForm() }}>📅 Événements</button>
        <button style={tabStyle('reminders')} onClick={() => { setActiveTab('reminders'); closeForm() }}>✅ Rappels</button>
      </div>

      {/* Bouton ajouter */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <button
          onClick={() => { if (showForm) { closeForm() } else { setShowForm(true) } }}
          style={{ padding: '0.6rem 1.2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          {showForm ? '✕ Annuler' : '+ Ajouter'}
        </button>
      </div>

      {/* Formulaire évaluations */}
      {showForm && activeTab === 'evaluations' && (
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>{editingId ? "Modifier l'évaluation" : 'Nouvelle évaluation'}</h3>
          <input type="date" value={evalDate} onChange={e => setEvalDate(e.target.value)} style={inputStyle} />
          <select value={evalSubject} onChange={e => setEvalSubject(e.target.value)} style={inputStyle}>
            <option value="">Choisir une matière</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>
                {s.emoji ? `${s.emoji} ${s.name}` : s.name}
              </option>
            ))}
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
          {evaluations.length === 0 && <p style={{ color: '#aaa' }}>Aucune évaluation.</p>}
          {evaluations.map(e => (
            <div key={e.id} style={cardStyle}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{getSubjectName(e.subject_id)} — {e.topic}</div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>{formatDate(e.evaluation_date)}{e.start_time ? ` · ${e.start_time}` : ''}</div>
                {e.readiness !== null && e.readiness !== undefined && <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>Note attendue : {e.readiness}/6</div>}
                {e.grade !== null && e.grade !== undefined && <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>Note obtenue : {e.grade}/6</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => handleEditEval(e)} style={actionBtnStyle}>✏️</button>
                <button onClick={() => handleDelete('evaluations', e.id)} style={actionBtnStyle}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste révisions */}
      {activeTab === 'revisions' && (
        <div>
          {revisions.length === 0 && <p style={{ color: '#aaa' }}>Aucune révision.</p>}
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
                <button onClick={() => handleEditRev(r)} style={actionBtnStyle}>✏️</button>
                <button onClick={() => handleDelete('revisions', r.id)} style={actionBtnStyle}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste événements */}
      {activeTab === 'events' && (
        <div>
          {events.length === 0 && <p style={{ color: '#aaa' }}>Aucun événement.</p>}
          {events.map(ev => (
            <div key={ev.id} style={cardStyle}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{ev.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>{formatDate(ev.event_date)}{ev.start_time ? ` · ${ev.start_time}` : ''}</div>
                {ev.details && <div style={{ fontSize: '0.85rem', color: '#888' }}>{ev.details}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => handleEditEvt(ev)} style={actionBtnStyle}>✏️</button>
                <button onClick={() => handleDelete('events', ev.id)} style={actionBtnStyle}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Liste rappels */}
      {activeTab === 'reminders' && (
        <div>
          {reminders.length === 0 && <p style={{ color: '#aaa' }}>Aucun rappel.</p>}
          {reminders.map(r => (
            <div key={r.id} style={cardStyle}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{r.title}</div>
                {r.description && <div style={{ fontSize: '0.85rem', color: '#888' }}>{r.description}</div>}
                <div style={{ fontSize: '0.85rem', color: '#888' }}>
                  {formatDate(r.deadline_date)}{r.deadline_time ? ` · ${r.deadline_time}` : ''}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#2a9d8f', marginTop: '0.2rem' }}>
                  🔔 {ODIGO_REMIND_LABELS[r.odigo_remind]}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={async () => { await supabase.from('reminders').update({ completed: !r.completed }).eq('id', r.id); fetchAll() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  {r.completed ? '✅' : '⬜'}
                </button>
                <button onClick={() => handleEditReminder(r)} style={actionBtnStyle}>✏️</button>
                <button onClick={() => handleDelete('reminders', r.id)} style={actionBtnStyle}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
