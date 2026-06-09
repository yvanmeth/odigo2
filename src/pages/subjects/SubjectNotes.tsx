import { useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { supabase } from '../../lib/supabase'
import { EmptyState } from '../../components/EmptyState'
import type { Note } from './types'
import { fmtDate, getPreview } from './types'

interface SubjectNotesProps {
  userId?: string
  subjectId: number | string
}

function ArchivedNoteRow({ note, actionBtn, onUnarchive, onDelete }: {
  note: Note
  actionBtn: CSSProperties
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

export default function SubjectNotes({ userId, subjectId }: SubjectNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showArchives, setShowArchives] = useState(false)
  const [archivingNoteId, setArchivingNoteId] = useState<string | null>(null)
  const [archiveFolderInput, setArchiveFolderInput] = useState('')
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingNoteRef = useRef<Note | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    onUpdate: ({ editor }) => debouncedSaveContent(editor.getHTML()),
  })

  useEffect(() => { fetchNotes() }, [subjectId])
  useEffect(() => { editingNoteRef.current = editingNote }, [editingNote])
  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(editingNote?.content || '', { emitUpdate: false })
  }, [editor, editingNote?.id])

  const getTargetId = async () => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const fetchNotes = async () => {
    const tid = await getTargetId()
    if (!tid) return
    const { data } = await supabase
      .from('notes').select('*')
      .eq('user_id', tid).eq('subject_id', subjectId)
      .order('pinned', { ascending: false }).order('updated_at', { ascending: false })
    if (data) setNotes(data)
  }

  const handleNewNote = async () => {
    const tid = await getTargetId()
    if (!tid) return
    const { data } = await supabase.from('notes').insert({
      user_id: tid, subject_id: subjectId,
      title: 'Nouvelle note', content: '', archived: false, archive_folder: null, pinned: false,
    }).select().single()
    if (data) { setNotes(prev => [data, ...prev]); setEditingNote(data) }
  }

  const handleSaveNote = useCallback(async (note: Note) => {
    await supabase.from('notes').update({
      title: note.title, content: note.content, updated_at: new Date().toISOString(),
    }).eq('id', note.id)
  }, [])

  const handleNoteTitleChange = (title: string) => {
    if (!editingNote) return
    const updated = { ...editingNote, title }
    setEditingNote(updated)
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => handleSaveNote(updated), 2000)
  }

  const debouncedSaveContent = useCallback((html: string) => {
    const current = editingNoteRef.current
    if (!current) return
    const updated = { ...current, content: html }
    editingNoteRef.current = updated
    setEditingNote(updated)
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => handleSaveNote(updated), 2000)
  }, [handleSaveNote])

  const handleEditorBack = () => {
    if (saveDebounceRef.current) { clearTimeout(saveDebounceRef.current); saveDebounceRef.current = null }
    if (editingNote) handleSaveNote(editingNote)
    setEditingNote(null)
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

  const pinnedNotes = notes.filter(n => n.pinned && !n.archived)
  const activeNotes = notes.filter(n => !n.pinned && !n.archived)
  const archivedNotes = notes.filter(n => n.archived)
  const archiveFolders = [...new Set(archivedNotes.map(n => n.archive_folder).filter(Boolean))] as string[]

  const toolBtnStyle = (active: boolean): CSSProperties => ({
    padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer',
    background: active ? '#2a9d8f' : '#e0f0ee', color: active ? 'white' : '#2a9d8f',
    fontSize: '0.85rem', fontWeight: 'bold',
  })

  const actionBtn: CSSProperties = {
    background: '#f0f0f0', border: 'none', borderRadius: '0.3rem',
    padding: '0.25rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  if (editingNote) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={handleEditorBack} style={{ padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            ← Retour aux notes
          </button>
        </div>

        <input
          value={editingNote.title}
          onChange={e => handleNoteTitleChange(e.target.value)}
          placeholder="Titre de la note"
          style={{ width: '100%', fontSize: '1.3rem', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #e0f0ee', padding: '0.5rem 0', marginBottom: '1rem', outline: 'none', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={editor?.isActive('heading', { level: 1 }) ? 'titre' : editor?.isActive('heading', { level: 2 }) ? 'sous-titre' : 'normal'}
            onChange={e => {
              const val = e.target.value
              if (val === 'normal') editor?.chain().focus().setParagraph().run()
              if (val === 'titre') editor?.chain().focus().toggleHeading({ level: 1 }).run()
              if (val === 'sous-titre') editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }}
            style={{ padding: '0.3rem 0.5rem', borderRadius: '0.4rem', border: '1px solid #e0f0ee', fontSize: '0.85rem', cursor: 'pointer', color: '#2a9d8f' }}
          >
            <option value="normal">Normal</option>
            <option value="titre">Titre</option>
            <option value="sous-titre">Sous-titre</option>
          </select>
          <span style={{ width: '1px', background: '#e0f0ee', alignSelf: 'stretch', margin: '0 0.25rem' }} />
          <button onClick={() => editor?.chain().focus().toggleBold().run()} title="Gras" style={toolBtnStyle(!!editor?.isActive('bold'))}>B</button>
          <button onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italique" style={{ ...toolBtnStyle(!!editor?.isActive('italic')), fontStyle: 'italic' }}>I</button>
          <span style={{ width: '1px', background: '#e0f0ee', alignSelf: 'stretch', margin: '0 0.25rem' }} />
          <button onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Liste à puces" style={toolBtnStyle(!!editor?.isActive('bulletList'))}>• Liste</button>
          <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Liste numérotée" style={toolBtnStyle(!!editor?.isActive('orderedList'))}>1. Liste</button>
          <span style={{ width: '1px', background: '#e0f0ee', alignSelf: 'stretch', margin: '0 0.25rem' }} />
          <button onClick={() => editor?.chain().focus().setTextAlign('left').run()} title="Aligner à gauche" style={toolBtnStyle(!!editor?.isActive({ textAlign: 'left' }))}>⬅</button>
          <button onClick={() => editor?.chain().focus().setTextAlign('center').run()} title="Centrer" style={toolBtnStyle(!!editor?.isActive({ textAlign: 'center' }))}>↔</button>
          <button onClick={() => editor?.chain().focus().setTextAlign('right').run()} title="Aligner à droite" style={toolBtnStyle(!!editor?.isActive({ textAlign: 'right' }))}>➡</button>
          <span style={{ width: '1px', background: '#e0f0ee', alignSelf: 'stretch', margin: '0 0.25rem' }} />
          <button onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fff176' }).run()} title="Surligner en jaune" style={toolBtnStyle(!!editor?.isActive('highlight', { color: '#fff176' }))}>🟡</button>
          <button onClick={() => editor?.chain().focus().toggleHighlight({ color: '#a8e6a3' }).run()} title="Surligner en vert" style={toolBtnStyle(!!editor?.isActive('highlight', { color: '#a8e6a3' }))}>🟢</button>
          <button onClick={() => editor?.chain().focus().toggleHighlight({ color: '#f9c0c0' }).run()} title="Surligner en rose" style={toolBtnStyle(!!editor?.isActive('highlight', { color: '#f9c0c0' }))}>🌸</button>
        </div>

        <div className="odigo-note-editor" style={{ border: '1px solid #e0f0ee', borderRadius: '0.5rem', padding: '0.75rem', minHeight: '420px' }}>
          <EditorContent editor={editor} />
        </div>

        <p style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.5rem' }}>Sauvegarde automatique 2s après la dernière frappe</p>

        <style>{`
          .odigo-note-editor .ProseMirror { outline: none; font-size: 0.95rem; line-height: 1.7; min-height: 380px; }
          .odigo-note-editor .ProseMirror p { margin: 0 0 0.6rem 0; }
          .odigo-note-editor .ProseMirror ul, .odigo-note-editor .ProseMirror ol { margin: 0 0 0.6rem 1.2rem; padding: 0; }
          .odigo-note-editor .ProseMirror mark { border-radius: 0.2rem; padding: 0 0.15rem; }
          .odigo-note-editor .ProseMirror h1 { font-size: 1.5rem; font-weight: bold; margin: 0.4rem 0 0.6rem 0; }
          .odigo-note-editor .ProseMirror h2 { font-size: 1.2rem; font-weight: bold; margin: 0.4rem 0 0.6rem 0; }
        `}</style>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button onClick={handleNewNote} style={{ padding: '0.5rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
          + Nouvelle note
        </button>
      </div>

      {[...pinnedNotes, ...activeNotes].length === 0 && (
        <EmptyState emoji="📝" title="Aucune note" subtitle="Commence à prendre des notes pour cette matière." />
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
  )
}
