import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface WordItem {
  id: string
  source_word: string
  target_word: string
}

interface WordList {
  id: string
  name: string
}

type GameState = 'select' | 'playing' | 'result'

const TOTAL_WORDS = 15
const INITIAL_SPEED = 8000
const MIN_SPEED = 3000
const SPEED_REDUCTION = 200

export default function WordDrop() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [direction, setDirection] = useState<'foreign' | 'french'>('foreign')
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
  const [speed, setSpeed] = useState(INITIAL_SPEED)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [isReviewPhase, setIsReviewPhase] = useState(false)
  const [selectedKeyboard, setSelectedKeyboard] = useState(1)
  const [startTime, setStartTime] = useState(0)
  const [highScores, setHighScores] = useState<{ score: number; date: string }[]>([])
  const [wordY, setWordY] = useState(80)
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const speedRef = useRef(INITIAL_SPEED)
  const feedbackRef = useRef<'correct' | 'wrong' | null>(null)
  const currentWordRef = useRef<WordItem | null>(null)

  useEffect(() => { fetchLists() }, [])

  const fetchLists = async () => {
    const { data } = await supabase.from('word_lists').select('id, name').order('name')
    if (data) setLists(data)
  }

  const fetchWords = async (listId: string) => {
    const { data } = await supabase.from('word_items').select('*').eq('list_id', listId)
    if (data) setWords(data.filter(w => w.source_word && w.target_word))
  }

  const buildQueue = (wordPool: WordItem[]) => {
    const q: WordItem[] = []
    for (let i = 0; i < TOTAL_WORDS; i++) {
      q.push(wordPool[Math.floor(Math.random() * wordPool.length)])
    }
    return q
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
    await fetchWords(selectedList)
  }

  useEffect(() => {
    if (words.length > 0 && gameState === 'select') {
      const q = buildQueue(words)
      setQueue(q)
      setTotalWords(TOTAL_WORDS)
      setLives(3)
      setScore(0)
      setSpeed(INITIAL_SPEED)
      speedRef.current = INITIAL_SPEED
      setWordsCompleted(0)
      setFailedWords([])
      setIsReviewPhase(false)
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
    const GAME_HEIGHT = 500
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
          feedbackRef.current = 'wrong'
          setFeedback('wrong')
          setLives(prev => prev - 1)
          setFailedWords(prev => [...prev, currentWordRef.current!])
          setWordsCompleted(prev => prev + 1)
          speedRef.current = Math.min(INITIAL_SPEED, speedRef.current + SPEED_REDUCTION)
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
      setGameState('result')
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
    const chosen = choices[pos]
    const elapsed = (Date.now() - startTime) / 1000
    const isCorrect = chosen === correctAnswer

    feedbackRef.current = isCorrect ? 'correct' : 'wrong'
    setFeedback(isCorrect ? 'correct' : 'wrong')
    setIsFalling(true)

    if (isCorrect) {
      const points = elapsed < 2 ? 15 : 10
      setScore(prev => prev + points)
      speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_REDUCTION)
      setSpeed(speedRef.current)
    } else {
      setLives(prev => prev - 1)
      setFailedWords(prev => [...prev, currentWord])
      speedRef.current = Math.min(INITIAL_SPEED, speedRef.current + SPEED_REDUCTION)
      setSpeed(speedRef.current)
    }

    setWordsCompleted(prev => prev + 1)

    setTimeout(() => {
      feedbackRef.current = null
      setFeedback(null)
      setIsFalling(false)
      setCurrentWord(null)
    }, 800)
  }, [currentWord, choices, direction, startTime])

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

  const saveScore = () => {
    const key = `worddrop_scores_${selectedList}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const newScore = { score, date: new Date().toLocaleDateString('fr-CH') }
    const updated = [...existing, newScore].sort((a, b) => b.score - a.score).slice(0, 10)
    localStorage.setItem(key, JSON.stringify(updated))
    setHighScores(updated)
  }

  const loadHighScores = (listId: string) => {
    const key = `worddrop_scores_${listId}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    setHighScores(existing)
  }

  const getWordLeft = () => {
    if (wordPos === 0) return 'calc(16.6% - 60px)'
    if (wordPos === 1) return 'calc(50% - 60px)'
    return 'calc(83.3% - 60px)'
  }

  const displayWord = currentWord
    ? (direction === 'foreign' ? currentWord.source_word : currentWord.target_word)
    : ''

  if (gameState === 'select') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>🎮 Word Drop</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '400px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Choisir une liste</label>
            <select value={selectedList} onChange={e => { setSelectedList(e.target.value); loadHighScores(e.target.value) }} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}>
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Direction</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setDirection('foreign')} style={{ flex: 1, padding: '0.6rem', background: direction === 'foreign' ? '#2a9d8f' : '#e0f0ee', color: direction === 'foreign' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Langue étrangère → Français
              </button>
              <button onClick={() => setDirection('french')} style={{ flex: 1, padding: '0.6rem', background: direction === 'french' ? '#2a9d8f' : '#e0f0ee', color: direction === 'french' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Français → Langue étrangère
              </button>
            </div>
          </div>

          <button onClick={startGame} disabled={!selectedList} style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}>
            🚀 Jouer
          </button>

          {highScores.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.5rem' }}>🏆 Meilleurs scores</h3>
              {highScores.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem' }}>
                  <span style={{ color: i === 0 ? '#e9c46a' : '#555' }}>#{i + 1} {i === 0 ? '🥇' : ''}</span>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>{s.score} pts</span>
                  <span style={{ color: '#aaa' }}>{s.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'result') {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '2rem', marginBottom: '0.5rem' }}>Partie terminée !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.5rem' }}>{score} pts</div>
        <div style={{ color: '#888', marginBottom: '2rem' }}>{wordsCompleted} mots traités</div>

        {highScores.length > 0 && (
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '300px', margin: '0 auto 1.5rem' }}>
            <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.5rem' }}>🏆 Meilleurs scores</h3>
            {highScores.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem' }}>
                <span style={{ color: i === 0 ? '#e9c46a' : '#555' }}>#{i + 1} {i === 0 ? '🥇' : ''}</span>
                <span style={{ fontWeight: 'bold', color: '#333' }}>{s.score} pts</span>
                <span style={{ color: '#aaa' }}>{s.date}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => { setGameState('select'); setWords([]) }} style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}>
          Rejouer
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '500px', background: '#f0faf8', borderRadius: '1rem', overflow: 'hidden', userSelect: 'none' }}>

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

      {/* Mot qui tombe */}
      {currentWord && (
        <div style={{
          position: 'absolute',
          top: `${wordY}px`,
          left: getWordLeft(),
          width: '120px',
          textAlign: 'center',
          transition: isFalling ? 'left 0.15s ease' : 'left 0.15s ease',
          zIndex: 5,
        }}>
          <div style={{
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
              border: `2px solid ${selectedKeyboard === i ? '#2a9d8f' : '#e0f0ee'}`,
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