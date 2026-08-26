import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { SubjectItem } from './types'
import { COLOR_PALETTE, FIXED_SUBJECTS } from './types'

interface SubjectGridProps {
  onSelectSubject: (subject: SubjectItem) => void
}

export default function SubjectGrid({ onSelectSubject }: SubjectGridProps) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [manageMode, setManageMode] = useState(false)
  const [renamingId, setRenamingId] = useState<string | number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string | number | null>(null)

  useEffect(() => { fetchSubjects() }, [])

  const getTargetId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const fetchSubjects = async () => {
    setLoading(true)
    const tid = await getTargetId()
    if (!tid) { setLoading(false); return }

    const { data } = await supabase.from('user_subjects').select('*').eq('user_id', tid)
    let entries = data || []

    if (entries.length === 0) {
      const inserts = [1, 2, 3, 4].map(() => ({
        user_id: tid, subject_id: null,
        custom_name: 'Matière personnalisée', custom_color: '#9e9e9e', custom_emoji: '📚',
        hidden: false,
      }))
      const { data: inserted } = await supabase.from('user_subjects').insert(inserts).select()
      entries = inserted || []
    }

    const list: SubjectItem[] = []
    FIXED_SUBJECTS.forEach((fs, idx) => {
      const entry = entries.find((e: { subject_id: number }) => e.subject_id === fs.id)
      list.push({
        id: fs.id, name: fs.name, emoji: fs.emoji, color: fs.color,
        isCustom: false, hidden: entry?.hidden || false, position: idx,
      })
    })
    entries.filter((e: { subject_id: number | null; custom_name: string }) => e.subject_id === null && e.custom_name).forEach((e: { id: string; custom_name: string; custom_emoji: string | null; custom_color: string | null; hidden: boolean }, idx: number) => {
      list.push({
        id: e.id, name: e.custom_name, emoji: e.custom_emoji || '📚',
        color: e.custom_color || '#9e9e9e', isCustom: true,
        hidden: e.hidden || false, position: FIXED_SUBJECTS.length + idx,
      })
    })

    setSubjects(list)
    setLoading(false)
  }

  const handleAddSubject = async () => {
    const tid = await getTargetId()
    if (!tid) return
    const { data } = await supabase.from('user_subjects').insert({
      user_id: tid, subject_id: null, custom_name: 'Nouvelle matière',
      custom_color: COLOR_PALETTE[0], custom_emoji: '📚', hidden: false,
    }).select().single()
    if (data) {
      const item: SubjectItem = {
        id: data.id, name: data.custom_name, emoji: data.custom_emoji,
        color: data.custom_color, isCustom: true, hidden: false, position: subjects.length,
      }
      setSubjects(prev => [...prev, item])
      setManageMode(true)
      setRenamingId(item.id)
      setRenameValue(item.name)
    }
  }

  const handleSaveRename = async (item: SubjectItem) => {
    const name = renameValue.trim()
    setRenamingId(null)
    if (!name || name === item.name) return
    await supabase.from('user_subjects').update({ custom_name: name }).eq('id', item.id)
    setSubjects(prev => prev.map(s => s.id === item.id ? { ...s, name } : s))
  }

  const handleSetColor = async (item: SubjectItem, color: string) => {
    await supabase.from('user_subjects').update({ custom_color: color }).eq('id', item.id)
    setSubjects(prev => prev.map(s => s.id === item.id ? { ...s, color } : s))
    setColorPickerId(null)
  }

  const handleToggleHidden = async (item: SubjectItem) => {
    const hidden = !item.hidden
    if (item.isCustom) {
      await supabase.from('user_subjects').update({ hidden }).eq('id', item.id)
    } else {
      const tid = await getTargetId()
      if (!tid) return
      const { data: existing } = await supabase.from('user_subjects').select('id')
        .eq('user_id', tid).eq('subject_id', item.id).maybeSingle()
      if (existing) {
        await supabase.from('user_subjects').update({ hidden }).eq('id', existing.id)
      } else {
        await supabase.from('user_subjects').insert({ user_id: tid, subject_id: item.id, hidden })
      }
    }
    setSubjects(prev => prev.map(s => s.id === item.id ? { ...s, hidden } : s))
  }

  const handleDeleteSubject = async (item: SubjectItem) => {
    if (!item.isCustom) return
    await supabase.from('user_subjects').delete().eq('id', item.id)
    setSubjects(prev => prev.filter(s => s.id !== item.id))
  }

  const visibleSubjects = subjects.filter(s => !s.hidden)
  const hiddenSubjects = subjects.filter(s => s.hidden)

  const subjectCardBase: CSSProperties = {
    background: 'white', borderRadius: '1rem', padding: '1.5rem 1rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
  }

  const actionBtn: CSSProperties = {
    background: '#f0f0f0', border: 'none', borderRadius: '0.3rem',
    padding: '0.25rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  const actionBtnStyle: CSSProperties = {
    background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem',
    padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: '#2a9d8f' }}>Matières</h2>
        <button
          onClick={() => { setManageMode(!manageMode); setRenamingId(null); setColorPickerId(null) }}
          style={{
            padding: '0.5rem 1rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
            fontSize: '0.9rem', fontWeight: 'bold',
            background: manageMode ? '#2a9d8f' : 'var(--color-border)',
            color: manageMode ? 'white' : '#2a9d8f',
          }}
        >
          {manageMode ? '✓ Terminer' : '⚙️ Gérer'}
        </button>
      </div>

      {!manageMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {visibleSubjects.map(subject => (
            <div
              key={subject.id}
              onClick={() => onSelectSubject(subject)}
              className="card-hover"
              style={{ ...subjectCardBase, borderTop: `4px solid ${subject.color}` }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{subject.emoji}</div>
              <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>{subject.name}</div>
            </div>
          ))}
          <div
            onClick={handleAddSubject}
            className="card-hover"
            style={{ ...subjectCardBase, border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '92px' }}
          >
            <div style={{ fontSize: '2rem', color: '#aaa' }}>+</div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
            {subjects.map(subject => (
              <div key={subject.id} style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: `4px solid ${subject.color}`, position: 'relative' }}>
                <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>{subject.emoji}</div>
                  {renamingId === subject.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(subject) }}
                      onBlur={() => handleSaveRename(subject)}
                      style={{ width: '100%', textAlign: 'center', fontWeight: 'bold', border: '1px solid #2a9d8f', borderRadius: '0.4rem', padding: '0.3rem', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>
                      {subject.name}
                      {subject.hidden && <span style={{ color: '#aaa', fontSize: '0.72rem', display: 'block' }}>(masquée)</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {subject.isCustom && (
                    <>
                      <button onClick={() => { setRenamingId(subject.id); setRenameValue(subject.name); setColorPickerId(null) }} style={actionBtn} title="Renommer">✏️</button>
                      <button onClick={() => { setColorPickerId(colorPickerId === subject.id ? null : subject.id); setRenamingId(null) }} style={actionBtn} title="Couleur">🎨</button>
                    </>
                  )}
                  <button onClick={() => handleToggleHidden(subject)} style={actionBtn} title={subject.hidden ? 'Afficher' : 'Masquer'}>👁️ Masquer</button>
                  {subject.isCustom && (
                    <button onClick={() => handleDeleteSubject(subject)} style={{ ...actionBtn, color: '#e63946' }} title="Supprimer">🗑️</button>
                  )}
                </div>
                {colorPickerId === subject.id && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', borderRadius: '0.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {COLOR_PALETTE.map(c => (
                      <button key={c} onClick={() => handleSetColor(subject, c)} style={{ width: '26px', height: '26px', borderRadius: '50%', background: c, border: subject.color === c ? '3px solid #333' : '2px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {hiddenSubjects.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ color: '#888', fontSize: '1rem', marginBottom: '0.75rem' }}>👁️ Matières masquées</h3>
              {hiddenSubjects.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', borderRadius: '0.75rem', padding: '0.6rem 1rem', marginBottom: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{s.emoji}</span>
                    <span style={{ fontWeight: 'bold', color: '#555' }}>{s.name}</span>
                  </div>
                  <button onClick={() => handleToggleHidden(s)} style={actionBtnStyle}>Afficher</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
