import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../services/activity'
import ExerciseBilan from '../components/ExerciseBilan'
import type { RecapItem } from '../lib/exerciseBilan'
import { hasRevisionBonusForList } from '../services/revisionBonus'

interface WordItem {
  id: string
  source_word: string
  target_word: string
}

interface WordList {
  id: string
  name: string
  language: string
  list_type: string
}

type GameState = 'select' | 'playing' | 'result'
type Difficulty = 'facile' | 'moyen' | 'difficile'

const TOTAL_WORDS = 10
const SPEED_REDUCTION = 200

const SPEED_BY_DIFFICULTY: Record<Difficulty, { initial: number; min: number }> = {
  facile: { initial: 10000, min: 5000 },
  moyen: { initial: 8000, min: 3000 },
  difficile: { initial: 6000, min: 2000 },
}

const DIFFICULTIES: { id: Difficulty; label: string; icon: string }[] = [
  { id: 'facile', label: 'Facile', icon: '😊' },
  { id: 'moyen', label: 'Moyen', icon: '🙂' },
  { id: 'difficile', label: 'Difficile', icon: '💪' },
]

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface GuestProps {
  guestMode?: boolean
  guestListId?: string
  guestLanguage?: string
  onGameEnd?: () => void
}

export default function WordDrop({ guestMode, guestListId, onGameEnd }: GuestProps) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [listName, setListName] = useState('')
  const [direction, setDirection] = useState<'foreign' | 'french'>('foreign')
  const [difficulty, setDifficulty] = useState<Difficulty>('moyen')
  const [words, setWords] = useState<WordItem[]>([])

  const [queue, setQueue] = useState<WordItem[]>([])
  const [failedWords, setFailedWords] = useState<WordItem[]>([])
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [wordPos, setWordPos] = useState(1)
  const [isFalling, setIsFalling] = useState(false)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [lives, setLives] = useState(3)
  const [score, setScore] = useState(0)
  const [_speed, setSpeed] = useState(SPEED_BY_DIFFICULTY.moyen.initial)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [isReviewPhase, setIsReviewPhase] = useState(false)
  const [correctFirstPass, setCorrectFirstPass] = useState(0)
  const [resultats, setResultats] = useState<{
    mot: string; attendu: string; donne: string; correct: boolean; isReview: boolean
  }[]>([])
  const [hasRevisionBonus, setHasRevisionBonus] = useState(false)
  const [selectedKeyboard, setSelectedKeyboard] = useState(1)
  const [startTime, setStartTime] = useState(0)
  const [wordY, setWordY] = useState(80)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const speedRef = useRef(SPEED_BY_DIFFICULTY.moyen.initial)
  const feedbackRef = useRef<'correct' | 'wrong' | null>(null)
  const currentWordRef = useRef<WordItem | null>(null)
  const directionRef = useRef<'foreign' | 'french'>('foreign')
  const isReviewPhaseRef = useRef(false)
  const initialSpeedRef = useRef(SPEED_BY_DIFFICULTY.moyen.initial)
  const minSpeedRef = useRef(SPEED_BY_DIFFICULTY.moyen.min)

  useEffect(() => { directionRef.current = direction }, [direction])
  useEffect(() => { isReviewPhaseRef.current = isReviewPhase }, [isReviewPhase])
  useEffect(() => {
    initialSpeedRef.current = SPEED_BY_DIFFICULTY[difficulty].initial
    minSpeedRef.current = SPEED_BY_DIFFICULTY[difficulty].min
  }, [difficulty])

  useEffect(() => {
    if (guestMode && guestListId) {
      setSelectedList(guestListId)
      fetchWords(guestListId)
    } else {
      fetchLists()
    }
  }, [])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('word_lists').select('id, name, language, list_type').eq('user_id', user.id).eq('list_type', 'vocabulaire').order('name')
    if (data) setLists(data)
  }

  const fetchWords = async (listId: string) => {
    const { data } = await supabase.from('word_items').select('*').eq('list_id', listId)
    if (data) setWords(data.filter(w => w.source_word && w.target_word))
  }

  const buildQueue = (wordPool: WordItem[]) => {
    if (wordPool.length >= TOTAL_WORDS) {
      const q: WordItem[] = []
      for (let i = 0; i < TOTAL_WORDS; i++) {
        q.push(wordPool[Math.floor(Math.random() * wordPool.length)])
      }
      return q
    }
    // Liste < 10 mots : chaque mot au moins une fois, complément aléatoire jusqu'à 10
    const q: WordItem[] = [...wordPool]
    while (q.length < TOTAL_WORDS) {
      q.push(wordPool[Math.floor(Math.random() * wordPool.length)])
    }
    return shuffleArray(q)
  }

  const getChoices = useCallback((correct: WordItem, allWords: WordItem[]) => {
    const correctAnswer = direction === 'foreign' ? correct.target_word : correct.source_word
    const others = allWords
      .filter(w => w.id !== correct.id)
      .map(w => direction === 'foreign' ? w.target_word : w.source_word)
      .filter((v, i, a) => a.indexOf(v) === i)
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 2)
    return [correctAnswer, ...shuffled].sort(() => Math.random() - 0.5)
  }, [direction])

  const startGame = async () => {
    if (!selectedList) return
    const [revBonus] = await Promise.all([
      hasRevisionBonusForList(selectedList),
      fetchWords(selectedList),
    ])
    setHasRevisionBonus(revBonus)
  }

  useEffect(() => {
    if (words.length > 0 && gameState === 'select') {
      const q = buildQueue(words)
      setQueue(q)
      setTotalWords(TOTAL_WORDS)
      setLives(3)
      setScore(0)
      setSpeed(initialSpeedRef.current)
      speedRef.current = initialSpeedRef.current
      setWordsCompleted(0)
      setFailedWords([])
      setIsReviewPhase(false)
      setCorrectFirstPass(0)
      setResultats([])
      setGameState('playing')
    }
  }, [words])

  const stopAnimation = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }

  const startFalling = useCallback((currentSpeed: number) => {
    stopAnimation()
    startTimeRef.current = performance.now()

    const START_Y = 80
    const END_Y = 380

    const animate = (now: number) => {
      if (feedbackRef.current) return
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / currentSpeed, 1)
      const y = START_Y + (END_Y - START_Y) * progress
      setWordY(y)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Temps écoulé sans réponse = faux
        if (!feedbackRef.current && currentWordRef.current) {
          const cw = currentWordRef.current
          const correctAnswer = directionRef.current === 'foreign' ? cw.target_word : cw.source_word
          const motAffiche = directionRef.current === 'foreign' ? cw.source_word : cw.target_word
          feedbackRef.current = 'wrong'
          setFeedback('wrong')
          setLives(prev => prev - 1)
          setFailedWords(prev => [...prev, cw])
          setWordsCompleted(prev => prev + 1)
          setResultats(prev => [...prev, {
            mot: motAffiche, attendu: correctAnswer, donne: '—', correct: false, isReview: isReviewPhaseRef.current,
          }])
          speedRef.current = Math.min(initialSpeedRef.current, speedRef.current + SPEED_REDUCTION)
          setSpeed(speedRef.current)
          setTimeout(() => {
            feedbackRef.current = null
            setFeedback(null)
            setCurrentWord(null)
          }, 800)
        }
      }
    }
    animFrameRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    if (gameState !== 'playing') return
    if (currentWord) return

    const nextQueue = [...queue]
    const next = nextQueue.shift()
    if (!next) {
      if (failedWords.length > 0 && !isReviewPhase) {
        setIsReviewPhase(true)
        setQueue([...failedWords])
        setTotalWords(prev => prev + failedWords.length)
        setFailedWords([])
        return
      }
      stopAnimation()
      saveScore()
      return
    }
    setQueue(nextQueue)
    setCurrentWord(next)
    currentWordRef.current = next
    setChoices(getChoices(next, words))
    setWordPos(1)
    setSelectedKeyboard(1)
    feedbackRef.current = null
    setFeedback(null)
    setWordY(80)
    setStartTime(Date.now())
    setTimeout(() => startFalling(speedRef.current), 50)
  }, [currentWord, queue, gameState])

  useEffect(() => {
    return () => stopAnimation()
  }, [])

  const handleAnswer = useCallback((pos: number) => {
    if (!currentWord || feedbackRef.current) return
    stopAnimation()
    const correctAnswer = direction === 'foreign' ? currentWord.target_word : currentWord.source_word
    const motAffiche = direction === 'foreign' ? currentWord.source_word : currentWord.target_word
    const chosen = choices[pos]
    const elapsed = (Date.now() - startTime) / 1000
    const isCorrect = chosen === correctAnswer

    feedbackRef.current = isCorrect ? 'correct' : 'wrong'
    setFeedback(isCorrect ? 'correct' : 'wrong')
    setIsFalling(true)

    setResultats(prev => [...prev, {
      mot: motAffiche, attendu: correctAnswer, donne: chosen, correct: isCorrect, isReview: isReviewPhase,
    }])

    if (isCorrect) {
      const points = elapsed < 2 ? 15 : 10
      setScore(prev => prev + points)
      if (!isReviewPhase) setCorrectFirstPass(prev => prev + 1)
      speedRef.current = Math.max(minSpeedRef.current, speedRef.current - SPEED_REDUCTION)
      setSpeed(speedRef.current)
    } else {
      setLives(prev => prev - 1)
      setFailedWords(prev => [...prev, currentWord])
      speedRef.current = Math.min(initialSpeedRef.current, speedRef.current + SPEED_REDUCTION)
      setSpeed(speedRef.current)
    }

    setWordsCompleted(prev => prev + 1)

    setTimeout(() => {
      feedbackRef.current = null
      setFeedback(null)
      setIsFalling(false)
      setCurrentWord(null)
    }, 800)
  }, [currentWord, choices, direction, startTime, isReviewPhase])

  const handleValidate = useCallback(() => {
    handleAnswer(wordPos)
  }, [handleAnswer, wordPos])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || !currentWord || feedbackRef.current) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setWordPos(prev => Math.max(0, prev - 1))
        setSelectedKeyboard(prev => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setWordPos(prev => Math.min(2, prev + 1))
        setSelectedKeyboard(prev => Math.min(2, prev + 1))
      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        handleValidate()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState, currentWord, handleValidate])

  const saveScore = async () => {
    if (guestMode) {
      onGameEnd?.()
      return
    }
    setGameState('result')
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: TOTAL_WORDS,
      questions_correct: correctFirstPass,
      metadata: { exercise: 'worddrop' },
    })
  }

  const getWordLeft = () => {
    if (wordPos === 0) return '16.6%'
    if (wordPos === 1) return '50%'
    return '83.3%'
  }

  const displayWord = currentWord
    ? (direction === 'foreign' ? currentWord.source_word : currentWord.target_word)
    : ''

  if (gameState === 'select') {
    if (guestMode) return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Chargement...</div>
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>🎮 Word Drop</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '400px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Choisir une liste</label>
            <select value={selectedList} onChange={e => {
              setSelectedList(e.target.value)
              const l = lists.find(x => x.id === e.target.value)
              if (l) setListName(l.name)
            }} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}>
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name} — {l.language} ({l.list_type})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Direction</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setDirection('foreign')} style={{ flex: 1, padding: '0.6rem', background: direction === 'foreign' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'foreign' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Langue étrangère → Français
              </button>
              <button onClick={() => setDirection('french')} style={{ flex: 1, padding: '0.6rem', background: direction === 'french' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'french' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Français → Langue étrangère
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Difficulté</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  style={{ flex: 1, padding: '0.6rem', background: difficulty === d.id ? '#2a9d8f' : 'var(--color-border)', color: difficulty === d.id ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: difficulty === d.id ? 'bold' : 'normal' }}
                >
                  {d.icon} {d.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={startGame} disabled={!selectedList} style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}>
            🚀 Jouer
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'result' && !guestMode) {
    const recapItems: RecapItem[] = resultats.map(r => ({
      label: r.mot,
      correct: r.correct,
      detail: r.isReview ? 'révision' : (r.correct ? undefined : r.donne),
    }))
    return (
      <ExerciseBilan
        exercise="worddrop"
        errors={TOTAL_WORDS - correctFirstPass}
        difficulty={difficulty}
        hasRevisionBonus={hasRevisionBonus}
        listName={listName || undefined}
        recapItems={recapItems}
        onDone={() => { setGameState('select'); setWords([]) }}
      >
        <div style={{ maxWidth: '560px', margin: '0 auto', marginTop: '1rem', paddingBottom: '2rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem' }}>
            <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
            {resultats.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem', gap: '0.5rem' }}>
                <span style={{ color: '#555', width: '110px', flexShrink: 0, wordBreak: 'break-word' }}>
                  <strong>{r.mot}</strong>
                  {r.isReview && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#e9c46a', fontWeight: 'normal' }}>révision</span>
                  )}
                </span>
                <span style={{ flex: 1, color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold', textAlign: 'right' }}>
                  {r.correct ? `✓ ${r.attendu}` : `✗ ${r.donne} → ${r.attendu}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ExerciseBilan>
    )
  }

  return (
    <div style={{ position: 'relative', height: '500px', background: 'var(--color-background)', borderRadius: '1rem', overflow: 'hidden', userSelect: 'none' }}>

      {/* HUD */}
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ fontSize: '1.2rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i}>{i < lives ? '❤️' : '🖤'}</span>
          ))}
        </div>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '0.3rem 0.8rem', fontWeight: 'bold', color: '#2a9d8f' }}>
          {score} pts
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888' }}>
          {wordsCompleted}/{totalWords}
          {isReviewPhase && <span style={{ color: '#e63946', marginLeft: '0.3rem' }}>révision</span>}
        </div>
      </div>

      {/* Barre de progression (1er passage, total fixe = 10, figée à 100% pendant la révision) */}
      <div style={{ position: 'absolute', top: '3.1rem', left: '1rem', right: '1rem', zIndex: 10 }}>
        <div style={{ background: 'rgba(0,0,0,0.08)', borderRadius: '1rem', height: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${(Math.min(wordsCompleted, TOTAL_WORDS) / TOTAL_WORDS) * 100}%`, background: '#2a9d8f', height: '100%', borderRadius: '1rem', transition: 'width 0.2s' }} />
        </div>
      </div>

      {/* Mot qui tombe */}
      {currentWord && (
        <div style={{
          position: 'absolute',
          top: `${wordY}px`,
          left: getWordLeft(),
          transform: 'translateX(-50%)',
          textAlign: 'center',
          transition: isFalling ? 'left 0.15s ease' : 'left 0.15s ease',
          zIndex: 5,
        }}>
          <div style={{
            display: 'inline-block',
            whiteSpace: 'nowrap',
            minWidth: '80px',
            maxWidth: '160px',
            background: feedback === 'correct' ? '#2a9d8f' : feedback === 'wrong' ? '#e63946' : 'white',
            color: feedback ? 'white' : '#333',
            padding: '0.5rem 1rem',
            borderRadius: '0.75rem',
            fontWeight: 'bold',
            fontSize: '1rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'background 0.2s',
          }}>
            {displayWord}
          </div>
        </div>
      )}

      {/* Zone de réponses */}
      <div style={{ position: 'absolute', bottom: '1.5rem', left: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
        {choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => { setWordPos(i); setSelectedKeyboard(i); setTimeout(() => handleAnswer(i), 150) }}
            style={{
              flex: 1,
              padding: '0.75rem 0.5rem',
              background: selectedKeyboard === i ? '#2a9d8f' : 'white',
              color: selectedKeyboard === i ? 'white' : '#333',
              border: `2px solid ${selectedKeyboard === i ? '#2a9d8f' : 'var(--color-border)'}`,
              borderRadius: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              transition: 'all 0.15s',
            }}
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  )
}