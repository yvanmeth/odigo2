import { useEffect, useRef, useState } from 'react'
import { Delta } from '../components/Delta'
import { EmptyState } from '../components/EmptyState'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'
import { useToast } from '../components/Toast'

type GameState = 'select' | 'loading' | 'playing' | 'result'
type Mode = 'facile' | 'moyen' | 'difficile'
type SeriesLength = 3 | 5 | 10

interface WordSlot {
  correctText: string
  type: 'fixed' | 'category'
  category?: string
  options?: string[]
}

interface PuzzleSentence {
  french: string
  words: WordSlot[]
}

interface BankItem {
  id: string
  kind: 'fixed' | 'category'
  text: string
  options?: string[]
  category?: string
  placedInSlot: number | null
  locked: boolean
}

interface SlotState {
  status: 'empty' | 'correct' | 'incorrect' | null
}

interface WordList {
  id: string
  name: string
}

const LANGUAGES = ['Anglais', 'Allemand', 'Espagnol', 'Grec', 'Arabe', 'Italien']

const MODES: { value: Mode; label: string; desc: string }[] = [
  { value: 'facile', label: '😊 Facile', desc: 'Replace les mots dans l\'ordre' },
  { value: 'moyen', label: '🧠 Moyen', desc: 'Choisis les bons mots ET le bon ordre' },
  { value: 'difficile', label: '✍️ Difficile', desc: 'Écris la traduction toi-même' },
]

const SERIES_LENGTHS: SeriesLength[] = [3, 5, 10]

const btnPrimary: React.CSSProperties = { padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }
const btnSecondary: React.CSSProperties = { padding: '0.75rem 2rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const slotColors = (status: SlotState['status']): { bg: string; border: string } => {
  if (status === 'correct') return { bg: '#a5d6a7', border: '#2a9d8f' }
  if (status === 'incorrect') return { bg: '#ffd6c2', border: '#e76f51' }
  return { bg: 'white', border: 'var(--color-border)' }
}

const initSentence = (sentence: PuzzleSentence): { slots: SlotState[]; bankItems: BankItem[] } => {
  const slots: SlotState[] = sentence.words.map(() => ({ status: null }))
  const bankItems: BankItem[] = sentence.words.map((w, i) => {
    if (w.type === 'fixed') {
      return { id: `b${i}`, kind: 'fixed' as const, text: w.correctText, placedInSlot: null, locked: false }
    }
    return { id: `b${i}`, kind: 'category' as const, text: '', options: shuffleArray(w.options || []), category: w.category, placedInSlot: null, locked: false }
  })
  return { slots, bankItems: shuffleArray(bankItems) }
}

const buildSystemPrompt = (mode: Mode, language: string, seriesLength: number) => `Tu génères des phrases pour un exercice de traduction français → ${language}, niveau élève de 11 ans (7P, Genève).

Pour chaque mot fourni (paire source_word=${language}/target_word=français), génère :
1. Une phrase française simple (4-8 mots) dont la traduction en ${language} contient naturellement le mot fourni (forme conjuguée/déclinée acceptée si nécessaire).
2. La traduction complète en ${language}, découpée mot par mot dans l'ordre correct.

${mode === 'moyen'
    ? `Pour CHAQUE phrase, choisis 2 à 4 mots de la traduction (PAS le mot-cible lui-même) et marque-les type "category" avec un champ "category" et un tableau "options" de 3 choix au total (1 correct + 2 distracteurs plausibles de la même catégorie grammaticale, adaptés au contexte). Les autres mots sont type "fixed".

Utilise UNIQUEMENT ces catégories grammaticales :
- article (a, an, the, this, that, these, those...)
- déterminant possessif (my, your, his, her, our, their...)
- préposition (in, on, at, behind, under...)
- verbe
- pronom
- adjectif (qualificatif uniquement : big, small, happy...)
- nom
- adverbe

Ne jamais utiliser "adjectif" pour les articles, démonstratifs ou déterminants possessifs.`
    : `Tous les mots sont type "fixed" (pas de "options" ni "category").`
  }

Réponds UNIQUEMENT avec un JSON valide, tableau de ${seriesLength} objets :
[
  {
    "french": "phrase en français",
    "words": [
      { "text": "mot1", "type": "fixed" },
      { "text": "mot2", "type": "category", "category": "verbe", "options": ["mot2", "distracteur1", "distracteur2"] }
    ]
  }
]`

const buildUserPrompt = (pairs: { source_word: string; target_word: string }[], language: string) =>
  `Génère une phrase pour chacune de ces paires (mot ${language}/français) :\n` +
  pairs.map((p, i) => `${i + 1}. ${p.source_word} (${language}) = ${p.target_word} (français)`).join('\n')

const callAPI = async (systemPrompt: string, userPrompt: string, maxTokens = 500): Promise<string> => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    }),
  })
  const data: { content?: { type: string; text?: string }[] } = await res.json()
  return (data.content?.find(b => b.type === 'text')?.text || '')
    .replace(/```json|```/g, '').trim()
}

export default function PuzzlePhrases() {
  const { showToast } = useToast()

  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [selectedListId, setSelectedListId] = useState('')
  const [mode, setMode] = useState<Mode>('facile')
  const [seriesLength, setSeriesLength] = useState<SeriesLength>(5)
  const [language, setLanguage] = useState('Anglais')

  const [sentences, setSentences] = useState<PuzzleSentence[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [slots, setSlots] = useState<SlotState[]>([])
  const [bankItems, setBankItems] = useState<BankItem[]>([])
  const [userInputs, setUserInputs] = useState<string[]>([])
  const [attempt, setAttempt] = useState<1 | 2>(1)
  const [feedback, setFeedback] = useState<'none' | 'retry' | 'reveal'>('none')

  const [streak, setStreak] = useState(0)
  const [points, setPoints] = useState(0)
  const [earnedDigoos, setEarnedDigoos] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)

  const resultsRef = useRef<boolean[]>([])
  const pointsRef = useRef(0)

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('word_lists')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('list_type', 'vocabulaire')
    if (data) {
      setLists(data)
      if (data.length === 1) setSelectedListId(data[0].id)
    }
    setLoadingLists(false)
  }

  useEffect(() => {
    fetchLists()
  }, [])

  const fetchSentences = async () => {
    if (!selectedListId) return
    setGameState('loading')

    const { data: wordItems } = await supabase
      .from('word_items')
      .select('source_word, target_word')
      .eq('list_id', selectedListId)

    if (!wordItems || wordItems.length === 0) {
      showToast('Cette liste ne contient aucun mot.', 'error')
      setGameState('select')
      return
    }

    const pickedWords = Array.from({ length: seriesLength }, () =>
      wordItems[Math.floor(Math.random() * wordItems.length)]
    )

    try {
      const systemPrompt = buildSystemPrompt(mode, language, seriesLength)
      const userPrompt = buildUserPrompt(
        pickedWords.map(w => ({ source_word: w.source_word, target_word: w.target_word || '' })),
        language
      )
      const txt = await callAPI(systemPrompt, userPrompt, 4000)
      const parsed: { french: string; words: { text: string; type: 'fixed' | 'category'; category?: string; options?: string[] }[] }[] = JSON.parse(txt)

      const mapped: PuzzleSentence[] = parsed.map(s => ({
        french: s.french,
        words: s.words.map(w => ({
          correctText: w.text,
          type: w.type,
          category: w.category,
          options: w.options,
        })),
      }))

      resultsRef.current = []
      pointsRef.current = 0
      setSentences(mapped)
      setCurrentIndex(0)
      setStreak(0)
      setPoints(0)
      setAttempt(1)
      setFeedback('none')
      const { slots: initSlots, bankItems: initBank } = initSentence(mapped[0])
      setSlots(initSlots)
      setBankItems(initBank)
      setUserInputs(new Array(mapped[0].words.length).fill(''))
      setGameState('playing')
    } catch {
      showToast('Erreur lors de la génération des phrases. Réessaie.', 'error')
      setGameState('select')
    }
  }

  const recordResult = (firstAttemptCorrect: boolean, success: boolean) => {
    resultsRef.current = [...resultsRef.current, success]
    if (firstAttemptCorrect) {
      const newStreak = streak + 1
      setStreak(newStreak)
      const gain = newStreak >= 3 ? 6 : 1
      pointsRef.current += gain
      setPoints(pointsRef.current)
    } else {
      setStreak(0)
      if (success) {
        pointsRef.current += 1
        setPoints(pointsRef.current)
      }
    }
  }

  const validate = () => {
    const sentence = sentences[currentIndex]
    const newSlots: SlotState[] = slots.map((slot, i) => {
      if (slot.status === 'correct') return slot
      const userText = mode === 'difficile'
        ? (userInputs[i] || '').trim()
        : (bankItems.find(b => b.placedInSlot === i)?.text || '')
      const correct = userText.toLowerCase() === sentence.words[i].correctText.toLowerCase()
      return { status: correct ? 'correct' as const : 'incorrect' as const }
    })
    setSlots(newSlots)

    const allCorrect = newSlots.every(s => s.status === 'correct')

    if (allCorrect) {
      recordResult(attempt === 1, true)
      setFeedback('none')
      setTimeout(() => goToNextSentence(), 1200)
    } else if (attempt === 1) {
      setFeedback('retry')
    } else {
      recordResult(false, false)
      setFeedback('reveal')
    }
  }

  const corriger = () => {
    setBankItems(prev => prev.map(b => {
      if (b.placedInSlot === null) return b
      const slot = slots[b.placedInSlot]
      if (slot.status === 'incorrect') return { ...b, placedInSlot: null }
      if (slot.status === 'correct') return { ...b, locked: true }
      return b
    }))
    setSlots(prev => prev.map(s => s.status === 'incorrect' ? { status: null } : s))
    if (mode === 'difficile') {
      setUserInputs(prev => prev.map((v, i) => slots[i].status === 'incorrect' ? '' : v))
    }
    setAttempt(2)
    setFeedback('none')
  }

  const recommencer = () => {
    const sentence = sentences[currentIndex]
    const { slots: newSlots, bankItems: newBank } = initSentence(sentence)
    setSlots(newSlots)
    setBankItems(newBank)
    setUserInputs(new Array(sentence.words.length).fill(''))
    setAttempt(2)
    setFeedback('none')
  }

  const goToNextSentence = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex >= sentences.length) {
      finaliser()
      return
    }
    const { slots: newSlots, bankItems: newBank } = initSentence(sentences[nextIndex])
    setCurrentIndex(nextIndex)
    setSlots(newSlots)
    setBankItems(newBank)
    setUserInputs(new Array(sentences[nextIndex].words.length).fill(''))
    setAttempt(1)
    setFeedback('none')
  }

  const finaliser = async () => {
    const correctCount = resultsRef.current.filter(Boolean).length
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: seriesLength,
      questions_correct: correctCount,
      metadata: { exercise: 'puzzlephrases', mode, listId: selectedListId },
    })
    const earned = await addDigoos(pointsRef.current, 'exercise')
    setEarnedDigoos(earned)
    setTotalCorrect(correctCount)
    setGameState('result')
  }

  const handlePlaceFixed = (bankId: string) => {
    const occupied = new Set(bankItems.filter(b => b.placedInSlot !== null).map(b => b.placedInSlot))
    const firstEmptySlot = slots.findIndex((_, i) => !occupied.has(i))
    if (firstEmptySlot === -1) return
    setBankItems(prev => prev.map(b => b.id === bankId ? { ...b, placedInSlot: firstEmptySlot } : b))
  }

  const handleCategoryChoice = (bankId: string, value: string) => {
    setBankItems(prev => {
      const target = prev.find(b => b.id === bankId)
      let updated = prev.map(b => b.id === bankId ? { ...b, text: value } : b)
      if (target && target.placedInSlot === null && value !== '') {
        const occupied = new Set(updated.filter(b => b.placedInSlot !== null).map(b => b.placedInSlot))
        const firstEmptySlot = slots.findIndex((_, i) => !occupied.has(i))
        if (firstEmptySlot !== -1) {
          updated = updated.map(b => b.id === bankId ? { ...b, placedInSlot: firstEmptySlot } : b)
        }
      }
      return updated
    })
  }

  const handleRemoveFromSlot = (bankId: string) => {
    setBankItems(prev => prev.map(b => b.id === bankId ? { ...b, placedInSlot: null } : b))
  }

  const rejouer = () => {
    setGameState('select')
  }

  const quitter = () => {
    setSentences([])
    setGameState('select')
  }

  // ---- ÉCRAN SÉLECTION ----
  if (gameState === 'select' || gameState === 'loading') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '0.25rem' }}>🧩 Puzzle de phrases</h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>Reconstruis la traduction dans le bon ordre !</p>

        {loadingLists ? (
          <p style={{ color: '#888' }}>Chargement...</p>
        ) : lists.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="Aucune liste de vocabulaire"
            subtitle="Crée une liste de vocabulaire pour jouer à cet exercice."
          />
        ) : (
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '520px' }}>

            {lists.length > 1 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste de vocabulaire</label>
                <select
                  value={selectedListId}
                  onChange={e => setSelectedListId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
                >
                  <option value="">-- Sélectionner --</option>
                  {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Langue</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mode</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {MODES.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    style={{
                      flex: 1, padding: '0.6rem 0.4rem', textAlign: 'center',
                      background: mode === m.value ? '#2a9d8f' : 'var(--color-border)',
                      color: mode === m.value ? 'white' : '#2a9d8f',
                      border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: mode === m.value ? 'bold' : 'normal',
                    }}
                  >
                    <div>{m.label}</div>
                    <div style={{ fontSize: '0.7rem', color: mode === m.value ? 'var(--color-border)' : '#aaa', marginTop: '0.2rem', fontWeight: 'normal' }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nombre de phrases</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {SERIES_LENGTHS.map(n => (
                  <button
                    key={n}
                    onClick={() => setSeriesLength(n)}
                    style={{ flex: 1, padding: '0.6rem', background: seriesLength === n ? '#2a9d8f' : 'var(--color-border)', color: seriesLength === n ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: seriesLength === n ? 'bold' : 'normal' }}
                  >
                    {n} phrases
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={fetchSentences}
              disabled={!selectedListId || gameState === 'loading'}
              style={{ width: '100%', padding: '0.75rem', background: selectedListId ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedListId ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}
            >
              {gameState === 'loading' ? '⏳ Génération des phrases...' : '🚀 Commencer'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ---- ÉCRAN RÉSULTAT ----
  if (gameState === 'result') {
    return (
      <div style={{ maxWidth: '520px', textAlign: 'center' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '1.8rem', marginBottom: '0.25rem' }}>🎉 Série terminée !</h2>
        <p style={{ color: '#888', fontSize: '1rem', marginBottom: '0.25rem' }}>{totalCorrect}/{seriesLength} phrases réussies</p>
        <p style={{ color: '#e9c46a', fontWeight: 'bold', fontSize: '1.3rem', marginBottom: '1.5rem' }}>
          +{earnedDigoos} <Delta size={20} />
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={rejouer} style={btnPrimary}>🔄 Rejouer</button>
          <button onClick={quitter} style={btnSecondary}>Quitter</button>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN JEU ----
  const sentence = sentences[currentIndex]
  if (!sentence) return null

  const canValidate = mode === 'difficile'
    ? userInputs.every((v, i) => slots[i]?.status === 'correct' || v.trim() !== '')
    : slots.every((s, i) => s.status === 'correct' || bankItems.some(b => b.placedInSlot === i))

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>
          Phrase {currentIndex + 1} / {sentences.length}
          {streak >= 3 && <span style={{ color: '#e9c46a', marginLeft: '0.5rem' }}>🔥 {streak}</span>}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#e9c46a', fontWeight: 'bold' }}>
          {points} pts
        </div>
      </div>

      <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div className="progress-bar" style={{ width: `${(currentIndex / sentences.length) * 100}%`, background: '#2a9d8f', height: '100%', borderRadius: '1rem' }} />
      </div>

      <div style={{ background: 'var(--color-background)', borderRadius: '1rem', padding: '1.25rem', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>
        {sentence.french}
      </div>

      {mode === 'difficile' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          {slots.map((slot, i) => {
            const { bg, border } = slotColors(slot.status)
            return (
              <input
                key={i}
                type="text"
                value={userInputs[i] || ''}
                disabled={slot.status === 'correct'}
                onChange={e => setUserInputs(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
                style={{
                  padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: `2px solid ${border}`,
                  background: bg, fontSize: '0.95rem', width: '110px', textAlign: 'center',
                  color: '#1a1a1a', WebkitTextFillColor: '#1a1a1a', caretColor: '#2a9d8f',
                }}
              />
            )
          })}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
            {slots.map((slot, i) => {
              const placedItem = bankItems.find(b => b.placedInSlot === i)
              const { bg, border } = slotColors(slot.status)
              return (
                <div
                  key={i}
                  onClick={() => placedItem && !placedItem.locked && handleRemoveFromSlot(placedItem.id)}
                  style={{
                    minWidth: '60px', minHeight: '2.5rem', padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '0.95rem', color: '#1a1a1a',
                    border: placedItem ? `2px solid ${border}` : '2px dashed #ccc',
                    background: placedItem ? bg : 'transparent',
                    cursor: placedItem && !placedItem.locked ? 'pointer' : 'default',
                  }}
                >
                  {placedItem?.text || ''}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', alignItems: 'flex-end', minHeight: '3.5rem', background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
            {bankItems.filter(b => b.placedInSlot === null).map(b => (
              b.kind === 'fixed' ? (
                <div
                  key={b.id}
                  onClick={() => handlePlaceFixed(b.id)}
                  style={{ background: 'white', border: '1px solid var(--color-border)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold', color: '#1a1a1a' }}
                >
                  {b.text}
                </div>
              ) : (
                <div key={b.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>{b.category} :</span>
                  <select
                    value={b.text}
                    onChange={e => handleCategoryChoice(b.id, e.target.value)}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.85rem' }}
                  >
                    <option value="">?</option>
                    {b.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              )
            ))}
            {bankItems.every(b => b.placedInSlot !== null) && (
              <span style={{ color: '#ccc', fontSize: '0.85rem' }}>Tous les mots sont placés</span>
            )}
          </div>
        </>
      )}

      {feedback === 'none' && (
        <div style={{ textAlign: 'center' }}>
          <button onClick={validate} disabled={!canValidate} style={{ ...btnPrimary, background: canValidate ? '#2a9d8f' : '#ccc', cursor: canValidate ? 'pointer' : 'default' }}>
            Valider
          </button>
        </div>
      )}

      {feedback === 'retry' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#e76f51', fontWeight: 'bold', marginBottom: '0.75rem' }}>
            Presque ! {slots.filter(s => s.status === 'correct').length}/{slots.length} mots bien placés.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={corriger} style={btnPrimary}>Corriger</button>
            <button onClick={recommencer} style={btnSecondary}>Recommencer</button>
          </div>
        </div>
      )}

      {feedback === 'reveal' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#e76f51', fontWeight: 'bold', marginBottom: '0.75rem' }}>La bonne réponse était :</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
            {sentence.words.map((w, i) => {
              const correct = slots[i].status === 'correct'
              const userText = mode === 'difficile'
                ? (userInputs[i] || '—')
                : (bankItems.find(b => b.placedInSlot === i)?.text || '—')
              return (
                <div key={i} style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: correct ? '#a5d6a7' : '#ffd6c2', border: `2px solid ${correct ? '#2a9d8f' : '#e76f51'}`, textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{w.correctText}</div>
                  {!correct && <div style={{ fontSize: '0.7rem', color: '#888' }}>(toi : {userText})</div>}
                </div>
              )
            })}
          </div>
          <button onClick={goToNextSentence} style={btnPrimary}>Suivant →</button>
        </div>
      )}
    </div>
  )
}
