import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'
import { Delta } from '../components/Delta'
import { EmptyState } from '../components/EmptyState'

type GameState = 'select' | 'playing' | 'result'

interface WordList {
  id: string
  name: string
  list_type: string
}

interface AnagramWord {
  target: string
  translation: string
  shuffled: string[]
}

interface BankItem {
  letter: string
  id: string
  used: boolean
}

type PlacedItem = { letter: string; bankId: string } | null

const TOTAL_WORDS = 15
const PRIMARY = '#2a9d8f'

const shuffleLetters = (word: string): string[] => {
  const letters = word.toUpperCase().split('')
  let shuffled = [...letters]
  let att = 0
  do {
    shuffled = [...shuffled].sort(() => Math.random() - 0.5)
    att++
  } while (shuffled.join('') === letters.join('') && att < 10 && letters.length > 1)
  return shuffled
}

interface AnagrammeProps {
  userId?: string
}

export default function Anagramme({ userId }: AnagrammeProps) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedListId, setSelectedListId] = useState('')
  const [loading, setLoading] = useState(false)
  const [words, setWords] = useState<AnagramWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [bank, setBank] = useState<BankItem[]>([])
  const [placed, setPlaced] = useState<PlacedItem[]>([])
  const [hintFirst, setHintFirst] = useState(false)
  const [hintTranslation, setHintTranslation] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [streak, setStreak] = useState(0)
  const [points, setPoints] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [earnedDigoos, setEarnedDigoos] = useState(0)

  const validatingRef = useRef(false)

  useEffect(() => { fetchLists() }, [])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = userId || user.id
    const { data } = await supabase
      .from('word_lists')
      .select('id, name, list_type')
      .eq('user_id', targetId)
      .in('list_type', ['vocabulaire', 'dictée'])
      .order('name')
    setLists(data || [])
  }

  const initWord = (word: AnagramWord) => {
    setBank(word.shuffled.map((letter, i) => ({ letter, id: `${i}-${letter}`, used: false })))
    setPlaced(new Array(word.target.length).fill(null))
    setHintFirst(false)
    setHintTranslation(false)
    setAttempts(0)
    setFeedback(null)
    validatingRef.current = false
  }

  const startGame = async () => {
    if (!selectedListId || loading) return
    setLoading(true)

    const { data: rawItems } = await supabase
      .from('word_items')
      .select('source_word, target_word')
      .eq('list_id', selectedListId)

    setLoading(false)

    const items = ((rawItems || []) as { source_word: string; target_word: string }[])
      .filter(w => w.source_word && w.target_word)

    if (items.length === 0) return

    const picked = Array.from({ length: TOTAL_WORDS }, () =>
      items[Math.floor(Math.random() * items.length)]
    )

    const anagramWords: AnagramWord[] = picked.map(w => ({
      target: w.source_word,
      translation: w.target_word,
      shuffled: shuffleLetters(w.source_word),
    }))

    setWords(anagramWords)
    setCurrentIndex(0)
    setResults([])
    setStreak(0)
    setPoints(0)
    setEarnedDigoos(0)
    initWord(anagramWords[0])
    setGameState('playing')
  }

  const finaliser = async (totalPoints: number, totalCorrect: number) => {
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: TOTAL_WORDS,
      questions_correct: totalCorrect,
      metadata: { exercise: 'anagramme', listId: selectedListId },
    })
    const earned = await addDigoos(totalPoints, 'exercise')
    setEarnedDigoos(earned)
    setGameState('result')
  }

  const validateWord = (currentPlaced: PlacedItem[]) => {
    if (validatingRef.current) return
    validatingRef.current = true

    const word = currentPlaced.map(p => p!.letter).join('')
    const cw = words[currentIndex]
    if (!cw) return

    const correct = word === cw.target.toUpperCase()

    if (correct) {
      setFeedback('correct')
      const newStreak = streak + 1
      const gain = newStreak >= 3 ? 6 : 1
      setStreak(newStreak)
      setPoints(prev => prev + gain)
      setResults(prev => [...prev, true])

      setTimeout(() => {
        setFeedback(null)
        validatingRef.current = false
        const nextIdx = currentIndex + 1
        if (nextIdx >= TOTAL_WORDS) {
          finaliser(points + gain, results.filter(Boolean).length + 1)
        } else {
          setCurrentIndex(nextIdx)
          initWord(words[nextIdx])
        }
      }, 1000)
    } else {
      setFeedback('incorrect')
      setAttempts(prev => prev + 1)
      setStreak(0)

      setTimeout(() => {
        setFeedback(null)
        validatingRef.current = false
        const reshuffled = shuffleLetters(cw.target)
        setBank(reshuffled.map((l, i) => ({
          letter: l,
          id: `${i}-${l}-${Date.now()}`,
          used: false,
        })))
        setPlaced(new Array(cw.target.length).fill(null))
      }, 800)
    }
  }

  const placeLetter = (bankId: string, letter: string) => {
    if (feedback !== null || validatingRef.current) return
    const firstEmpty = placed.findIndex(p => p === null)
    if (firstEmpty === -1) return

    const newPlaced = [...placed]
    newPlaced[firstEmpty] = { letter, bankId }
    setPlaced(newPlaced)
    setBank(prev => prev.map(b => b.id === bankId ? { ...b, used: true } : b))

    if (newPlaced.every(p => p !== null)) {
      validateWord(newPlaced)
    }
  }

  const removeLetter = (index: number) => {
    if (feedback !== null || validatingRef.current) return
    const item = placed[index]
    if (!item) return
    const newPlaced = [...placed]
    newPlaced[index] = null
    setPlaced(newPlaced)
    setBank(prev => prev.map(b => b.id === item.bankId ? { ...b, used: false } : b))
  }

  const reshuffleBank = () => {
    if (feedback !== null) return
    const unusedLetters = bank.filter(b => !b.used).map(b => b.letter)
    const shuffled = [...unusedLetters].sort(() => Math.random() - 0.5)
    let sidx = 0
    const newBank = bank.map(b =>
      b.used ? b : { ...b, letter: shuffled[sidx++], id: `${sidx}-${shuffled[sidx - 1]}-${Date.now()}` }
    )
    setBank(newBank)
  }

  const applyHintFirst = () => {
    const cw = words[currentIndex]
    if (!cw || hintFirst || feedback !== null) return
    const firstLetter = cw.target[0].toUpperCase()

    if (placed[0]?.letter === firstLetter) {
      setHintFirst(true)
      return
    }

    const bankItem = bank.find(b => b.letter === firstLetter && !b.used)
    if (!bankItem) return

    const existingAtZero = placed[0]
    setPlaced(prev => {
      const next = [...prev]
      next[0] = { letter: firstLetter, bankId: bankItem.id }
      return next
    })
    setBank(prev => {
      const updated = prev.map(b => b.id === bankItem.id ? { ...b, used: true } : b)
      return existingAtZero
        ? updated.map(b => b.id === existingAtZero.bankId ? { ...b, used: false } : b)
        : updated
    })
    setHintFirst(true)
  }

  const skipWord = () => {
    if (feedback !== null || validatingRef.current) return
    const newResults = [...results, false]
    setResults(newResults)
    setStreak(0)

    const nextIdx = currentIndex + 1
    if (nextIdx >= TOTAL_WORDS) {
      finaliser(points, newResults.filter(Boolean).length)
    } else {
      setCurrentIndex(nextIdx)
      initWord(words[nextIdx])
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && gameState === 'playing' && feedback === null) {
        e.preventDefault()
        const unusedLetters = bank.filter(b => !b.used).map(b => b.letter)
        const shuffled = [...unusedLetters].sort(() => Math.random() - 0.5)
        let sidx = 0
        const newBank = bank.map(b =>
          b.used ? b : { ...b, letter: shuffled[sidx++], id: `${sidx}-${shuffled[sidx - 1]}-${Date.now()}` }
        )
        setBank(newBank)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState, bank, feedback])

  const currentWord = words[currentIndex]
  const progress = (currentIndex / TOTAL_WORDS) * 100

  if (gameState === 'select') {
    return (
      <div>
        <h2 style={{ color: PRIMARY, marginBottom: '0.5rem' }}>🔤 Anagramme</h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>Remets les lettres dans le bon ordre !</p>

        {lists.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="Aucune liste disponible"
            subtitle="Crée une liste de vocabulaire ou dictée pour jouer à cet exercice."
          />
        ) : (
          <div style={{ maxWidth: '420px' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Choisis une liste
            </label>
            <select
              value={selectedListId}
              onChange={e => setSelectedListId(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', marginBottom: '1.5rem' }}
            >
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button
              onClick={startGame}
              disabled={!selectedListId || loading}
              style={{
                width: '100%', padding: '0.75rem',
                background: selectedListId && !loading ? PRIMARY : '#ccc',
                color: 'white', border: 'none', borderRadius: '0.5rem',
                cursor: selectedListId && !loading ? 'pointer' : 'default',
                fontSize: '1rem', fontWeight: 'bold',
              }}
            >
              {loading ? 'Chargement...' : '🚀 Commencer'}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (gameState === 'result') {
    const totalCorrect = results.filter(Boolean).length
    return (
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
        <h2 style={{ color: PRIMARY, marginBottom: '0.5rem' }}>Partie terminée !</h2>
        <div style={{ fontSize: '1.3rem', color: '#555', marginBottom: '1rem' }}>
          {totalCorrect} / {TOTAL_WORDS} mots trouvés
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: '#fff8e0', color: '#b8860b',
          padding: '0.5rem 1.2rem', borderRadius: '1rem',
          fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '2rem',
        }}>
          +{earnedDigoos} <Delta size={20} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => { setGameState('select'); setWords([]) }}
            style={{
              padding: '0.75rem 1.5rem', background: PRIMARY, color: 'white',
              border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
              fontSize: '1rem', fontWeight: 'bold',
            }}
          >
            🔄 Rejouer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      {/* Progression */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>Mot {currentIndex + 1} / {TOTAL_WORDS}</span>
          <span style={{ color: PRIMARY, fontWeight: 'bold', fontSize: '0.9rem' }}>
            {points} pt{points !== 1 ? 's' : ''}
            {streak >= 3 && ` 🔥 série ${streak}`}
          </span>
        </div>
        <div style={{ height: '6px', background: '#e0f0ee', borderRadius: '3px' }}>
          <div style={{
            height: '100%', background: PRIMARY, borderRadius: '3px',
            width: `${progress}%`, transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {currentWord && (
        <>
          {/* Indice traduction */}
          {hintTranslation && (
            <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#888', fontStyle: 'italic', marginBottom: '0.75rem' }}>
              Traduction : {currentWord.translation}
            </div>
          )}

          {/* Zone des lettres placées */}
          <div style={{
            display: 'flex', gap: '6px', flexWrap: 'wrap',
            justifyContent: 'center', alignItems: 'flex-end',
            marginBottom: '1.5rem', padding: '1rem',
            background: feedback === 'correct' ? '#e8f5e9' : feedback === 'incorrect' ? '#fce4ec' : '#f9f9f9',
            borderRadius: '12px',
            transition: 'background 0.3s ease',
            minHeight: '72px',
          }}>
            {placed.map((item, i) => (
              item ? (
                <div
                  key={i}
                  onClick={() => removeLetter(i)}
                  style={{
                    width: '44px', height: '48px',
                    background: feedback === 'correct' ? '#a5d6a7' : feedback === 'incorrect' ? '#ffd6c2' : '#e8f5e9',
                    borderRadius: '6px',
                    border: `1px solid ${feedback === 'correct' ? '#66bb6a' : feedback === 'incorrect' ? '#ef9a9a' : PRIMARY}`,
                    borderBottom: `3px solid ${feedback === 'correct' ? '#43a047' : feedback === 'incorrect' ? '#e57373' : '#1a6b5a'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '1.3rem',
                    color: '#1a1a1a',
                    cursor: feedback !== null ? 'default' : 'pointer',
                    userSelect: 'none',
                    transition: 'background 0.3s ease, border-color 0.3s ease',
                  }}
                >
                  {item.letter}
                </div>
              ) : (
                <div
                  key={i}
                  style={{
                    width: '44px', height: '4px',
                    background: '#ccc',
                    borderRadius: '2px',
                    alignSelf: 'flex-end',
                    marginBottom: '4px',
                  }}
                />
              )
            ))}
          </div>

          {/* Banque de lettres */}
          <div style={{
            display: 'flex', gap: '6px', flexWrap: 'wrap',
            justifyContent: 'center', marginBottom: '1.5rem',
          }}>
            {bank.map(item => (
              <div
                key={item.id}
                onClick={() => !item.used && placeLetter(item.id, item.letter)}
                style={{
                  width: '44px', height: '48px',
                  background: '#f5e6c8',
                  borderRadius: '6px',
                  border: '1px solid #c9a96e',
                  borderBottom: '3px solid #a07840',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', fontSize: '1.3rem',
                  color: '#3a2a0a',
                  cursor: item.used || feedback !== null ? 'default' : 'pointer',
                  userSelect: 'none',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  opacity: item.used ? 0.3 : 1,
                  transition: 'transform 0.1s, opacity 0.2s',
                }}
              >
                {item.letter}
              </div>
            ))}
          </div>

          {/* Boutons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
            <button
              onClick={reshuffleBank}
              disabled={feedback !== null}
              style={{
                padding: '0.4rem 0.9rem',
                background: 'white', color: PRIMARY,
                border: `1px solid ${PRIMARY}`, borderRadius: '0.5rem',
                cursor: feedback !== null ? 'default' : 'pointer', fontSize: '0.85rem',
              }}
            >
              🔀 Mélanger
            </button>
            {!hintFirst && (
              <button
                onClick={applyHintFirst}
                disabled={feedback !== null}
                style={{
                  padding: '0.4rem 0.9rem',
                  background: 'white', color: '#e76f51',
                  border: '1px solid #e76f51', borderRadius: '0.5rem',
                  cursor: feedback !== null ? 'default' : 'pointer', fontSize: '0.85rem',
                }}
              >
                💡 1ère lettre
              </button>
            )}
            {!hintTranslation && currentWord.translation && (
              <button
                onClick={() => setHintTranslation(true)}
                disabled={feedback !== null}
                style={{
                  padding: '0.4rem 0.9rem',
                  background: 'white', color: '#e76f51',
                  border: '1px solid #e76f51', borderRadius: '0.5rem',
                  cursor: feedback !== null ? 'default' : 'pointer', fontSize: '0.85rem',
                }}
              >
                🌍 Traduction
              </button>
            )}
            <button
              onClick={skipWord}
              disabled={feedback !== null}
              style={{
                padding: '0.4rem 0.9rem',
                background: 'white', color: '#888',
                border: '1px solid #ccc', borderRadius: '0.5rem',
                cursor: feedback !== null ? 'default' : 'pointer', fontSize: '0.85rem',
              }}
            >
              Passer →
            </button>
          </div>

          {attempts > 0 && (
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#e63946' }}>
              {attempts} tentative{attempts > 1 ? 's' : ''} • Continue !
            </div>
          )}
        </>
      )}
    </div>
  )
}
