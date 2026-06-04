import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Subject } from '../type/index'

interface WordList {
  id: string
  user_id: string
  subject_id: number
  name: string
  list_type: string
  created_at: string
}

interface WordItem {
  id: string
  list_id: string
  source_word: string
  target_word: string
  context?: string
  created_at: string
}

export default function WordLists({ userId }: { userId?: string }) {
  const [lists, setLists] = useState<WordList[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedList, setSelectedList] = useState<WordList | null>(null)
  const [items, setItems] = useState<WordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewList, setShowNewList] = useState(false)

  // New list form
  const [newListName, setNewListName] = useState('')
  const [newListSubject, setNewListSubject] = useState('')
  const [newListType, setNewListType] = useState('vocabulary')

  // New word form
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newContext, setNewContext] = useState('')

  // Edit word
  const [editingItem, setEditingItem] = useState<WordItem | null>(null)
  const [editSource, setEditSource] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editContext, setEditContext] = useState('')
  const [importWords, setImportWords] = useState<{ source: string; target: string; selected: boolean }[]>([])
  const [importLoading, setImportLoading] = useState(false)
  
  const handleImageImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedList) return
    setImportLoading(true)
  
    const base64 = await new Promise<string>((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res((reader.result as string).split(',')[1])
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
  
    const isVocab = selectedList.list_type === 'vocabulary'
  
    const prompt = isVocab
  ? `Tu vois une liste de vocabulaire. Extrais tous les mots. Pour chaque mot, fournis sa traduction en français, peu importe la langue source ou si une traduction dans une autre langue est déjà visible dans l'image. Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sous cette forme exacte: [{"source":"mot en langue étrangère","target":"traduction en français"}].`
  : `Tu vois une liste de mots. Extrais tous les mots. Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sous cette forme exacte: [{"source":"mot","target":""}].`
  
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
              { type: 'text', text: prompt }
            ]
          }]
        })
      })
  
      const data = await response.json()
      const text = data.content?.[0]?.text || '[]'
      const clean = text.replace(/```json|```/g, '').trim()
const parsed = JSON.parse(clean)
      setImportWords(parsed.map((w: { source: string; target: string }) => ({ ...w, selected: true })))
    } catch (err) {
      console.error('Erreur import image:', err)
    }
  
    setImportLoading(false)
    e.target.value = ''
  }
  
  const handleConfirmImport = async () => {
    if (!selectedList) return
    const toImport = importWords.filter(w => w.selected && w.source.trim())
    for (const w of toImport) {
      await supabase.from('word_items').insert({
        list_id: selectedList.id,
        source_word: w.source,
        target_word: w.target || null,
        context: null,
      })
    }
    setImportWords([])
    fetchItems(selectedList.id)
  }
  useEffect(() => {
    fetchLists()
    fetchSubjects()
  }, [])

  const fetchLists = async () => {
    setLoading(true)
    const { data } = await supabase.from('word_lists').select('*').order('created_at', { ascending: false })
    if (data) setLists(data)
    setLoading(false)
  }

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('name')
    if (data) setSubjects(data)
  }

  const fetchItems = async (listId: string) => {
    const { data } = await supabase.from('word_items').select('*').eq('list_id', listId).order('created_at')
    if (data) setItems(data)
  }

  const handleCreateList = async () => {
    if (!newListName || !newListSubject) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('word_lists').insert({
      user_id: user?.id,
      name: newListName,
      subject_id: parseInt(newListSubject),
      list_type: newListType,
    })
    setNewListName(''); setNewListSubject(''); setNewListType('vocabulary')
    setShowNewList(false)
    fetchLists()
  }

  const handleDeleteList = async (id: string) => {
    await supabase.from('word_items').delete().eq('list_id', id)
    await supabase.from('word_lists').delete().eq('id', id)
    if (selectedList?.id === id) setSelectedList(null)
    fetchLists()
  }

  const handleSelectList = (list: WordList) => {
    setSelectedList(list)
    fetchItems(list.id)
  }

  const handleAddWord = async () => {
    if (!newSource || !selectedList) return
    await supabase.from('word_items').insert({
      list_id: selectedList.id,
      source_word: newSource,
      target_word: newTarget || null,
      context: newContext || null,
    })
    setNewSource(''); setNewTarget(''); setNewContext('')
    fetchItems(selectedList.id)
  }

  const handleDeleteWord = async (id: string) => {
    await supabase.from('word_items').delete().eq('id', id)
    if (selectedList) fetchItems(selectedList.id)
  }

  const handleEditWord = async () => {
    if (!editingItem) return
    await supabase.from('word_items').update({
      source_word: editSource,
      target_word: editTarget || null,
      context: editContext || null,
    }).eq('id', editingItem.id)
    setEditingItem(null)
    if (selectedList) fetchItems(selectedList.id)
  }

  const startEdit = (item: WordItem) => {
    setEditingItem(item)
    setEditSource(item.source_word)
    setEditTarget(item.target_word || '')
    setEditContext(item.context || '')
  }

  const getSubjectName = (id: number) => subjects.find(s => Number(s.id) === id)?.name || '?'

  const inputStyle = {
    width: '100%',
    padding: '0.6rem',
    borderRadius: '0.5rem',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    boxSizing: 'border-box' as const,
    marginBottom: '0.75rem',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

      {/* Colonne gauche — liste des listes */}
      <div style={{ width: '280px', flexShrink: 0 }}>
        <button
          onClick={() => setShowNewList(!showNewList)}
          style={{ width: '100%', padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.9rem' }}
        >
          {showNewList ? '✕ Annuler' : '+ Nouvelle liste'}
        </button>

        {showNewList && (
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
            <input type="text" placeholder="Nom de la liste" value={newListName} onChange={e => setNewListName(e.target.value)} style={inputStyle} />
            <select value={newListSubject} onChange={e => setNewListSubject(e.target.value)} style={inputStyle}>
              <option value="">Choisir une matière</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={newListType} onChange={e => setNewListType(e.target.value)} style={inputStyle}>
              <option value="vocabulary">Vocabulaire</option>
              <option value="conjugation">Conjugaison</option>
              <option value="dictation">Dictée / Orthographe</option>
            </select>
            <button onClick={handleCreateList} style={{ width: '100%', padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Créer</button>
          </div>
        )}

        {lists.length === 0 && <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune liste.</p>}

        {lists.map(list => (
          <div
            key={list.id}
            onClick={() => handleSelectList(list)}
            style={{
              background: selectedList?.id === list.id ? '#f0faf8' : 'white',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              marginBottom: '0.5rem',
              cursor: 'pointer',
              borderLeft: selectedList?.id === list.id ? '3px solid #2a9d8f' : '3px solid transparent',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>{list.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#888' }}>{getSubjectName(list.subject_id)} · {list.list_type}</div>
            <button
              onClick={e => { e.stopPropagation(); handleDeleteList(list.id) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e63946', fontSize: '0.8rem', marginTop: '0.25rem' }}
            >
              🗑 Supprimer
            </button>
          </div>
        ))}
      </div>

      {/* Colonne droite — mots de la liste */}
      <div style={{ flex: 1 }}>
        {!selectedList ? (
          <div style={{ background: 'white', borderRadius: '0.75rem', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center', color: '#aaa' }}>
            Sélectionne une liste pour voir ses mots.
          </div>
        ) : (
          <div>
            <h2 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>
              {selectedList.name} <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.9rem' }}>({items.length} mot{items.length > 1 ? 's' : ''})</span>
            </h2>

{/* Import par image */}
<div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: importWords.length > 0 ? '1rem' : '0' }}>
    <label style={{ padding: '0.6rem 1rem', background: '#e0f0ee', color: '#2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
      📷 Importer par image
      <input type="file" accept="image/*" onChange={handleImageImport} style={{ display: 'none' }} />
    </label>
    {importLoading && <span style={{ color: '#888', fontSize: '0.9rem' }}>Analyse en cours...</span>}
  </div>

  {importWords.length > 0 && (
    <div>
      <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Mots détectés — coche ceux à importer :</p>
      <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem' }}>
        {importWords.map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', borderBottom: '1px solid #f5f5f5' }}>
            <input type="checkbox" checked={w.selected} onChange={() => {
              const updated = [...importWords]
              updated[i].selected = !updated[i].selected
              setImportWords(updated)
            }} />
            <span style={{ flex: 1, fontSize: '0.9rem' }}><strong>{w.source}</strong>{w.target ? ` → ${w.target}` : ''}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setImportWords(importWords.map(w => ({ ...w, selected: true })))}
          style={{ padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Tout sélectionner
        </button>
        <button
          onClick={handleConfirmImport}
          style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Importer la sélection
        </button>
        <button
          onClick={() => setImportWords([])}
          style={{ padding: '0.4rem 0.8rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Annuler
        </button>
      </div>
    </div>
  )}
</div>            
{/* Formulaire ajout mot */}
            <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Mot source *" value={newSource} onChange={e => setNewSource(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                <input type="text" placeholder="Traduction / cible" value={newTarget} onChange={e => setNewTarget(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                <input type="text" placeholder="Contexte (optionnel)" value={newContext} onChange={e => setNewContext(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                <button onClick={handleAddWord} style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Ajouter</button>
              </div>
            </div>

            {/* Liste des mots */}
            {items.length === 0 && <p style={{ color: '#aaa' }}>Aucun mot dans cette liste.</p>}
            {items.map(item => (
              <div key={item.id}>
                {editingItem?.id === item.id ? (
                  <div style={{ background: '#f0faf8', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input type="text" value={editSource} onChange={e => setEditSource(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                      <input type="text" value={editTarget} onChange={e => setEditTarget(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                      <input type="text" value={editContext} onChange={e => setEditContext(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '120px', marginBottom: 0 }} />
                      <button onClick={handleEditWord} style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setEditingItem(null)} style={{ padding: '0.6rem 1rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'white', borderRadius: '0.75rem', padding: '0.75rem 1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>{item.source_word}</span>
                      {item.target_word && <span style={{ color: '#2a9d8f' }}> → {item.target_word}</span>}
                      {item.context && <span style={{ color: '#aaa', fontSize: '0.85rem' }}> ({item.context})</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => startEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✏️</button>
                      <button onClick={() => handleDeleteWord(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e63946', fontSize: '1rem' }}>🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
