import { useEffect, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { Pencil, Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import HelpBubble from '../components/HelpBubble'
import { EmptyState } from '../components/EmptyState'

interface WordList {
  id: string
  user_id: string
  name: string
  list_type: string
  language: string
  share_code: string
  created_at: string
}

interface WordItem {
  id: string
  list_id: string
  source_word: string
  target_word: string | null
  context?: string | null
  created_at: string
}

const LANGUAGES = ['Anglais', 'Allemand', 'Grec', 'Espagnol', 'Arabe', 'Italien', 'Français']

const LIST_TYPE_LABELS: Record<string, string> = {
  vocabulaire: 'Vocabulaire',
  conjugaison: 'Conjugaison',
  dictée: 'Dictée',
}

const LIST_TYPE_COLORS: Record<string, string> = {
  vocabulaire: '#2a9d8f',
  conjugaison: '#e76f51',
  dictée: '#e9c46a',
}


function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}.${m}.${y}`
}

function isSingleColumn(list: WordList): boolean {
  return list.list_type === 'conjugaison' || list.language === 'Français'
}

export default function WordLists({ userId }: { userId?: string }) {
  const { showToast } = useToast()
  const [lists, setLists] = useState<WordList[]>([])
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({})
  const [selectedList, setSelectedList] = useState<WordList | null>(null)
  const [editingList, setEditingList] = useState<WordList | null>(null)
  const [items, setItems] = useState<WordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewList, setShowNewList] = useState(false)

  // New list form
  const [newListName, setNewListName] = useState('')
  const [newListType, setNewListType] = useState('vocabulaire')
  const [newListLang, setNewListLang] = useState('Anglais')

  // Import d'une liste partagée
  const [showImportForm, setShowImportForm] = useState(false)
  const [shareCodeInput, setShareCodeInput] = useState('')
  const [shareImportLoading, setShareImportLoading] = useState(false)

  // Edit list form
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('vocabulaire')
  const [editLang, setEditLang] = useState('Anglais')

  // New word form
  const [newSource, setNewSource] = useState('')
  const [newTarget, setNewTarget] = useState('')

  // Edit word
  const [editingItem, setEditingItem] = useState<WordItem | null>(null)
  const [editSource, setEditSource] = useState('')
  const [editTarget, setEditTarget] = useState('')
  const [editContext, setEditContext] = useState('')

  // Import
  const [importWords, setImportWords] = useState<{ source: string; target: string; selected: boolean }[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [showPasteZone, setShowPasteZone] = useState(false)
  const [parsedRows, setParsedRows] = useState<{ source: string; target: string; context: string; selected: boolean }[]>([])
  const [showParsedPreview, setShowParsedPreview] = useState(false)

  useEffect(() => {
    fetchLists()
  }, [userId])

  const getTargetId = async (): Promise<string | undefined> => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const fetchLists = async () => {
    setLoading(true)
    const tid = await getTargetId()
    const { data } = await supabase
      .from('word_lists')
      .select('*')
      .eq('user_id', tid)
      .order('created_at', { ascending: false })
    if (data && data.length > 0) {
      setLists(data as WordList[])
      const { data: wdata } = await supabase
        .from('word_items')
        .select('list_id')
        .in('list_id', data.map((l: WordList) => l.id))
      if (wdata) {
        const counts: Record<string, number> = {}
        for (const row of wdata) {
          counts[row.list_id] = (counts[row.list_id] || 0) + 1
        }
        setWordCounts(counts)
      }
    } else {
      setLists([])
    }
    setLoading(false)
  }

  const fetchItems = async (listId: string) => {
    const { data } = await supabase.from('word_items').select('*').eq('list_id', listId).order('created_at')
    if (data) setItems(data)
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) return
    const tid = await getTargetId()
    await supabase.from('word_lists').insert({
      user_id: tid,
      name: newListName.trim(),
      list_type: newListType,
      language: newListLang,
    })
    setNewListName(''); setNewListType('vocabulaire'); setNewListLang('Anglais')
    setShowNewList(false)
    showToast('Liste créée')
    fetchLists()
  }

  const handleImportList = async () => {
    if (shareCodeInput.length !== 5) {
      showToast('Le code doit faire 5 caractères', 'error')
      return
    }

    setShareImportLoading(true)

    const { data: sourceList, error: findError } = await supabase
      .from('word_lists')
      .select('*')
      .eq('share_code', shareCodeInput)
      .single()

    if (findError || !sourceList) {
      showToast('Code introuvable', 'error')
      setShareImportLoading(false)
      return
    }

    const { data: sourceWords } = await supabase
      .from('word_items')
      .select('source_word, target_word, context')
      .eq('list_id', sourceList.id)

    const tid = await getTargetId()

    const { data: newList, error: insertError } = await supabase
      .from('word_lists')
      .insert({
        user_id: tid,
        name: sourceList.name + ' (partagée)',
        list_type: sourceList.list_type,
        language: sourceList.language,
      })
      .select()
      .single()

    if (insertError || !newList) {
      showToast("Erreur lors de l'import", 'error')
      setShareImportLoading(false)
      return
    }

    if (sourceWords && sourceWords.length > 0) {
      await supabase.from('word_items').insert(
        sourceWords.map(w => ({
          list_id: newList.id,
          source_word: w.source_word,
          target_word: w.target_word,
          context: w.context,
        }))
      )
    }

    showToast(`Liste "${sourceList.name}" importée !`)
    setShareCodeInput('')
    setShowImportForm(false)
    setShowNewList(false)
    fetchLists()
    setShareImportLoading(false)
  }

  const handleUpdateList = async () => {
    if (!editingList || !editName.trim()) return
    await supabase.from('word_lists').update({
      name: editName.trim(),
      list_type: editType,
      language: editLang,
    }).eq('id', editingList.id)
    setEditingList(null)
    fetchLists()
  }

  const openEditList = (list: WordList) => {
    setEditingList(list)
    setEditName(list.name)
    setEditType(list.list_type)
    setEditLang(list.language || 'Anglais')
    setSelectedList(null)
  }

  const handleDeleteList = async (id: string) => {
    await supabase.from('word_items').delete().eq('list_id', id)
    await supabase.from('word_lists').delete().eq('id', id)
    if (selectedList?.id === id) setSelectedList(null)
    showToast('Supprimé', 'info')
    fetchLists()
  }

  const handleSelectList = (list: WordList) => {
    setSelectedList(list)
    setEditingList(null)
    setEditingItem(null)
    setNewSource(''); setNewTarget('')
    fetchItems(list.id)
  }

  const handleAddWord = async () => {
    if (!newSource.trim() || !selectedList) return
    await supabase.from('word_items').insert({
      list_id: selectedList.id,
      source_word: newSource.trim(),
      target_word: newTarget.trim() || null,
    })
    setNewSource(''); setNewTarget('')
    showToast('Mot ajouté')
    fetchItems(selectedList.id)
    setWordCounts(prev => ({ ...prev, [selectedList.id]: (prev[selectedList.id] || 0) + 1 }))
  }

  const handleDeleteWord = async (id: string) => {
    await supabase.from('word_items').delete().eq('id', id)
    showToast('Supprimé', 'info')
    if (selectedList) {
      fetchItems(selectedList.id)
      setWordCounts(prev => ({ ...prev, [selectedList.id]: Math.max(0, (prev[selectedList.id] || 1) - 1) }))
    }
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

  // ==================== IMPORT ====================

  const parseTabularData = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    return lines.map(line => {
      const cols = line.split('\t').map(c => c.trim())
      return { source: cols[0] || '', target: cols[1] || '', context: cols[2] || '', selected: true }
    }).filter(r => r.source)
  }

  const handlePasteParse = () => {
    if (!pasteText.trim()) return
    setParsedRows(parseTabularData(pasteText))
    setShowParsedPreview(true)
  }

  const handleFileImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    let rows: { source: string; target: string; context: string; selected: boolean }[] = []
    if (file.name.endsWith('.csv')) {
      const lines = text.trim().split('\n').filter(l => l.trim())
      rows = lines.map(line => {
        const cols = line.split(/[,;]/).map(c => c.trim().replace(/^"|"$/g, ''))
        return { source: cols[0] || '', target: cols[1] || '', context: cols[2] || '', selected: true }
      }).filter(r => r.source)
    }
    setParsedRows(rows); setShowParsedPreview(true); e.target.value = ''
  }

  const handleConfirmParsed = async () => {
    if (!selectedList) return
    const toImport = parsedRows.filter(r => r.selected && r.source.trim())
    for (const r of toImport) {
      await supabase.from('word_items').insert({
        list_id: selectedList.id, source_word: r.source,
        target_word: r.target || null, context: r.context || null,
      })
    }
    setParsedRows([]); setShowParsedPreview(false); setPasteText(''); setShowPasteZone(false)
    fetchItems(selectedList.id)
    setWordCounts(prev => ({ ...prev, [selectedList.id]: (prev[selectedList.id] || 0) + toImport.length }))
  }

  const handleImageImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedList) return
    setImportLoading(true)
    const base64 = await new Promise<string>((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res((reader.result as string).split(',')[1])
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
    const isVocab = selectedList.list_type === 'vocabulaire'
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
          model: 'claude-sonnet-4-5', max_tokens: 1000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
            { type: 'text', text: prompt },
          ]}],
        }),
      })
      const data = await response.json()
      const txt = data.content?.[0]?.text || '[]'
      const clean = txt.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setImportWords(parsed.map((w: { source: string; target: string }) => ({ ...w, selected: true })))
    } catch (err) {
      console.error('Erreur import image:', err)
    }
    setImportLoading(false); e.target.value = ''
  }

  const handleConfirmImport = async () => {
    if (!selectedList) return
    const toImport = importWords.filter(w => w.selected && w.source.trim())
    for (const w of toImport) {
      await supabase.from('word_items').insert({
        list_id: selectedList.id, source_word: w.source, target_word: w.target || null, context: null,
      })
    }
    setImportWords([])
    fetchItems(selectedList.id)
    setWordCounts(prev => ({ ...prev, [selectedList.id]: (prev[selectedList.id] || 0) + toImport.length }))
  }

  // ==================== STYLES ====================

  const inputStyle: CSSProperties = {
    width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd',
    fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem',
  }

  const actionBtnStyle: CSSProperties = {
    background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem',
    padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem',
  }

  const thStyle: CSSProperties = {
    padding: '0.75rem 1rem', textAlign: 'left', color: '#2a9d8f',
    fontSize: '0.85rem', fontWeight: 'bold',
  }

  const labelStyle: CSSProperties = {
    display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '0.25rem',
  }

  const hintStyle: CSSProperties = {
    fontSize: '0.78rem', color: '#aaa', marginTop: '-0.5rem', marginBottom: '1rem',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  // ==================== VUE DÉTAIL ====================
  if (selectedList) {
    const singleCol = isSingleColumn(selectedList)
    const sourceLang = selectedList.language || 'Source'
    const typeBg = LIST_TYPE_COLORS[selectedList.list_type] || '#aaa'
    const typeLabel = LIST_TYPE_LABELS[selectedList.list_type] || selectedList.list_type

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setSelectedList(null); setEditingItem(null) }}
            style={{ padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Retour
          </button>
          <h2 style={{ margin: 0, color: '#2a9d8f', fontSize: '1.1rem' }}>{selectedList.name}</h2>
          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '1rem', background: typeBg, color: typeBg === '#e9c46a' ? '#555' : 'white', fontSize: '0.78rem', fontWeight: 'bold' }}>
            {typeLabel}
          </span>
          {selectedList.language && (
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '1rem', background: 'var(--color-border)', color: '#2a9d8f', fontSize: '0.78rem', fontWeight: 'bold' }}>
              {selectedList.language}
            </span>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'var(--color-background)', borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem', marginBottom: '1.5rem',
          width: 'fit-content',
        }}>
          <span style={{ fontSize: '0.85rem', color: '#888' }}>
            Code de partage :
          </span>
          <span style={{
            fontWeight: 'bold', fontSize: '1rem',
            color: '#2a9d8f', letterSpacing: '0.1em',
          }}>
            {selectedList.share_code}
          </span>
          <button onClick={() => {
            navigator.clipboard.writeText(selectedList.share_code)
            showToast('Code copié !')
          }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#2a9d8f', padding: '0.2rem',
          }}>
            📋
          </button>
        </div>

        {/* Tableau des mots */}
        <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-background)' }}>
                <th style={{ ...thStyle, width: '2.5rem' }}>#</th>
                <th style={thStyle}>{singleCol ? 'Mot' : sourceLang}</th>
                {!singleCol && <th style={thStyle}>Français</th>}
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={singleCol ? 3 : 4}>
                    <EmptyState emoji="✏️" title="Cette liste est vide" subtitle="Ajoute des mots pour pouvoir faire des exercices." />
                  </td>
                </tr>
              )}
              {items.map((item, idx) =>
                editingItem?.id === item.id ? (
                  <tr key={item.id} style={{ background: 'var(--color-background)' }}>
                    <td style={{ padding: '0.5rem 1rem', color: '#aaa', fontSize: '0.85rem' }}>{idx + 1}</td>
                    <td style={{ padding: '0.5rem 1rem' }}>
                      <input value={editSource} onChange={e => setEditSource(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                    </td>
                    {!singleCol && (
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <input value={editTarget} onChange={e => setEditTarget(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                      </td>
                    )}
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button onClick={handleEditWord} style={actionBtnStyle}>✓</button>
                        <button onClick={() => setEditingItem(null)} style={{ ...actionBtnStyle, background: '#eee', color: '#555' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#aaa', fontSize: '0.85rem' }}>{idx + 1}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', color: '#333' }}>{item.source_word}</td>
                    {!singleCol && <td style={{ padding: '0.75rem 1rem', color: '#2a9d8f' }}>{item.target_word || '—'}</td>}
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button onClick={() => startEdit(item)} style={actionBtnStyle}><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteWord(item.id)} style={{ ...actionBtnStyle, background: '#e63946' }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Formulaire ajouter un mot */}
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder={singleCol ? 'Mot' : sourceLang}
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddWord() }}
              style={{ ...inputStyle, flex: 1, minWidth: '140px', marginBottom: 0 }}
            />
            {!singleCol && (
              <input
                type="text"
                placeholder="Français"
                value={newTarget}
                onChange={e => setNewTarget(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddWord() }}
                style={{ ...inputStyle, flex: 1, minWidth: '140px', marginBottom: 0 }}
              />
            )}
            <button onClick={handleAddWord} style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Ajouter
            </button>
          </div>
        </div>

        {/* Import Excel/CSV */}
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: showPasteZone || showParsedPreview ? '1rem' : '0' }}>
            <button
              onClick={() => { setShowPasteZone(!showPasteZone); setShowParsedPreview(false) }}
              style={{ padding: '0.6rem 1rem', background: showPasteZone ? '#2a9d8f' : 'var(--color-border)', color: showPasteZone ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              📋 Coller depuis Excel
            </button>
            <label style={{ padding: '0.6rem 1rem', background: 'var(--color-border)', color: '#2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              📂 Importer CSV
              <input type="file" accept=".csv" onChange={handleFileImport} style={{ display: 'none' }} />
            </label>
          </div>
          {showPasteZone && !showParsedPreview && (
            <div>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Sélectionne 2 ou 3 colonnes dans Excel/Google Sheets, copie et colle ici. Colonnes : <strong>mot source</strong> · <strong>traduction</strong> · <strong>contexte (optionnel)</strong>
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Colle tes cellules ici..."
                style={{ width: '100%', height: '120px', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical', marginBottom: '0.5rem' }}
              />
              <button
                onClick={handlePasteParse}
                disabled={!pasteText.trim()}
                style={{ padding: '0.6rem 1.2rem', background: pasteText.trim() ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: pasteText.trim() ? 'pointer' : 'default', fontSize: '0.9rem' }}
              >
                Analyser
              </button>
            </div>
          )}
          {showParsedPreview && parsedRows.length > 0 && (
            <div>
              <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <strong>{parsedRows.filter(r => r.selected).length}</strong> mots détectés — coche ceux à importer :
              </p>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem', border: '1px solid #eee', borderRadius: '0.5rem' }}>
                {parsedRows.map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid #f5f5f5' }}>
                    <input type="checkbox" checked={row.selected} onChange={() => {
                      const updated = [...parsedRows]; updated[i].selected = !updated[i].selected; setParsedRows(updated)
                    }} />
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>
                      <strong>{row.source}</strong>
                      {row.target && <span style={{ color: '#2a9d8f' }}> → {row.target}</span>}
                      {row.context && <span style={{ color: '#aaa', fontSize: '0.8rem' }}> ({row.context})</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setParsedRows(parsedRows.map(r => ({ ...r, selected: true })))} style={{ padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Tout sélectionner</button>
                <button onClick={handleConfirmParsed} style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Importer la sélection</button>
                <button onClick={() => { setParsedRows([]); setShowParsedPreview(false); setPasteText(''); setShowPasteZone(false) }} style={{ padding: '0.4rem 0.8rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Annuler</button>
              </div>
            </div>
          )}
          {showParsedPreview && parsedRows.length === 0 && (
            <p style={{ color: '#e63946', fontSize: '0.85rem' }}>Aucun mot détecté. Vérifie le format.</p>
          )}
        </div>

        {/* Import par image */}
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: importWords.length > 0 ? '1rem' : '0' }}>
            <label style={{ padding: '0.6rem 1rem', background: 'var(--color-border)', color: '#2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>
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
                      const updated = [...importWords]; updated[i].selected = !updated[i].selected; setImportWords(updated)
                    }} />
                    <span style={{ flex: 1, fontSize: '0.9rem' }}><strong>{w.source}</strong>{w.target ? ` → ${w.target}` : ''}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setImportWords(importWords.map(w => ({ ...w, selected: true })))} style={{ padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Tout sélectionner</button>
                <button onClick={handleConfirmImport} style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Importer la sélection</button>
                <button onClick={() => setImportWords([])} style={{ padding: '0.4rem 0.8rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==================== FORMULAIRE ÉDITION ====================
  if (editingList) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setEditingList(null)}
            style={{ padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Retour
          </button>
          <h2 style={{ margin: 0, color: '#2a9d8f', fontSize: '1.1rem' }}>Modifier la liste</h2>
        </div>
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', maxWidth: '480px' }}>
          <label style={labelStyle}>Nom de la liste</label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
          <label style={labelStyle}>Type</label>
          <select value={editType} onChange={e => setEditType(e.target.value)} style={inputStyle}>
            <option value="vocabulaire">Vocabulaire</option>
            <option value="conjugaison">Conjugaison</option>
            <option value="dictée">Dictée</option>
          </select>
          <label style={labelStyle}>Langue de la liste</label>
          <select value={editLang} onChange={e => setEditLang(e.target.value)} style={inputStyle}>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <p style={hintStyle}>Le mot source = mot dans cette langue<br />Le mot cible = traduction en français</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleUpdateList} style={{ flex: 1, padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>Enregistrer</button>
            <button onClick={() => setEditingList(null)} style={{ padding: '0.6rem 1rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== VUE PRINCIPALE (tableau) ====================
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, color: '#2a9d8f' }}>Listes de mots</h2>
          <HelpBubble
            title="Comment utiliser les listes de mots ?"
            position="bottom"
            content={
              <div>
                <p><strong>Créer une liste</strong></p>
                <p>Clique sur "+ Nouvelle liste", choisis un nom, un type et une langue, puis ajoute tes mots.</p>

                <p style={{ marginTop: '0.75rem' }}><strong>Types de listes :</strong></p>
                <ul style={{ paddingLeft: '1.2rem', margin: '0.25rem 0' }}>
                  <li><strong>Vocabulaire</strong> — pour apprendre du vocabulaire en langue étrangère (anglais, allemand, grec...)</li>
                  <li><strong>Dictée</strong> — pour travailler l'orthographe en français</li>
                  <li><strong>Conjugaison</strong> — pour toutes les langues. Indique simplement le verbe à l'infinitif en français (ex : avoir, être, aller...)</li>
                </ul>

                <p style={{ marginTop: '0.75rem' }}><strong>Partager une liste</strong></p>
                <p>Chaque liste a un code de partage unique. Tu peux le communiquer à quelqu'un pour qu'il importe ta liste, ou importer la liste d'un autre utilisateur en cliquant sur "Importer une liste" et en saisissant son code.</p>
              </div>
            }
          />
        </div>
        <button
          onClick={() => { setShowNewList(!showNewList); setShowImportForm(false) }}
          style={{ padding: '0.5rem 1rem', background: showNewList ? 'var(--color-border)' : '#2a9d8f', color: showNewList ? '#2a9d8f' : 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
        >
          {showNewList ? '✕ Annuler' : '+ Nouvelle liste'}
        </button>
      </div>

      {showNewList && (
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem', maxWidth: '480px' }}>
          <button
            onClick={() => setShowImportForm(!showImportForm)}
            style={{ background: 'none', border: 'none', color: '#2a9d8f', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '1rem', textDecoration: 'underline' }}
          >
            {showImportForm ? '← Créer une nouvelle liste' : 'Tu as un code de partage ? → Importer une liste'}
          </button>

          {showImportForm ? (
            <div>
              <label style={labelStyle}>Code de partage</label>
              <input
                type="text"
                value={shareCodeInput}
                onChange={e => setShareCodeInput(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="Ex: A3F9K"
                style={{
                  ...inputStyle,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  fontSize: '1.2rem',
                }}
              />
              <button
                onClick={handleImportList}
                disabled={shareImportLoading}
                style={{ width: '100%', padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: shareImportLoading ? 'default' : 'pointer', fontWeight: 'bold', opacity: shareImportLoading ? 0.7 : 1 }}
              >
                {shareImportLoading ? 'Import en cours...' : 'Importer cette liste'}
              </button>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Nom de la liste</label>
              <input type="text" placeholder="Ex : Vocabulaire chapitre 3" value={newListName} onChange={e => setNewListName(e.target.value)} style={inputStyle} />
              <label style={labelStyle}>Type</label>
              <select value={newListType} onChange={e => setNewListType(e.target.value)} style={inputStyle}>
                <option value="vocabulaire">Vocabulaire</option>
                <option value="conjugaison">Conjugaison</option>
                <option value="dictée">Dictée</option>
              </select>
              <label style={labelStyle}>Langue de la liste</label>
              <select value={newListLang} onChange={e => setNewListLang(e.target.value)} style={inputStyle}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <p style={hintStyle}>Le mot source = mot dans cette langue<br />Le mot cible = traduction en français</p>
              <button onClick={handleCreateList} style={{ width: '100%', padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                Enregistrer
              </button>
            </div>
          )}
        </div>
      )}

      {lists.length === 0 ? (
        <EmptyState emoji="📋" title="Aucune liste de mots" subtitle="Crée ta première liste pour commencer les exercices." actionLabel="+ Nouvelle liste" onAction={() => setShowNewList(true)} />
      ) : (() => {
        const grouped: Record<string, WordList[]> = {}
        for (const list of lists) {
          const lang = list.language || 'Sans langue'
          if (!grouped[lang]) grouped[lang] = []
          grouped[lang].push(list)
        }
        const sortedLangs = Object.keys(grouped).sort((a, b) => {
          if (a === 'Sans langue') return 1
          if (b === 'Sans langue') return -1
          return a.localeCompare(b, 'fr')
        })
        return (
          <>
            {sortedLangs.map(lang => (
              <div key={lang} style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#2a9d8f', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                  {lang}
                  <span style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 'normal' }}>— {grouped[lang].length} liste{grouped[lang].length > 1 ? 's' : ''}</span>
                </h3>
                <div style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '17%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: 'var(--color-background)' }}>
                        <th style={thStyle}>Nom</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Créé le</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Mots</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[lang].map((list, idx) => {
                        const typeBg = LIST_TYPE_COLORS[list.list_type] || '#aaa'
                        const typeLabel = LIST_TYPE_LABELS[list.list_type] || list.list_type
                        return (
                          <tr key={list.id} style={{ background: idx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f5f5f5' }}>
                            <td
                              onClick={() => handleSelectList(list)}
                              title={list.name}
                              style={{ padding: '0.75rem 1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, fontWeight: 'bold', color: '#333', cursor: 'pointer' }}
                            >
                              {list.name}
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>{fmtDate(list.created_at)}</td>
                            <td style={{ padding: '0.6rem', textAlign: 'center', color: '#555', fontWeight: 'bold' }}>{wordCounts[list.id] ?? 0}</td>
                            <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '1rem', background: typeBg, color: typeBg === '#e9c46a' ? '#555' : 'white', fontSize: '0.78rem', fontWeight: 'bold' }}>
                                {typeLabel}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                <button onClick={() => openEditList(list)} style={actionBtnStyle}><Pencil size={14} /></button>
                                <button onClick={() => handleDeleteList(list.id)} style={{ ...actionBtnStyle, background: '#e63946' }}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )
      })()}
    </div>
  )
}
