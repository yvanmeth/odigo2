import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { parseLocalDate } from '../../lib/dates'
import { useToast } from '../../components/Toast'
import { getDefaultEndOfSchoolYear, getDefaultYearlyEnd } from './helpers'
import { logActivity } from '../../services/activity'
import { addPlannerDigoos } from '../../services/digoos'

type ItemType = 'evaluation' | 'revision' | 'event' | 'reminder'

interface CalendarCreateModalProps {
  initialDate: string
  initialTime?: string
  userId: string
  subjects: { id: string | number; name: string }[]
  evaluations: { id: string; topic: string; evaluation_date: string }[]
  onClose: () => void
  onSaved: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd',
  fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem',
}

export default function CalendarCreateModal({ initialDate, initialTime, userId, subjects, evaluations, onClose, onSaved }: CalendarCreateModalProps) {
  const { showToast } = useToast()
  const [itemType, setItemType] = useState<ItemType>('evaluation')
  const [saving, setSaving] = useState(false)

  // Champs communs
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(initialTime || '')
  const [endTime, setEndTime] = useState('')

  // Évaluation
  const [evalSubject, setEvalSubject] = useState('')
  const [evalTopic, setEvalTopic] = useState('')
  const [evalReadiness, setEvalReadiness] = useState('')

  // Révision
  const [revEvalId, setRevEvalId] = useState('')
  const [revDetails, setRevDetails] = useState('')

  // Événement
  const [evtTitle, setEvtTitle] = useState('')
  const [evtDetails, setEvtDetails] = useState('')
  const [evtRepeat, setEvtRepeat] = useState(false)
  const [evtRepeatUntil, setEvtRepeatUntil] = useState('')
  const [evtRepeatYearly, setEvtRepeatYearly] = useState(false)
  const [evtRepeatYearlyUntil, setEvtRepeatYearlyUntil] = useState('')

  // Rappel
  const [remTitle, setRemTitle] = useState('')
  const [remDescription, setRemDescription] = useState('')
  const [remFrequency, setRemFrequency] = useState<'each_login' | 'one_day' | 'one_week' | 'never'>('never')

  useEffect(() => {
    if (evtRepeat && !evtRepeatUntil) {
      setEvtRepeatUntil(getDefaultEndOfSchoolYear(parseLocalDate(date)))
    }
  }, [evtRepeat])

  useEffect(() => {
    if (evtRepeatYearly && !evtRepeatYearlyUntil) {
      setEvtRepeatYearlyUntil(getDefaultYearlyEnd(parseLocalDate(date)))
    }
  }, [evtRepeatYearly])

  const typeBtnStyle = (t: ItemType): React.CSSProperties => ({
    padding: '0.4rem 0.75rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
    background: itemType === t ? '#2a9d8f' : 'var(--color-border)',
    color: itemType === t ? 'white' : '#2a9d8f',
    fontWeight: itemType === t ? 'bold' : 'normal', fontSize: '0.85rem',
  })

  const handleSave = async () => {
    if (saving) return
    if (!date) return
    if (itemType === 'evaluation' && (!evalSubject || !evalTopic)) return
    if (itemType === 'event' && !evtTitle) return
    if (itemType === 'reminder' && !remTitle) return

    setSaving(true)

    if (itemType === 'evaluation') {
      const selectedSubject = subjects.find(s => String(s.id) === evalSubject)
      const subjectId = selectedSubject && typeof selectedSubject.id === 'number' ? selectedSubject.id : evalSubject
      await supabase.from('evaluations').insert({
        user_id: userId, subject_id: subjectId, topic: evalTopic,
        evaluation_date: date, start_time: startTime || null, end_time: endTime || null,
        readiness: evalReadiness ? parseFloat(evalReadiness) : null,
      })
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'evaluation' } })
      await addPlannerDigoos('eval_added')
    } else if (itemType === 'revision') {
      await supabase.from('revisions').insert({
        user_id: userId, evaluation_id: revEvalId || null,
        revision_date: date, start_time: startTime || null, end_time: endTime || null,
        details: revDetails || null, completed: false,
      })
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'revision' } })
    } else if (itemType === 'event') {
      const payload = {
        title: evtTitle, event_date: date,
        start_time: startTime || null, end_time: endTime || null, details: evtDetails || null,
      }
      const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      if (evtRepeat && evtRepeatUntil) {
        const recurrenceId = crypto.randomUUID()
        const dates: string[] = []
        const cur = parseLocalDate(date)
        const end = parseLocalDate(evtRepeatUntil)
        while (cur <= end) { dates.push(toDateStr(cur)); cur.setDate(cur.getDate() + 7) }
        await supabase.from('events').insert(dates.map(d => ({ ...payload, user_id: userId, event_date: d, recurrence_id: recurrenceId })))
        await logActivity({ action_type: 'planner_entry', metadata: { type: 'event_repeat' } })
      } else if (evtRepeatYearly && evtRepeatYearlyUntil) {
        const recurrenceId = crypto.randomUUID()
        const dates: string[] = []
        const cur = parseLocalDate(date)
        const end = parseLocalDate(evtRepeatYearlyUntil)
        while (cur <= end) { dates.push(toDateStr(cur)); cur.setFullYear(cur.getFullYear() + 1) }
        await supabase.from('events').insert(dates.map(d => ({ ...payload, user_id: userId, event_date: d, recurrence_id: recurrenceId })))
        await logActivity({ action_type: 'planner_entry', metadata: { type: 'event_repeat_yearly' } })
      } else {
        await supabase.from('events').insert({ ...payload, user_id: userId })
        await logActivity({ action_type: 'planner_entry', metadata: { type: 'event' } })
      }
      await addPlannerDigoos('event_added')
    } else if (itemType === 'reminder') {
      const { error } = await supabase.from('reminders').insert({
        user_id: userId, title: remTitle, description: remDescription || null,
        deadline_date: date, deadline_time: startTime || null,
        odigo_remind: remFrequency, completed: false,
      })
      if (error) {
        showToast('Une erreur est survenue', 'error')
        setSaving(false)
        return
      }
      await logActivity({ action_type: 'planner_entry', metadata: { type: 'reminder' } })
      await addPlannerDigoos('reminder_added')
    }

    showToast('Item ajouté !')
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '480px', width: '90%', background: 'white', borderRadius: '1rem', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#2a9d8f', margin: 0 }}>Nouvel item</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#aaa' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <button style={typeBtnStyle('evaluation')} onClick={() => setItemType('evaluation')}>📝 Évaluation</button>
          <button style={typeBtnStyle('revision')} onClick={() => setItemType('revision')}>📖 Révision</button>
          <button style={typeBtnStyle('event')} onClick={() => setItemType('event')}>📅 Événement</button>
          <button style={typeBtnStyle('reminder')} onClick={() => setItemType('reminder')}>🔔 Rappel</button>
        </div>

        {itemType === 'evaluation' && (
          <>
            <select value={evalSubject} onChange={e => setEvalSubject(e.target.value)} style={inputStyle}>
              <option value="">Choisir une matière</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="text" placeholder="Sujet / Chapitre" value={evalTopic} onChange={e => setEvalTopic(e.target.value)} style={inputStyle} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
            </div>
            <input type="number" placeholder="Note attendue (0-6)" min="0" max="6" step="0.5" value={evalReadiness} onChange={e => setEvalReadiness(e.target.value)} style={inputStyle} />
          </>
        )}

        {itemType === 'revision' && (
          <>
            <select value={revEvalId} onChange={e => setRevEvalId(e.target.value)} style={inputStyle}>
              <option value="">Lier à une évaluation (optionnel)</option>
              {evaluations.map(e => <option key={e.id} value={e.id}>{e.topic}</option>)}
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
            </div>
            <textarea placeholder="Détails (optionnel)" value={revDetails} onChange={e => setRevDetails(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
          </>
        )}

        {itemType === 'event' && (
          <>
            <input type="text" placeholder="Titre" value={evtTitle} onChange={e => setEvtTitle(e.target.value)} style={inputStyle} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, width: '50%' }} />
            </div>
            <textarea placeholder="Détails (optionnel)" value={evtDetails} onChange={e => setEvtDetails(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.25rem' }}>
              <input
                type="checkbox"
                checked={evtRepeat}
                onChange={e => { setEvtRepeat(e.target.checked); if (e.target.checked) setEvtRepeatYearly(false) }}
              />
              <span style={{ color: '#555', fontSize: '0.9rem' }}>🔁 Répéter chaque semaine</span>
            </label>
            {evtRepeat && (
              <div style={{ marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Répéter jusqu'au</label>
                <input type="date" value={evtRepeatUntil} onChange={e => setEvtRepeatUntil(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
              <input
                type="checkbox"
                checked={evtRepeatYearly}
                onChange={e => { setEvtRepeatYearly(e.target.checked); if (e.target.checked) setEvtRepeat(false) }}
              />
              <span style={{ color: '#555', fontSize: '0.9rem' }}>📅 Répéter chaque année (anniversaire, événement annuel)</span>
            </label>
            {evtRepeatYearly && (
              <div style={{ marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: '#888', display: 'block', marginBottom: '0.25rem' }}>Répéter jusqu'en</label>
                <input type="date" value={evtRepeatYearlyUntil} onChange={e => setEvtRepeatYearlyUntil(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
            )}
          </>
        )}

        {itemType === 'reminder' && (
          <>
            <input type="text" placeholder="Titre" value={remTitle} onChange={e => setRemTitle(e.target.value)} style={inputStyle} />
            <textarea placeholder="Description (optionnel)" value={remDescription} onChange={e => setRemDescription(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '60%' }} />
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, width: '40%' }} />
            </div>
            <select value={remFrequency} onChange={e => setRemFrequency(e.target.value as typeof remFrequency)} style={inputStyle}>
              <option value="each_login">À chaque connexion</option>
              <option value="one_day">Un jour avant</option>
              <option value="one_week">Une semaine avant</option>
              <option value="never">Jamais</option>
            </select>
          </>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: saving ? 'default' : 'pointer', fontWeight: 'bold', opacity: saving ? 0.7 : 1 }}
        >
          Enregistrer
        </button>
        <button onClick={onClose} style={{ width: '100%', padding: '0.6rem', background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginTop: '0.5rem' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
