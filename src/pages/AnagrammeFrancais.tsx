import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../services/activity'
import { EmptyState } from '../components/EmptyState'
import HighscoreModal from '../components/HighscoreModal'
import ExerciseBilan from '../components/ExerciseBilan'
import type { Difficulty } from '../lib/exerciseBilan'
import { hasRevisionBonusForList } from '../services/revisionBonus'

type GameState = 'select' | 'playing' | 'result' | 'highscore'

interface WordList {
  id: string
  name: string
  list_type: string
  language: string
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

const TOTAL_WORDS = 10
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

export default function AnagrammeFrancais() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedListId, setSelectedListId] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('moyen')
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
  const [hasRevisionBonus, setHasRevisionBonus] = useState(false)
  const [showHighscore, setShowHighscore] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const validatingRef = useRef(false)

  useEffect(() => { fetchLists() }, [])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('word_lists')
      .select('id, name, list_type, language')
      .eq('user_id', user.id)
      .eq('list_type', 'dictée')
      .eq('language', 'Français')
      .order('name')
    setLists(data || [])
  }

  const initWord = (word: AnagramWord, diff: Difficulty, shuffledLetters?: string[]) => {
    const letters = shuffledLetters ?? word.shuffled
    const newBank: BankItem[] = letters.map((letter, i) => ({ letter, id: `${i}-${letter}-${Date.now()}`, used: false }))
    const newPlaced: PlacedItem[] = new Array(word.target.length).fill(null)

    if (diff === 'facile') {
      const firstLetter = word.target[0].toUpperCase()
      const itemIdx = newBank.findIndex(b => b.letter === firstLetter && !b.used)
      if (itemIdx !== -1) {
        newBank[itemIdx] = { ...newBank[itemIdx], used: true }
        newPlaced[0] = { letter: firstLetter, bankId: newBank[itemIdx].id }
        setHintFirst(true)
      } else {
        setHintFirst(false)
      }
    } else {
      setHintFirst(false)
    }

    setBank(newBank)
    setPlaced(newPlaced)
    setHintTranslation(false)
    setAttempts(0)
    setFeedback(null)
    validatingRef.current = false
  }

  const startGame = async () => {
    if (!selectedListId || loading) return
    setLoading(true)

    const [revBonus, { data: rawItems }] = await Promise.all([
      hasRevisionBonusForList(selectedListId),
      supabase.from('word_items').select('source_word, target_word').eq('list_id', selectedListId),
    ])
    setHasRevisionBonus(revBonus)
    setLoading(false)

    let items = ((rawItems || []) as { source_word: string; target_word: string }[])
      .filter(w => w.source_word)

    if (items.length === 0) return

    if (difficulty === 'facile') {
      const short = items.filter(w => w.source_word.length <= 5)
      if (short.length >= TOTAL_WORDS) items = short
    } else if (difficulty === 'difficile') {
      const long = items.filter(w => w.source_word.length >= 6)
      if (long.length >= TOTAL_WORDS) items = long
    }

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
    initWord(anagramWords[0], difficulty)
    setGameState('playing')
  }

  const checkHighscore = async (finalScore: number): Promise<boolean> => {
    if (localStorage.getItem('odigo_highscores') === 'off') return false
    if (!selectedListId) return false
    const { data } = await supabase
      .from('highscores').select('score')
      .eq('exercise', 'anagramme-francais').eq('list_id', selectedListId)
      .order('score', { ascending: false }).limit(5)
    if (!data) return false
    if (data.length < 5) return true
    return finalScore > data[data.length - 1].score
  }

  const finaliser = async (totalPoints: number, totalCorrect: number) => {
    setShowHighscore(false)
    setGameState('result')
    const [, isTop] = await Promise.all([
      logActivity({
        action_type: 'exercise_completed',
        questions_total: TOTAL_WORDS,
        questions_correct: totalCorrect,
        metadata: { exercise: 'anagramme-francais', listId: selectedListId },
      }),
      checkHighscore(totalPoints),
    ])
    setShowHighscore(isTop)
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
          initWord(words[nextIdx], difficulty)
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
        initWord(cw, difficulty, reshuffled)
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
      initWord(words[nextIdx], difficulty)
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
  const progress = ((currentIndex + 1) / TOTAL_WORDS) * 100

  if (gameState === 'select') {
    return (
      <div>
        <h2 style={{ color: PRIMARY, marginBottom: '0.5rem' }}>🔤 Anagramme — Français</h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>Remets les lettres dans le bon ordre !</p>

        {lists.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="Aucune liste disponible"
            subtitle="Crée une liste de type Dictée en français pour jouer à cet exercice."
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
              {lists.map(l => <option key={l.id} value={l.id}>{l.name} — {l.language} ({l.list_type})</option>)}
            </select>

            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Difficulté
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {(['facile', 'moyen', 'difficile'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1, padding: '0.5rem',
                    background: difficulty === d ? PRIMARY : 'white',
                    color: difficulty === d ? 'white' : '#555',
                    border: `1px solid ${difficulty === d ? PRIMARY : '#ddd'}`,
                    borderRadius: '0.5rem',
                    cursor: 'pointer', fontSize: '0.85rem',
                    fontWeight: difficulty === d ? 'bold' : 'normal',
                  }}
                >
                  {d === 'facile' ? '😊 Facile' : d === 'moyen' ? '😐 Moyen' : '💪 Difficile'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '1.5rem' }}>
              {difficulty === 'facile' ? 'Mots courts (≤ 5 lettres) · 1ère lettre offerte' :
               difficulty === 'difficile' ? 'Mots longs (≥ 6 lettres)' :
               'Tous les mots de la liste'}
            </div>

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
            {selectedListId && localStorage.getItem('odigo_highscores') !== 'off' && (
              <button onClick={() => setShowLeaderboard(true)} style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', background: 'none', color: '#aaa', border: '1px solid #eee', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                🏆 Voir le classement
              </button>
            )}
          </div>
        )}
        {showLeaderboard && (
          <HighscoreModal
            exercise="anagramme-francais"
            listId={selectedListId}
            listName={lists.find(l => l.id === selectedListId)?.name ?? ''}
            score={0}
            initialPhase="leaderboard"
            onClose={() => setShowLeaderboard(false)}
            onDisable={() => setShowLeaderboard(false)}
            onReplay={() => { setShowLeaderboard(false); startGame() }}
            onQuit={() => setShowLeaderboard(false)}
          />
        )}
      </div>
    )
  }

  if (gameState === 'result') {
    return (
      <ExerciseBilan
        exercise="anagramme-francais"
        errors={TOTAL_WORDS - results.filter(Boolean).length}
        difficulty={difficulty}
        hasRevisionBonus={hasRevisionBonus}
        onDone={() => {
          if (showHighscore) setGameState('highscore')
          else { setGameState('select'); setWords([]) }
        }}
      />
    )
  }

  const listName = lists.find(l => l.id === selectedListId)?.name ?? ''

  if (gameState === 'highscore') {
    return (
      <HighscoreModal
        exercise="anagramme-francais"
        listId={selectedListId}
        listName={listName}
        score={points}
        onClose={() => { setShowHighscore(false); setGameState('select'); setWords([]) }}
        onDisable={() => { setShowHighscore(false); setGameState('select'); setWords([]) }}
        onReplay={() => { setShowHighscore(false); setGameState('select'); startGame() }}
        onQuit={() => { setShowHighscore(false); setGameState('select'); setWords([]) }}
      />
    )
  }

  return (
    <>
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>Mot {currentIndex + 1} / {TOTAL_WORDS}</span>
          <span style={{ color: PRIMARY, fontWeight: 'bold', fontSize: '0.9rem' }}>
            {points} pt{points !== 1 ? 's' : ''}
            {streak >= 3 && ` 🔥 série ${streak}`}
          </span>
        </div>
        <div style={{ height: '6px', background: '#e0f0ee', borderRadius: '3px' }}>
          <div style={{ height: '100%', background: PRIMARY, borderRadius: '3px', width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {currentWord && (
        <>
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
                  style={{ width: '44px', height: '4px', background: '#ccc', borderRadius: '2px', alignSelf: 'flex-end', marginBottom: '4px' }}
                />
              )
            ))}
          </div>

          {/* Indice traduction */}
          {hintTranslation && (
            <div style={{ background: '#f0faf8', borderRadius: '0.5rem', padding: '0.5rem 1rem', marginTop: '0.75rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#2a9d8f', fontStyle: 'italic', textAlign: 'center' }}>
              Traduction : {currentWord.translation}
            </div>
          )}

          {/* Banque de lettres */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.5rem' }}>
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
              style={{ padding: '0.4rem 0.9rem', background: 'white', color: PRIMARY, border: `1px solid ${PRIMARY}`, borderRadius: '0.5rem', cursor: feedback !== null ? 'default' : 'pointer', fontSize: '0.85rem' }}
            >
              🔀 Mélanger
            </button>
            {!hintFirst && (
              <button
                onClick={applyHintFirst}
                disabled={feedback !== null}
                style={{ padding: '0.4rem 0.9rem', background: 'white', color: '#e76f51', border: '1px solid #e76f51', borderRadius: '0.5rem', cursor: feedback !== null ? 'default' : 'pointer', fontSize: '0.85rem' }}
              >
                💡 1ère lettre
              </button>
            )}
            {currentWord.translation && (
              <button
                onClick={() => setHintTranslation(true)}
                disabled={feedback !== null || hintTranslation}
                style={{
                  padding: '0.4rem 0.9rem', background: 'white', color: '#e76f51',
                  border: '1px solid #e76f51', borderRadius: '0.5rem',
                  cursor: feedback !== null || hintTranslation ? 'default' : 'pointer',
                  fontSize: '0.85rem',
                  opacity: hintTranslation ? 0.5 : 1,
                }}
              >
                🌍 Traduction
              </button>
            )}
            <button
              onClick={skipWord}
              disabled={feedback !== null}
              style={{ padding: '0.4rem 0.9rem', background: 'white', color: '#888', border: '1px solid #ccc', borderRadius: '0.5rem', cursor: feedback !== null ? 'default' : 'pointer', fontSize: '0.85rem' }}
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
    </>
  )
}
