import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Subject } from '../type/index'

interface Note {
  id: string
  user_id: string
  subject_id: number
  title: string
  content: string
  archived: boolean
  archive_folder: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

interface Postit {
  id: string
  user_id: string
  subject_id: number
  content: string
  color: 'yellow' | 'green' | 'pink' | 'blue'
  size: 'small' | 'square' | 'large'
  icon: string | null
  pinned: boolean
  archived: boolean
  position: number
  created_at: string
  updated_at: string
}

type SubjectTab = 'notes' | 'postits'

const SUBJECT_COLORS: Record<string, string> = {
  'Français': '#4CAF50', 'Maths': '#2196F3', 'Allemand': '#FF9800', 'Anglais': '#9C27B0',
  'Grec': '#00BCD4', 'Arabe': '#F44336', 'Géo': '#795548', 'Histoire': '#607D8B',
}

const POSTIT_COLORS = { yellow: '#fff9c4', green: '#c8e6c9', pink: '#f8bbd0', blue: '#bbdefb' }

const POSTIT_SIZES = {
  small:  { width: '160px', height: '80px' },
  square: { width: '200px', height: '200px' },
  large:  { width: '320px', height: '120px' },
}

const POSTIT_ICONS = ['❤️', '✏️', '⚠️', '⭐', '📌', '✅', '💡', '🔍', '❓', '🎯']

function getSubjectEmoji(name: string): string {
  const map: Record<string, string> = {
    'Français': '📖', 'Maths': '🔢', 'Allemand': '🇩🇪', 'Anglais': '🇬🇧',
    'Grec': '🏛️', 'Arabe': '🌙', 'Géo': '🌍', 'Histoire': '⏳',
  }
  return map[name] || '📚'
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/==(.+?)==/g, '<mark style="background:#fff176">$1</mark>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:1.2rem;list-style:disc">$1</li>')
    .replace(/\n/g, '<br>')
}

function getPreview(content: string): string {
  const plain = content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/==(.*?)==/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\n/g, ' ')
  return plain.length > 60 ? plain.substring(0, 60) + '…' : plain
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CH')
}

export default function Subjects({ userId }: { userId?: string }) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [subjectTab, setSubjectTab] = useState<SubjectTab>('notes')

  // Notes
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showNotePreview, setShowNotePreview] = useState(false)
  const [showArchives, setShowArchives] = useState(false)
  const [archivingNoteId, setArchivingNoteId] = useState<string | null>(null)
  const [archiveFolderInput, setArchiveFolderInput] = useState('')
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Postits
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

  useEffect(() => { fetchSubjects() }, [])

  useEffect(() => {
    if (selectedSubject) { fetchNotes(); fetchPostits() }
  }, [selectedSubject])

  const getTargetId = async (): Promise<string | undefined> => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('name')
    if (!error && data) setSubjects(data)
    setLoading(false)
  }

  const fetchNotes = async () => {
    const tid = await getTargetId()
    if (!tid || !selectedSubject) return
    const { data } = await supabase
      .from('notes').select('*')
      .eq('user_id', tid).eq('subject_id', selectedSubject.id)
      .order('pinned', { ascending: false }).order('updated_at', { ascending: false })
    if (data) setNotes(data)
  }

  const fetchPostits = async () => {
    const tid = await getTargetId()
    if (!tid || !selectedSubject) return
    const [activeRes, archiveRes] = await Promise.all([
      supabase.from('postits').select('*')
        .eq('user_id', tid).eq('subject_id', selectedSubject.id).eq('archived', false)
        .order('pinned', { ascending: false }).order('position'),
      supabase.from('postits').select('*')
        .eq('user_id', tid).eq('subject_id', selectedSubject.id).eq('archived', true)
        .order('updated_at', { ascending: false }),
    ])
    if (activeRes.data) setPostits(activeRes.data)
    if (archiveRes.data) setArchivedPostits(archiveRes.data)
  }

  // ---- Note actions ----

  const handleNewNote = async () => {
    const tid = await getTargetId()
    if (!tid || !selectedSubject) return
    const { data } = await supabase.from('notes').insert({
      user_id: tid, subject_id: selectedSubject.id,
      title: 'Nouvelle note', content: '', archived: false, archive_folder: null, pinned: false,
    }).select().single()
    if (data) { setNotes(prev => [data, ...prev]); setEditingNote(data) }
  }

  const handleSaveNote = useCallback(async (note: Note) => {
    await supabase.from('notes').update({
      title: note.title, content: note.content, updated_at: new Date().toISOString(),
    }).eq('id', note.id)
  }, [])

  const handleNoteChange = (field: 'title' | 'content', value: string) => {
    if (!editingNote) return
    const updated = { ...editingNote, [field]: value }
    setEditingNote(updated)
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => handleSaveNote(updated), 2000)
  }

  const handleEditorBack = () => {
    if (saveDebounceRef.current) { clearTimeout(saveDebounceRef.current); saveDebounceRef.current = null }
    if (editingNote) handleSaveNote(editingNote)
    setEditingNote(null)
    setShowNotePreview(false)
  }

  const applyMarkdownWrap = (before: string, after: string) => {
    const ta = textareaRef.current
    if (!ta || !editingNote) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = editingNote.content.substring(start, end)
    const newContent = editingNote.content.substring(0, start) + before + selected + after + editingNote.content.substring(end)
    handleNoteChange('content', newContent)
  }

  const applyBullet = () => {
    const ta = textareaRef.current
    if (!ta || !editingNote) return
    const start = ta.selectionStart
    const lineStart = editingNote.content.lastIndexOf('\n', start - 1) + 1
    const newContent = editingNote.content.substring(0, lineStart) + '- ' + editingNote.content.substring(lineStart)
    handleNoteChange('content', newContent)
  }

  const handleTogglePinNote = async (note: Note) => {
    const updated = { ...note, pinned: !note.pinned }
    await supabase.from('notes').update({ pinned: updated.pinned }).eq('id', note.id)
    setNotes(prev => prev.map(n => n.id === note.id ? updated : n))
  }

  const handleArchiveNote = async (noteId: string, folder: string | null) => {
    await supabase.from('notes').update({
      archived: true, archive_folder: folder, updated_at: new Date().toISOString(),
    }).eq('id', noteId)
    setArchivingNoteId(null); setArchiveFolderInput('')
    fetchNotes()
  }

  const handleUnarchiveNote = async (note: Note) => {
    await supabase.from('notes').update({ archived: false, archive_folder: null }).eq('id', note.id)
    fetchNotes()
  }

  const handleDeleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id)
    if (editingNote?.id === id) setEditingNote(null)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  // ---- Postit actions ----

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
    if (!tid || !selectedSubject || !postitContent.trim()) return
    if (editingPostit) {
      await supabase.from('postits').update({
        content: postitContent, color: postitColor, size: postitSize,
        icon: postitIcon, updated_at: new Date().toISOString(),
      }).eq('id', editingPostit.id)
    } else {
      const maxPos = postits.reduce((m, p) => Math.max(m, p.position), 0)
      await supabase.from('postits').insert({
        user_id: tid, subject_id: selectedSubject.id,
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

  // ---- Derived ----

  const pinnedNotes = notes.filter(n => n.pinned && !n.archived)
  const activeNotes = notes.filter(n => !n.pinned && !n.archived)
  const archivedNotes = notes.filter(n => n.archived)
  const archiveFolders = [...new Set(archivedNotes.map(n => n.archive_folder).filter(Boolean))] as string[]

  const subjectColor = selectedSubject ? (SUBJECT_COLORS[selectedSubject.name] || '#2a9d8f') : '#2a9d8f'

  const tabStyle = (tab: SubjectTab): React.CSSProperties => ({
    padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
    background: subjectTab === tab ? '#2a9d8f' : '#e0f0ee',
    color: subjectTab === tab ? 'white' : '#2a9d8f',
    fontWeight: subjectTab === tab ? 'bold' : 'normal', fontSize: '0.9rem',
  })

  const actionBtn: React.CSSProperties = {
    background: '#f0f0f0', border: 'none', borderRadius: '0.3rem',
    padding: '0.25rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  // ===================== GRILLE MATIÈRES =====================
  if (!selectedSubject) {
    return (
      <div>
        {subjects.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>
            Aucune matière trouvée. Les matières seront ajoutées par l'administrateur.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
            {subjects.map(subject => (
              <div
                key={subject.id}
                onClick={() => { setSelectedSubject(subject); setSubjectTab('notes') }}
                style={{
                  background: 'white', borderRadius: '1rem', padding: '1.5rem 1rem',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
                  borderTop: `4px solid ${SUBJECT_COLORS[subject.name] || '#2a9d8f'}`,
                  cursor: 'pointer', transition: 'transform 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{getSubjectEmoji(subject.name)}</div>
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>{subject.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ===================== ÉDITEUR DE NOTE =====================
  if (editingNote) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={handleEditorBack} style={{ padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            ← Retour aux notes
          </button>
          <button
            onClick={() => setShowNotePreview(!showNotePreview)}
            style={{ padding: '0.4rem 0.8rem', background: showNotePreview ? '#2a9d8f' : '#e0f0ee', color: showNotePreview ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {showNotePreview ? '✏️ Éditer' : '👁️ Aperçu'}
          </button>
        </div>

        <input
          value={editingNote.title}
          onChange={e => handleNoteChange('title', e.target.value)}
          placeholder="Titre de la note"
          style={{ width: '100%', fontSize: '1.3rem', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #e0f0ee', padding: '0.5rem 0', marginBottom: '1rem', outline: 'none', boxSizing: 'border-box' }}
        />

        {!showNotePreview ? (
          <div>
            {/* Barre d'outils */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => applyMarkdownWrap('**', '**')} title="Gras" style={{ padding: '0.3rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>B</button>
              <button onClick={() => applyMarkdownWrap('==', '==')} title="Surlignage jaune" style={{ padding: '0.3rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.3rem', background: '#fff176', cursor: 'pointer', fontSize: '0.82rem' }}>==</button>
              <button onClick={() => applyMarkdownWrap('<mark style="background:#fff176">', '</mark>')} title="Surlignage jaune" style={{ padding: '0.3rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.3rem', background: '#fff176', cursor: 'pointer', fontSize: '0.82rem' }}>🟡</button>
              <button onClick={() => applyMarkdownWrap('<mark style="background:#a8e6a3">', '</mark>')} title="Surlignage vert" style={{ padding: '0.3rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.3rem', background: '#a8e6a3', cursor: 'pointer', fontSize: '0.82rem' }}>🟢</button>
              <button onClick={() => applyMarkdownWrap('<mark style="background:#f9c0c0">', '</mark>')} title="Surlignage rose" style={{ padding: '0.3rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.3rem', background: '#f9c0c0', cursor: 'pointer', fontSize: '0.82rem' }}>🌸</button>
              <button onClick={applyBullet} title="Liste à puces" style={{ padding: '0.3rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.3rem', background: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>•</button>
            </div>

            <textarea
              ref={textareaRef}
              value={editingNote.content}
              onChange={e => handleNoteChange('content', e.target.value)}
              placeholder="Commence à écrire ta note..."
              style={{ width: '100%', minHeight: '420px', padding: '0.75rem', border: '1px solid #e0f0ee', borderRadius: '0.5rem', fontSize: '0.95rem', fontFamily: 'monospace', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        ) : (
          <div
            dangerouslySetInnerHTML={{ __html: renderMarkdown(editingNote.content) || '<em style="color:#aaa">Aucun contenu</em>' }}
            style={{ minHeight: '200px', padding: '1rem', border: '1px solid #e0f0ee', borderRadius: '0.5rem', lineHeight: '1.8', fontSize: '0.95rem' }}
          />
        )}

        <p style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.5rem' }}>Sauvegarde automatique 2s après la dernière frappe</p>
      </div>
    )
  }

  // ===================== VUE DÉTAILLÉE =====================
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setSelectedSubject(null)}
          style={{ padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          ← Retour
        </button>
        <h2 style={{ margin: 0, color: subjectColor }}>
          {getSubjectEmoji(selectedSubject.name)} {selectedSubject.name}
        </h2>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
        <button style={tabStyle('notes')} onClick={() => setSubjectTab('notes')}>📝 Notes</button>
        <button style={tabStyle('postits')} onClick={() => setSubjectTab('postits')}>🗒️ Post-its</button>
      </div>

      {/* ==================== ONGLET NOTES ==================== */}
      {subjectTab === 'notes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={handleNewNote} style={{ padding: '0.5rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
              + Nouvelle note
            </button>
          </div>

          {[...pinnedNotes, ...activeNotes].length === 0 && (
            <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem' }}>Aucune note. Crée ta première note !</p>
          )}

          {[...pinnedNotes, ...activeNotes].map(note => (
            <div
              key={note.id}
              style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '0.6rem', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setEditingNote(note)}>
                  <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '0.2rem' }}>
                    {note.pinned && <span style={{ fontSize: '0.75rem', marginRight: '0.35rem' }}>📌</span>}
                    {note.title || 'Sans titre'}
                  </div>
                  {note.content && <div style={{ color: '#999', fontSize: '0.82rem', marginBottom: '0.2rem' }}>{getPreview(note.content)}</div>}
                  <div style={{ color: '#ccc', fontSize: '0.75rem' }}>{fmtDate(note.updated_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.75rem', flexShrink: 0 }}>
                  <button onClick={() => setEditingNote(note)} style={actionBtn} title="Éditer">✏️</button>
                  <button onClick={() => handleTogglePinNote(note)} style={actionBtn} title={note.pinned ? 'Désépingler' : 'Épingler'}>📌</button>
                  <button
                    onClick={() => { setArchivingNoteId(archivingNoteId === note.id ? null : note.id); setArchiveFolderInput('') }}
                    style={actionBtn} title="Archiver"
                  >🗂️</button>
                  <button onClick={() => handleDeleteNote(note.id)} style={{ ...actionBtn, color: '#e63946' }} title="Supprimer">🗑️</button>
                </div>
              </div>

              {archivingNoteId === note.id && (
                <div style={{ borderTop: '1px solid #f0f0f0', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.4rem' }}>Archiver dans quel dossier ?</div>
                  {archiveFolders.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                      {archiveFolders.map(f => (
                        <button key={f} onClick={() => setArchiveFolderInput(f)} style={{ padding: '0.2rem 0.5rem', background: archiveFolderInput === f ? '#2a9d8f' : '#e0f0ee', color: archiveFolderInput === f ? 'white' : '#2a9d8f', border: 'none', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.78rem' }}>
                          📁 {f}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Nom du dossier (vide = sans dossier)"
                    value={archiveFolderInput}
                    onChange={e => setArchiveFolderInput(e.target.value)}
                    style={{ width: '100%', padding: '0.35rem 0.5rem', borderRadius: '0.3rem', border: '1px solid #ddd', fontSize: '0.82rem', boxSizing: 'border-box', marginBottom: '0.4rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleArchiveNote(note.id, archiveFolderInput.trim() || null)} style={{ padding: '0.3rem 0.7rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                      Archiver
                    </button>
                    <button onClick={() => setArchivingNoteId(null)} style={{ padding: '0.3rem 0.7rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Archives */}
          {archivedNotes.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <button
                onClick={() => setShowArchives(!showArchives)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}
              >
                {showArchives ? '▾' : '▸'} 🗂️ Archives ({archivedNotes.length})
              </button>

              {showArchives && (
                <div>
                  {archivedNotes.filter(n => !n.archive_folder).length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ color: '#aaa', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>Sans dossier</div>
                      {archivedNotes.filter(n => !n.archive_folder).map(note => (
                        <ArchivedNoteRow key={note.id} note={note} actionBtn={actionBtn} onUnarchive={() => handleUnarchiveNote(note)} onDelete={() => handleDeleteNote(note.id)} />
                      ))}
                    </div>
                  )}
                  {archiveFolders.map(folder => (
                    <div key={folder} style={{ marginBottom: '1rem' }}>
                      <div style={{ color: '#888', fontSize: '0.78rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>📁 {folder}</div>
                      {archivedNotes.filter(n => n.archive_folder === folder).map(note => (
                        <ArchivedNoteRow key={note.id} note={note} actionBtn={actionBtn} onUnarchive={() => handleUnarchiveNote(note)} onDelete={() => handleDeleteNote(note.id)} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== ONGLET POST-ITS ==================== */}
      {subjectTab === 'postits' && (
        <div>
          {/* Formulaire post-it */}
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
                      <button key={s} onClick={() => setPostitSize(s)} style={{ padding: '0.3rem 0.7rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', background: postitSize === s ? '#2a9d8f' : '#e0f0ee', color: postitSize === s ? 'white' : '#2a9d8f', fontSize: '0.82rem' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.4rem' }}>Icône (facultatif)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {POSTIT_ICONS.map(icon => (
                      <button key={icon} onClick={() => setPostitIcon(postitIcon === icon ? null : icon)} style={{ padding: '0.3rem', border: 'none', borderRadius: '0.3rem', cursor: 'pointer', background: postitIcon === icon ? '#e0f0ee' : 'transparent', fontSize: '1.1rem' }}>
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={postitContent}
                  onChange={e => setPostitContent(e.target.value)}
                  placeholder="Contenu du post-it..."
                  style={{ width: '100%', height: '80px', padding: '0.6rem', border: '1px solid #e0f0ee', borderRadius: '0.5rem', fontSize: '0.9rem', resize: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }}
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

          {/* Grille post-its */}
          {postits.length === 0 ? (
            <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem' }}>Aucun post-it. Crée ton premier post-it !</p>
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

          {/* Archives post-its */}
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
      )}
    </div>
  )
}

function ArchivedNoteRow({ note, actionBtn, onUnarchive, onDelete }: {
  note: Note
  actionBtn: React.CSSProperties
  onUnarchive: () => void
  onDelete: () => void
}) {
  return (
    <div style={{ background: '#fafafa', borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
      <div>
        <div style={{ fontWeight: 'bold', color: '#555', fontSize: '0.88rem' }}>{note.title || 'Sans titre'}</div>
        <div style={{ color: '#bbb', fontSize: '0.75rem' }}>{fmtDate(note.updated_at)}</div>
      </div>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <button onClick={onUnarchive} style={{ ...actionBtn, fontSize: '0.78rem' }}>Restaurer</button>
        <button onClick={onDelete} style={{ ...actionBtn, color: '#e63946' }}>🗑️</button>
      </div>
    </div>
  )
}
