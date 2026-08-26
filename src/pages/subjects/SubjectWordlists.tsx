import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import type { WordListItem, WordEntry } from './types'
import { WORD_LIST_TYPES } from './types'

const SUBJECT_LANGUAGE_MAP: Record<string, string> = {
  'Français': 'Français', 'Anglais': 'Anglais', 'Allemand': 'Allemand',
  'Grec': 'Grec', 'Arabe': 'Arabe', 'Italien': 'Italien',
}

interface SubjectWordlistsProps {
  subjectName: string
}

export default function SubjectWordlists({ subjectName }: SubjectWordlistsProps) {
  const subjectLanguage = SUBJECT_LANGUAGE_MAP[subjectName] || subjectName
  const [wordLists, setWordLists] = useState<WordListItem[]>([])
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({})
  const [showNewListForm, setShowNewListForm] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListType, setNewListType] = useState('vocabulaire')
  const [renamingListId, setRenamingListId] = useState<string | null>(null)
  const [renameListValue, setRenameListValue] = useState('')
  const [editingList, setEditingList] = useState<WordListItem | null>(null)
  const [listItems, setListItems] = useState<WordEntry[]>([])
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [editingItem, setEditingItem] = useState<WordEntry | null>(null)
  const [editSource, setEditSource] = useState('')
  const [editTarget, setEditTarget] = useState('')

  useEffect(() => { fetchWordLists() }, [subjectName])

  const getTargetId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const fetchWordLists = async () => {
    const tid = await getTargetId()
    if (!tid) return
    const { data } = await supabase.from('word_lists').select('*')
      .eq('user_id', tid).eq('language', subjectLanguage).order('name')
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
    if (!tid || !newListName.trim()) return
    const { data } = await supabase.from('word_lists').insert({
      user_id: tid, language: subjectLanguage, name: newListName.trim(), list_type: newListType,
    }).select().single()
    if (data) {
      setWordLists(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setWordCounts(prev => ({ ...prev, [data.id]: 0 }))
    }
    setNewListName(''); setNewListType('vocabulaire'); setShowNewListForm(false)
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

  const inputStyle: CSSProperties = {
    width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd',
    fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem',
  }

  const cardStyle: CSSProperties = {
    background: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.75rem',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }

  const actionBtnStyle: CSSProperties = {
    background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem',
    padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  if (!editingList) {
    return (
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
              <option value="vocabulaire">Vocabulaire</option>
              <option value="conjugaison">Conjugaison</option>
              <option value="dictée">Dictée</option>
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
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button onClick={() => setEditingList(null)} style={{ padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
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
            <div key={item.id} style={{ background: 'var(--color-background)', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
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
  )
}
