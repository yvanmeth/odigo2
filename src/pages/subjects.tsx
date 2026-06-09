import { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { supabase } from '../lib/supabase'
import type { Evaluation, Revision } from '../type/index'

interface SubjectItem {
  id: number | string
  name: string
  emoji: string
  color: string
  isCustom: boolean
  hidden: boolean
  position: number
}

interface Note {
  id: string
  user_id: string
  subject_id: number | string
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
  subject_id: number | string
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

interface WordListItem {
  id: string
  user_id: string
  subject_id: number | string
  name: string
  list_type: string
  created_at: string
}

interface WordEntry {
  id: string
  list_id: string
  source_word: string
  target_word: string | null
  context?: string | null
  created_at: string
}

type SubjectTab = 'evals' | 'notes' | 'postits' | 'wordlists'

const COLOR_PALETTE = [
  '#2a9d8f', '#e9c46a', '#e76f51', '#e63946',
  '#4CAF50', '#5c6bc0', '#e07a9b', '#795548',
  '#00BCD4', '#9C27B0',
]

const FIXED_SUBJECTS = [
  { id: 1, name: 'Français',  emoji: '📖', color: '#4CAF50' },
  { id: 2, name: 'Maths',     emoji: '🔢', color: '#2196F3' },
  { id: 3, name: 'Allemand',  emoji: '🇩🇪', color: '#FF9800' },
  { id: 4, name: 'Anglais',   emoji: '🇬🇧', color: '#9C27B0' },
  { id: 5, name: 'Grec',      emoji: '🏛️', color: '#00BCD4' },
  { id: 6, name: 'Arabe',     emoji: '🌙', color: '#F44336' },
  { id: 7, name: 'Géo',       emoji: '🌍', color: '#795548' },
  { id: 8, name: 'Histoire',  emoji: '⏳', color: '#607D8B' },
]

const POSTIT_COLORS = { yellow: '#fff9c4', green: '#c8e6c9', pink: '#f8bbd0', blue: '#bbdefb' }

const POSTIT_SIZES = {
  small:  { width: '160px', height: '80px' },
  square: { width: '200px', height: '200px' },
  large:  { width: '320px', height: '120px' },
}

const POSTIT_ICONS = ['❤️', '✏️', '⚠️', '⭐', '📌', '✅', '💡', '🔍', '❓', '🎯']

const WORD_LIST_TYPES: Record<string, string> = {
  vocabulary: 'Vocabulaire',
  conjugation: 'Conjugaison',
  dictation: 'Dictée',
}

function getPreview(html: string): string {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > 60 ? plain.substring(0, 60) + '…' : plain
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CH')
}

function fmtDateDMY(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export default function Subjects({ userId }: { userId?: string }) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null)
  const [subjectTab, setSubjectTab] = useState<SubjectTab>('evals')
  const [manageMode, setManageMode] = useState(false)
  const [renamingId, setRenamingId] = useState<string | number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [colorPickerId, setColorPickerId] = useState<string | number | null>(null)

  // Notes
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showArchives, setShowArchives] = useState(false)
  const [archivingNoteId, setArchivingNoteId] = useState<string | null>(null)
  const [archiveFolderInput, setArchiveFolderInput] = useState('')
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingNoteRef = useRef<Note | null>(null)

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

  // Évaluations
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])

  // Listes de mots
  const [wordLists, setWordLists] = useState<WordListItem[]>([])
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({})
  const [showNewListForm, setShowNewListForm] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListType, setNewListType] = useState('vocabulary')
  const [renamingListId, setRenamingListId] = useState<string | null>(null)
  const [renameListValue, setRenameListValue] = useState('')
  const [editingList, setEditingList] = useState<WordListItem | null>(null)
  const [listItems, setListItems] = useState<WordEntry[]>([])
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [editingItem, setEditingItem] = useState<WordEntry | null>(null)
  const [editSource, setEditSource] = useState('')
  const [editTarget, setEditTarget] = useState('')

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

  useEffect(() => { fetchSubjects() }, [])

  useEffect(() => {
    if (selectedSubject) {
      fetchNotes(); fetchPostits(); fetchEvaluations(); fetchWordLists()
      setEditingList(null)
    }
  }, [selectedSubject])

  useEffect(() => { editingNoteRef.current = editingNote }, [editingNote])

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(editingNote?.content || '', { emitUpdate: false })
  }, [editor, editingNote?.id])

  const getTargetId = async (): Promise<string | undefined> => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  // ==================== MATIÈRES ====================

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
      const entry = entries.find(e => e.subject_id === fs.id)
      list.push({
        id: fs.id, name: fs.name, emoji: fs.emoji, color: fs.color,
        isCustom: false, hidden: entry?.hidden || false, position: idx,
      })
    })
    entries.filter(e => e.subject_id === null && e.custom_name).forEach((e, idx) => {
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
    if (selectedSubject?.id === item.id) setSelectedSubject(null)
  }

  // ==================== ÉVALUATIONS ====================

  const fetchEvaluations = async () => {
    const tid = await getTargetId()
    if (!tid || !selectedSubject) return
    const today = new Date().toISOString().split('T')[0]
    const [evalsRes, revsRes] = await Promise.all([
      supabase.from('evaluations').select('*')
        .eq('user_id', tid).eq('subject_id', selectedSubject.id)
        .gte('evaluation_date', today).order('evaluation_date'),
      supabase.from('revisions').select('*').eq('user_id', tid),
    ])
    if (evalsRes.data) setEvaluations(evalsRes.data)
    if (revsRes.data) setRevisions(revsRes.data)
  }

  // ==================== NOTES ====================

  const fetchNotes = async () => {
    const tid = await getTargetId()
    if (!tid || !selectedSubject) return
    const { data } = await supabase
      .from('notes').select('*')
      .eq('user_id', tid).eq('subject_id', selectedSubject.id)
      .order('pinned', { ascending: false }).order('updated_at', { ascending: false })
    if (data) setNotes(data)
  }

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

  // ==================== POSTITS ====================

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

  // ==================== LISTES DE MOTS ====================

  const fetchWordLists = async () => {
    const tid = await getTargetId()
    if (!tid || !selectedSubject) return
    const { data } = await supabase.from('word_lists').select('*')
      .eq('user_id', tid).eq('subject_id', selectedSubject.id).order('name')
    if (data) {
      setWordLists(data)
      const counts: Record<string, number> = {}
      await Promise.all(data.map(async (l: WordListItem) => {
        const { count } = await supabase.from('word_items').select('id', { count: 'exact', head: true }).eq('list_id', l.id)
        counts[l.id] = count || 0
      }))
      setWordCounts(counts)
    }
  }

  const handleCreateList = async () => {
    const tid = await getTargetId()
    if (!tid || !selectedSubject || !newListName.trim()) return
    const { data } = await supabase.from('word_lists').insert({
      user_id: tid, subject_id: selectedSubject.id, name: newListName.trim(), list_type: newListType,
    }).select().single()
    if (data) {
      setWordLists(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setWordCounts(prev => ({ ...prev, [data.id]: 0 }))
    }
    setNewListName(''); setNewListType('vocabulary'); setShowNewListForm(false)
  }

  const handleSaveListRename = async (list: WordListItem) => {
    const name = renameListValue.trim()
    setRenamingListId(null)
    if (!name || name === list.name) return
    await supabase.from('word_lists').update({ name }).eq('id', list.id)
    setWordLists(prev => prev.map(l => l.id === list.id ? { ...l, name } : l))
    if (editingList?.id === list.id) setEditingList({ ...editingList, name })
  }

  const handleDeleteList = async (id: string) => {
    await supabase.from('word_items').delete().eq('list_id', id)
    await supabase.from('word_lists').delete().eq('id', id)
    if (editingList?.id === id) setEditingList(null)
    setWordLists(prev => prev.filter(l => l.id !== id))
  }

  const fetchListItems = async (listId: string) => {
    const { data } = await supabase.from('word_items').select('*').eq('list_id', listId).order('created_at')
    if (data) setListItems(data)
  }

  const handleSelectList = (list: WordListItem) => {
    setEditingList(list)
    setEditingItem(null)
    setNewSource(''); setNewTarget('')
    fetchListItems(list.id)
  }

  const handleAddWord = async () => {
    if (!editingList || !newSource.trim()) return
    await supabase.from('word_items').insert({
      list_id: editingList.id, source_word: newSource.trim(), target_word: newTarget.trim() || null,
    })
    setNewSource(''); setNewTarget('')
    fetchListItems(editingList.id)
    setWordCounts(prev => ({ ...prev, [editingList.id]: (prev[editingList.id] || 0) + 1 }))
  }

  const startEditWord = (item: WordEntry) => {
    setEditingItem(item); setEditSource(item.source_word); setEditTarget(item.target_word || '')
  }

  const handleSaveWord = async () => {
    if (!editingItem) return
    await supabase.from('word_items').update({
      source_word: editSource.trim(), target_word: editTarget.trim() || null,
    }).eq('id', editingItem.id)
    setEditingItem(null)
    if (editingList) fetchListItems(editingList.id)
  }

  const handleDeleteWord = async (id: string) => {
    await supabase.from('word_items').delete().eq('id', id)
    if (editingList) {
      fetchListItems(editingList.id)
      setWordCounts(prev => ({ ...prev, [editingList.id]: Math.max(0, (prev[editingList.id] || 1) - 1) }))
    }
  }

  // ==================== DÉRIVÉS / STYLES ====================

  const pinnedNotes = notes.filter(n => n.pinned && !n.archived)
  const activeNotes = notes.filter(n => !n.pinned && !n.archived)
  const archivedNotes = notes.filter(n => n.archived)
  const archiveFolders = [...new Set(archivedNotes.map(n => n.archive_folder).filter(Boolean))] as string[]

  const subjectColor = selectedSubject?.color || '#2a9d8f'
  const visibleSubjects = subjects.filter(s => !s.hidden)
  const hiddenSubjects = subjects.filter(s => s.hidden)

  const tabStyle = (tab: SubjectTab): React.CSSProperties => ({
    padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
    background: subjectTab === tab ? '#2a9d8f' : '#e0f0ee',
    color: subjectTab === tab ? 'white' : '#2a9d8f',
    fontWeight: subjectTab === tab ? 'bold' : 'normal', fontSize: '0.9rem',
  })

  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer',
    background: active ? '#2a9d8f' : '#e0f0ee', color: active ? 'white' : '#2a9d8f',
    fontSize: '0.85rem', fontWeight: 'bold',
  })

  const actionBtn: React.CSSProperties = {
    background: '#f0f0f0', border: 'none', borderRadius: '0.3rem',
    padding: '0.25rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  const actionBtnStyle: React.CSSProperties = {
    background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem',
    padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.75rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd',
    fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem',
  }

  const subjectCardBase: React.CSSProperties = {
    background: 'white', borderRadius: '1rem', padding: '1.5rem 1rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  // ===================== VUE PRINCIPALE =====================
  if (!selectedSubject) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#2a9d8f' }}>Matières</h2>
          <button
            onClick={() => { setManageMode(!manageMode); setRenamingId(null); setColorPickerId(null) }}
            style={{
              padding: '0.5rem 1rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: 'bold',
              background: manageMode ? '#2a9d8f' : '#e0f0ee',
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
                onClick={() => { setSelectedSubject(subject); setSubjectTab('evals') }}
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

  // ===================== ÉDITEUR DE NOTE =====================
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
          {selectedSubject.emoji} {selectedSubject.name}
        </h2>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={tabStyle('evals')} onClick={() => setSubjectTab('evals')}>📅 Évaluations</button>
        <button style={tabStyle('notes')} onClick={() => setSubjectTab('notes')}>📝 Notes</button>
        <button style={tabStyle('postits')} onClick={() => setSubjectTab('postits')}>🗒️ Post-its</button>
        <button style={tabStyle('wordlists')} onClick={() => setSubjectTab('wordlists')}>📋 Listes</button>
      </div>

      {/* ==================== ONGLET ÉVALUATIONS ==================== */}
      {subjectTab === 'evals' && (
        <div>
          {evaluations.length === 0 ? (
            <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem' }}>Aucune évaluation à venir dans cette matière.</p>
          ) : (
            evaluations.map(e => {
              const total = revisions.filter(r => r.evaluation_id === e.id).length
              const done = revisions.filter(r => r.evaluation_id === e.id && r.completed).length
              return (
                <div key={e.id} style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '0.6rem', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{e.topic}</div>
                  <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.2rem' }}>
                    {fmtDateDMY(e.evaluation_date)} · révisions {done}/{total}
                  </div>
                  {e.readiness !== null && e.readiness !== undefined && (
                    <div style={{ fontSize: '0.85rem', color: '#2a9d8f', marginTop: '0.2rem' }}>Note attendue : {e.readiness}/6</div>
                  )}
                  {e.grade !== null && e.grade !== undefined && (
                    <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>Note obtenue : {e.grade}/6</div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

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

      {/* ==================== ONGLET LISTES ==================== */}
      {subjectTab === 'wordlists' && (
        <div>
          {!editingList ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button onClick={() => setShowNewListForm(!showNewListForm)} style={{ padding: '0.5rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {showNewListForm ? '✕ Annuler' : '+ Nouvelle liste'}
                </button>
              </div>

              {showNewListForm && (
                <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem', maxWidth: '420px' }}>
                  <input type="text" placeholder="Nom de la liste" value={newListName} onChange={e => setNewListName(e.target.value)} style={inputStyle} />
                  <select value={newListType} onChange={e => setNewListType(e.target.value)} style={inputStyle}>
                    <option value="vocabulary">Vocabulaire</option>
                    <option value="conjugation">Conjugaison</option>
                    <option value="dictation">Dictée</option>
                  </select>
                  <button onClick={handleCreateList} style={{ width: '100%', padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Créer</button>
                </div>
              )}

              {wordLists.length === 0 ? (
                <p style={{ color: '#aaa', textAlign: 'center', padding: '2rem' }}>Aucune liste de mots dans cette matière.</p>
              ) : (
                wordLists.map(list => (
                  <div key={list.id} style={cardStyle}>
                    {renamingListId === list.id ? (
                      <input
                        autoFocus
                        value={renameListValue}
                        onChange={e => setRenameListValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveListRename(list) }}
                        onBlur={() => handleSaveListRename(list)}
                        style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #2a9d8f', fontSize: '0.9rem', marginRight: '0.75rem' }}
                      />
                    ) : (
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => handleSelectList(list)}>
                        <div style={{ fontWeight: 'bold', color: '#333' }}>{list.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#888' }}>
                          {WORD_LIST_TYPES[list.list_type] || list.list_type} · {wordCounts[list.id] ?? 0} mot{(wordCounts[list.id] ?? 0) > 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button onClick={() => { setRenamingListId(list.id); setRenameListValue(list.name) }} style={actionBtnStyle} title="Renommer">✏️</button>
                      <button onClick={() => handleDeleteList(list.id)} style={actionBtnStyle} title="Supprimer">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <button onClick={() => setEditingList(null)} style={{ padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  ← Retour aux listes
                </button>
                <h3 style={{ margin: 0, color: '#2a9d8f', fontSize: '1.1rem' }}>{editingList.name}</h3>
              </div>

              <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Mot source" value={newSource} onChange={e => setNewSource(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '140px', marginBottom: 0 }} />
                  <input type="text" placeholder="Traduction" value={newTarget} onChange={e => setNewTarget(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '140px', marginBottom: 0 }} />
                  <button onClick={handleAddWord} style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Ajouter</button>
                </div>
              </div>

              {listItems.length === 0 ? (
                <p style={{ color: '#aaa' }}>Aucun mot dans cette liste.</p>
              ) : (
                listItems.map(item => (
                  editingItem?.id === item.id ? (
                    <div key={item.id} style={{ background: '#f0faf8', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input type="text" value={editSource} onChange={e => setEditSource(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                        <input type="text" value={editTarget} onChange={e => setEditTarget(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                        <button onClick={handleSaveWord} style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setEditingItem(null)} style={{ padding: '0.6rem 1rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div key={item.id} style={{ background: 'white', borderRadius: '0.75rem', padding: '0.75rem 1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{item.source_word}</span>
                        {item.target_word && <span style={{ color: '#2a9d8f' }}> → {item.target_word}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => startEditWord(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✏️</button>
                        <button onClick={() => handleDeleteWord(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e63946', fontSize: '1rem' }}>🗑️</button>
                      </div>
                    </div>
                  )
                ))
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
