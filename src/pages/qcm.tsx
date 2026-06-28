import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'

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
type Mode = 'debutant' | 'avance' | 'expert'

const TOTAL_WORDS = 15
const MODE_CONFIG = {
  debutant: { choices: 2, basePoints: 5, bonusSpeed: 2, label: 'Débutant', emoji: '🌱' },
  avance: { choices: 4, basePoints: 10, bonusSpeed: 5, label: 'Avancé', emoji: '⚡' },
  expert: { choices: 8, basePoints: 20, bonusSpeed: 10, label: 'Expert', emoji: '💎' },
}

const speak = (text: string) => {
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = /[Ͱ-Ͽ]/.test(text) ? 'el-GR' : 'en-GB'
  speechSynthesis.speak(utterance)
}

const audioButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '0.75rem', color: '#2a9d8f', alignSelf: 'center',
  padding: '0.1rem 0.5rem',
}

export default function QCM() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [mode, setMode] = useState<Mode>('avance')
  const [direction, setDirection] = useState<'foreign' | 'french'>('foreign')
  const [words, setWords] = useState<WordItem[]>([])

  // Game state
  const [queue, setQueue] = useState<WordItem[]>([])
  const [failedWords, setFailedWords] = useState<WordItem[]>([])
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [isReviewPhase, setIsReviewPhase] = useState(false)
  const [startTime, setStartTime] = useState(0)
  const [highScores, setHighScores] = useState<{ score: number; date: string; mode: string }[]>([])
  const [fireMode, setFireMode] = useState<null | 'small' | 'big'>(null)

  useEffect(() => { fetchLists() }, [])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('word_lists').select('id, name').eq('user_id', user.id).order('name')
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

  const getChoices = useCallback((correct: WordItem, allWords: WordItem[], numChoices: number) => {
    const correctAnswer = direction === 'foreign' ? correct.target_word : correct.source_word
    const others = allWords
      .filter(w => w.id !== correct.id)
      .map(w => direction === 'foreign' ? w.target_word : w.source_word)
      .filter((v, i, a) => a.indexOf(v) === i && v)
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, numChoices - 1)
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
      setScore(0)
      setStreak(0)
      setWordsCompleted(0)
      setFailedWords([])
      setIsReviewPhase(false)
      setFireMode(null)
      setGameState('playing')
    }
  }, [words])

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
      setGameState('result')
      saveScore()
      return
    }
    setQueue(nextQueue)
    setCurrentWord(next)
    setChoices(getChoices(next, words, MODE_CONFIG[mode].choices))
    setFeedback(null)
    setStartTime(Date.now())
  }, [currentWord, queue, gameState])

  const handleAnswer = useCallback((chosen: string) => {
    if (!currentWord || feedback) return
    const config = MODE_CONFIG[mode]
    const correctAnswer = direction === 'foreign' ? currentWord.target_word : currentWord.source_word
    const isCorrect = chosen === correctAnswer
    const elapsed = (Date.now() - startTime) / 1000

    setFeedback({ correct: isCorrect, answer: correctAnswer })

    if (isCorrect) {
      const newStreak = streak + 1
      setStreak(newStreak)

      let points = config.basePoints
      if (elapsed < 3) points += config.bonusSpeed

      const newFireMode = newStreak >= 10 ? 'big' : newStreak >= 4 ? 'small' : null
      setFireMode(newFireMode)

      if (newStreak >= 10) points += 15
      else if (newStreak >= 4) points += 5

      setScore(prev => prev + points)
    } else {
      setStreak(0)
      setFireMode(null)
      setFailedWords(prev => [...prev, currentWord])
    }

    setWordsCompleted(prev => prev + 1)

    setTimeout(() => {
      setCurrentWord(null)
      setFeedback(null)
    }, 1000)
  }, [currentWord, feedback, mode, direction, streak, startTime])

  const saveScore = async () => {
    const key = `qcm_scores_${selectedList}_${mode}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const newScore = { score, date: new Date().toLocaleDateString('fr-CH'), mode: MODE_CONFIG[mode].label }
    const updated = [...existing, newScore].sort((a, b) => b.score - a.score).slice(0, 10)
    localStorage.setItem(key, JSON.stringify(updated))
    await addDigoos(5 + Math.floor(score / 10))
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: wordsCompleted,
      questions_correct: wordsCompleted - failedWords.length,
      metadata: { exercise: 'qcm', mode },
    })
    setHighScores(updated)
  }

  const loadHighScores = (listId: string, m: Mode) => {
    const key = `qcm_scores_${listId}_${m}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    setHighScores(existing)
  }

  const displayWord = currentWord
    ? (direction === 'foreign' ? currentWord.source_word : currentWord.target_word)
    : ''

  const getFireEmoji = () => {
    if (fireMode === 'big') return '🔥🔥'
    if (fireMode === 'small') return '🔥'
    return ''
  }

  if (gameState === 'select') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>🧠 QCM</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '450px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste</label>
            <select value={selectedList} onChange={e => { setSelectedList(e.target.value); loadHighScores(e.target.value, mode) }} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}>
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mode</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); loadHighScores(selectedList, m) }} style={{ flex: 1, padding: '0.6rem', background: mode === m ? '#2a9d8f' : 'var(--color-border)', color: mode === m ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  {MODE_CONFIG[m].emoji} {MODE_CONFIG[m].label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Direction</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setDirection('foreign')} style={{ flex: 1, padding: '0.6rem', background: direction === 'foreign' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'foreign' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Langue → Français
              </button>
              <button onClick={() => setDirection('french')} style={{ flex: 1, padding: '0.6rem', background: direction === 'french' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'french' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Français → Langue
              </button>
            </div>
          </div>

          <button onClick={startGame} disabled={!selectedList} style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}>
            🚀 Jouer
          </button>

          {highScores.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.5rem' }}>🏆 Meilleurs scores — {MODE_CONFIG[mode].label}</h3>
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
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>{score} pts</div>
        <div style={{ color: '#888', marginBottom: '2rem' }}>{wordsCompleted} mots traités · Mode {MODE_CONFIG[mode].label}</div>

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
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>

      {/* HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 'bold', color: '#2a9d8f', fontSize: '1.2rem' }}>
          {score} pts {getFireEmoji()}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888' }}>
          {streak > 0 && <span style={{ color: fireMode ? '#e9c46a' : '#2a9d8f', marginRight: '0.5rem' }}>série : {streak}</span>}
          {wordsCompleted}/{totalWords}
          {isReviewPhase && <span style={{ color: '#e63946', marginLeft: '0.3rem' }}>révision</span>}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888' }}>{MODE_CONFIG[mode].emoji} {MODE_CONFIG[mode].label}</div>
      </div>

      {/* Mot à traduire */}
      {currentWord && (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          marginBottom: '1.5rem',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#333',
          minHeight: '100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}>
          {displayWord}
          {direction === 'french' && !feedback && (
            <button onClick={() => speak(displayWord)} style={audioButtonStyle}>
              🔊 Écouter
            </button>
          )}
        </div>
      )}

      {/* Choix */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mode === 'expert' ? 'repeat(4, 1fr)' : mode === 'avance' ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
        gap: '0.75rem',
      }}>
        {choices.map((choice, i) => {
          const isCorrect = feedback && choice === feedback.answer
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button
                onClick={() => handleAnswer(choice)}
                disabled={!!feedback}
                style={{
                  padding: '0.75rem',
                  background: feedback
                    ? isCorrect ? '#2a9d8f' : '#f5f5f5'
                    : 'white',
                  color: feedback
                    ? isCorrect ? 'white' : '#aaa'
                    : '#333',
                  border: `2px solid ${feedback ? (isCorrect ? '#2a9d8f' : '#eee') : 'var(--color-border)'}`,
                  borderRadius: '0.75rem',
                  cursor: feedback ? 'default' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {choice}
              </button>
              {direction === 'foreign' && !feedback && (
                <button onClick={() => speak(choice)} style={audioButtonStyle}>
                  🔊 Écouter
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: feedback.correct ? '#2a9d8f' : '#e63946' }}>
          {feedback.correct ? `✓ Correct ! ${getFireEmoji()}` : `✗ Réponse : ${feedback.answer}`}
        </div>
      )}
    </div>
  )
}