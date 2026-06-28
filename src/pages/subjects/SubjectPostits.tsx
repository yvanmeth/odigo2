import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { EmptyState } from '../../components/EmptyState'
import type { Postit } from './types'
import { POSTIT_COLORS, POSTIT_SIZES, POSTIT_ICONS } from './types'

interface SubjectPostitsProps {
  userId?: string
  subjectId: number | string
}

export default function SubjectPostits({ userId, subjectId }: SubjectPostitsProps) {
  const [postits, setPostits] = useState<Postit[]>([])
  const [archivedPostits, setArchivedPostits] = useState<Postit[]>([])
  const [showPostitForm, setShowPostitForm] = useState(false)
  const [editingPostit, setEditingPostit] = useState<Postit | null>(null)
  const [postitContent, setPostitContent] = useState('')
  const [postitColor, setPostitColor] = useState<'yellow' | 'green' | 'pink' | 'blue'>('yellow')
  const [postitSize, setPostitSize] = useState<'small' | 'square' | 'large'>('square')
  const [postitIcon, setPostitIcon] = useState<string | null>(null)
  const [showPostitArchives, setShowPostitArchives] = useState(false)
  const [hoveredPostitId, setHoveredPostitId] = useState<string | null>(null)

  useEffect(() => { fetchPostits() }, [subjectId])

  const getTargetId = async () => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const fetchPostits = async () => {
    const tid = await getTargetId()
    if (!tid) return
    const [activeRes, archiveRes] = await Promise.all([
      supabase.from('postits').select('*')
        .eq('user_id', tid).eq('subject_id', subjectId).eq('archived', false)
        .order('pinned', { ascending: false }).order('position'),
      supabase.from('postits').select('*')
        .eq('user_id', tid).eq('subject_id', subjectId).eq('archived', true)
        .order('updated_at', { ascending: false }),
    ])
    if (activeRes.data) setPostits(activeRes.data)
    if (archiveRes.data) setArchivedPostits(archiveRes.data)
  }

  const resetPostitForm = () => {
    setPostitContent(''); setPostitColor('yellow'); setPostitSize('square')
    setPostitIcon(null); setEditingPostit(null); setShowPostitForm(false)
  }

  const handleOpenEditPostit = (p: Postit) => {
    setPostitContent(p.content); setPostitColor(p.color)
    setPostitSize(p.size); setPostitIcon(p.icon)
    setEditingPostit(p); setShowPostitForm(true)
  }

  const handleSavePostit = async () => {
    const tid = await getTargetId()
    if (!tid || !postitContent.trim()) return
    if (editingPostit) {
      await supabase.from('postits').update({
        content: postitContent, color: postitColor, size: postitSize,
        icon: postitIcon, updated_at: new Date().toISOString(),
      }).eq('id', editingPostit.id)
    } else {
      const maxPos = postits.reduce((m, p) => Math.max(m, p.position), 0)
      await supabase.from('postits').insert({
        user_id: tid, subject_id: subjectId,
        content: postitContent, color: postitColor, size: postitSize,
        icon: postitIcon, pinned: false, archived: false, position: maxPos + 1,
      })
    }
    resetPostitForm(); fetchPostits()
  }

  const handleTogglePinPostit = async (p: Postit) => {
    await supabase.from('postits').update({ pinned: !p.pinned }).eq('id', p.id)
    fetchPostits()
  }

  const handleArchivePostit = async (p: Postit) => {
    await supabase.from('postits').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', p.id)
    fetchPostits()
  }

  const handleRestorePostit = async (p: Postit) => {
    await supabase.from('postits').update({ archived: false, updated_at: new Date().toISOString() }).eq('id', p.id)
    fetchPostits()
  }

  const handleDeletePostit = async (id: string) => {
    await supabase.from('postits').delete().eq('id', id)
    fetchPostits()
  }

  const actionBtn: CSSProperties = {
    background: '#f0f0f0', border: 'none', borderRadius: '0.3rem',
    padding: '0.25rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        {!showPostitForm ? (
          <button onClick={() => setShowPostitForm(true)} style={{ padding: '0.5rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
            + Post-it
          </button>
        ) : (
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', maxWidth: '480px' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.4rem' }}>Couleur</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(Object.keys(POSTIT_COLORS) as (keyof typeof POSTIT_COLORS)[]).map(c => (
                  <button key={c} onClick={() => setPostitColor(c)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: POSTIT_COLORS[c], border: postitColor === c ? '3px solid #333' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.4rem' }}>Taille</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {([['small', 'Petit'], ['square', 'Carré'], ['large', 'Grand']] as const).map(([s, label]) => (
                  <button key={s} onClick={() => setPostitSize(s)} style={{ padding: '0.3rem 0.7rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', background: postitSize === s ? '#2a9d8f' : 'var(--color-border)', color: postitSize === s ? 'white' : '#2a9d8f', fontSize: '0.82rem' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.4rem' }}>Icône (facultatif)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {POSTIT_ICONS.map(icon => (
                  <button key={icon} onClick={() => setPostitIcon(postitIcon === icon ? null : icon)} style={{ padding: '0.3rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', background: postitIcon === icon ? 'var(--color-border)' : 'transparent', fontSize: '1.1rem' }}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={postitContent}
              onChange={e => setPostitContent(e.target.value)}
              placeholder="Contenu du post-it..."
              style={{ width: '100%', height: '80px', padding: '0.6rem', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontSize: '0.9rem', resize: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSavePostit} style={{ flex: 1, padding: '0.5rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                {editingPostit ? 'Mettre à jour' : 'Enregistrer'}
              </button>
              <button onClick={resetPostitForm} style={{ padding: '0.5rem 0.8rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {postits.length === 0 ? (
        <EmptyState emoji="🗒️" title="Aucun post-it" subtitle="Ajoute des post-its pour les infos importantes." />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {postits.map(p => {
            const sz = POSTIT_SIZES[p.size]
            const hovered = hoveredPostitId === p.id
            return (
              <div
                key={p.id}
                onMouseEnter={() => setHoveredPostitId(p.id)}
                onMouseLeave={() => setHoveredPostitId(null)}
                style={{ width: sz.width, height: sz.height, background: POSTIT_COLORS[p.color], borderRadius: '0.5rem', boxShadow: '2px 2px 6px rgba(0,0,0,0.15)', padding: '0.6rem 0.75rem', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem' }}>{p.pinned ? '📌' : ''}</span>
                  {p.icon && <span style={{ fontSize: '1rem' }}>{p.icon}</span>}
                </div>
                <div style={{ fontSize: p.size === 'small' ? '0.8rem' : '0.9rem', color: '#333', lineHeight: '1.4', flex: 1, overflow: 'hidden' }}>
                  {p.content}
                </div>
                {hovered && (
                  <div style={{ position: 'absolute', bottom: '0.4rem', right: '0.4rem', display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.9)', borderRadius: '0.4rem', padding: '0.2rem' }}>
                    <button onClick={() => handleTogglePinPostit(p)} style={actionBtn} title={p.pinned ? 'Désépingler' : 'Épingler'}>📌</button>
                    <button onClick={() => handleOpenEditPostit(p)} style={actionBtn} title="Modifier">✏️</button>
                    <button onClick={() => handleArchivePostit(p)} style={actionBtn} title="Archiver">🗂️</button>
                    <button onClick={() => handleDeletePostit(p.id)} style={actionBtn} title="Supprimer">🗑️</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {archivedPostits.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <button onClick={() => setShowPostitArchives(!showPostitArchives)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.9rem', fontWeight: 'bold' }}>
            {showPostitArchives ? '▾' : '▸'} 🗂️ Voir les archives ({archivedPostits.length})
          </button>
          {showPostitArchives && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
              {archivedPostits.map(p => {
                const sz = POSTIT_SIZES[p.size]
                return (
                  <div key={p.id} style={{ width: sz.width, height: sz.height, background: POSTIT_COLORS[p.color], borderRadius: '0.5rem', boxShadow: '2px 2px 6px rgba(0,0,0,0.08)', padding: '0.6rem 0.75rem', opacity: 0.5, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ fontSize: p.size === 'small' ? '0.8rem' : '0.9rem', color: '#333', flex: 1, overflow: 'hidden' }}>{p.content}</div>
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                      <button onClick={() => handleRestorePostit(p)} style={{ ...actionBtn, fontSize: '0.75rem' }}>Restaurer</button>
                      <button onClick={() => handleDeletePostit(p.id)} style={actionBtn}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
