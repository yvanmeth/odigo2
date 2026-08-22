import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import HighscoreModal from '../components/HighscoreModal'

type GameState = 'intro' | 'playing' | 'result'

interface DefiQuestion {
  id: string
  question: string
  type: 'qcm' | 'saisie'
  category: string
  choices: string[] | null
  answer: string
}

interface DefiParentsProps {
  userId: string
  onBack?: () => void
}

const calculatePoints = (timeLeft: number): number => {
  return Math.max(10, Math.round(10 + (timeLeft / 10) * 90))
}

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function DefiParents({ onBack }: DefiParentsProps) {
  const [gameState, setGameState] = useState<GameState>('intro')
  const [questions, setQuestions] = useState<DefiQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeProgress, setTimeProgress] = useState(100)
  const [totalScore, setTotalScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'timeout' | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [lastPoints, setLastPoints] = useState(0)
  const [lastBonus, setLastBonus] = useState(0)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [showHighscoreModal, setShowHighscoreModal] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [shuffledChoices, setShuffledChoices] = useState<string[]>([])

  // Refs pour la logique dans les callbacks/timeouts (évite les stale closures)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const resultsRef = useRef<boolean[]>([])
  const currentIndexRef = useRef(0)
  const timeLeftRef = useRef(10)
  const questionsRef = useRef<DefiQuestion[]>([])
  const feedbackRef = useRef<string | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startQuestion = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timeLeftRef.current = 10
    feedbackRef.current = null
    setTimeProgress(100)
    setFeedback(null)
    setUserAnswer('')
    setSelectedChoice(null)

    timerRef.current = setInterval(() => {
      setTimeProgress(prev => {
        const next = prev - 1
        timeLeftRef.current = Math.ceil(next / 10)
        if (next <= 0) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return next
      })
    }, 100)
  }

  const handleTimeout = () => {
    if (feedbackRef.current) return
    feedbackRef.current = 'timeout'
    clearInterval(timerRef.current!)
    streakRef.current = 0
    setStreak(0)
    const newResults = [...resultsRef.current, false]
    resultsRef.current = newResults
    setResults(newResults)
    setFeedback('timeout')
    setTimeout(() => nextQuestion(currentIndexRef.current, newResults), 1500)
  }

  const handleAnswer = (answer: string) => {
    if (feedbackRef.current) return
    clearInterval(timerRef.current!)

    const question = questionsRef.current[currentIndexRef.current]
    const isCorrect = answer.trim().toLowerCase() === question.answer.trim().toLowerCase()
    const newResults = [...resultsRef.current, isCorrect]
    resultsRef.current = newResults
    setResults(newResults)

    if (isCorrect) {
      const pts = calculatePoints(timeLeftRef.current)
      const newStreak = streakRef.current + 1
      const bonus = newStreak >= 3 ? 50 : 0
      scoreRef.current += pts + bonus
      streakRef.current = newStreak
      setTotalScore(scoreRef.current)
      setStreak(newStreak)
      setLastPoints(pts)
      setLastBonus(bonus)
      feedbackRef.current = 'correct'
      setFeedback('correct')
    } else {
      streakRef.current = 0
      setStreak(0)
      feedbackRef.current = 'incorrect'
      setFeedback('incorrect')
    }

    setTimeout(() => nextQuestion(currentIndexRef.current, newResults), 1500)
  }

  const nextQuestion = (fromIndex: number, currentResults: boolean[]) => {
    if (fromIndex + 1 >= questionsRef.current.length) {
      finaliser(currentResults)
    } else {
      const nextIdx = fromIndex + 1
      currentIndexRef.current = nextIdx
      setCurrentIndex(nextIdx)
      startQuestion()
    }
  }

  const fetchQuestions = async () => {
    // Reset complet
    scoreRef.current = 0
    streakRef.current = 0
    resultsRef.current = []
    currentIndexRef.current = 0
    timeLeftRef.current = 10
    feedbackRef.current = null
    setTotalScore(0)
    setStreak(0)
    setResults([])
    setCurrentIndex(0)
    setTotalCorrect(0)
    setShowHighscoreModal(false)
    setGameState('playing')

    const { data } = await supabase
      .from('defi_questions')
      .select('*')
      .eq('active', true)

    if (!data || data.length === 0) {
      setGameState('intro')
      return
    }

    const shuffled = [...data].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, 10) as DefiQuestion[]
    questionsRef.current = picked
    setQuestions(picked)
    startQuestion()
  }

  const finaliser = (finalResults: boolean[]) => {
    const correct = finalResults.filter(Boolean).length
    setTotalCorrect(correct)
    setGameState('result')
    checkAndShowHighscore()
  }

  const checkAndShowHighscore = async () => {
    if (localStorage.getItem('odigo_highscores') === 'off') return
    const { data } = await supabase
      .from('highscores')
      .select('score')
      .eq('exercise', 'defi-parents')
      .is('list_id', null)
      .order('score', { ascending: false })
      .limit(5)
    const isTop = !data || data.length < 5 || scoreRef.current > (data[data.length - 1]?.score || 0)
    if (isTop) setShowHighscoreModal(true)
  }

  const handleReplay = () => {
    setShowHighscoreModal(false)
    fetchQuestions()
  }

  const handleQuit = () => {
    setShowHighscoreModal(false)
    questionsRef.current = []
    setQuestions([])
    setGameState('intro')
  }

  useEffect(() => {
    const q = questions[currentIndex]
    if (q?.choices) setShuffledChoices(shuffleArray([...q.choices]))
    else setShuffledChoices([])
  }, [currentIndex, questions])

  // ═══ INTRO ═══
  if (gameState === 'intro') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: '1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
        <h2 style={{ color: '#e9c46a', marginBottom: '0.5rem' }}>Défi parents</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          10 questions de culture générale — réponds vite pour marquer plus de points !
        </p>
        <div style={{ background: '#f0faf8', borderRadius: '1rem', padding: '1.25rem', marginBottom: '2rem', textAlign: 'left' }}>
          <div style={{ fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.75rem' }}>Règles du jeu</div>
          {[
            '⏱️ 10 secondes max par question',
            '💯 Jusqu\'à 100 points par bonne réponse (dégressif selon le temps)',
            '🔥 Bonus +50 pts dès 3 bonnes réponses de suite',
          ].map((rule, i) => (
            <div key={i} style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{rule}</div>
          ))}
        </div>
        <button
          onClick={fetchQuestions}
          style={{ padding: '0.85rem 2.5rem', background: '#e9c46a', color: '#1a1a2e', border: 'none', borderRadius: '0.75rem', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
        >
          C'est parti ! 🚀
        </button>
      </div>
    )
  }

  // ═══ RÉSULTAT ═══
  if (gameState === 'result') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center', padding: '1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>Défi terminé !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#e9c46a', marginBottom: '0.25rem' }}>
          {totalScore} pts
        </div>
        <div style={{ color: '#666', marginBottom: '2rem' }}>
          {totalCorrect} / {questionsRef.current.length || 10} bonnes réponses
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '260px', margin: '0 auto' }}>
          <button onClick={handleReplay} style={{ padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
            🔄 Rejouer
          </button>
          <button onClick={() => setShowLeaderboard(true)} style={{ padding: '0.75rem', background: '#e9c46a', color: '#1a1a2e', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
            🏆 Voir le classement
          </button>
          {onBack && (
            <button onClick={onBack} style={{ padding: '0.75rem', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              Quitter
            </button>
          )}
        </div>

        {showHighscoreModal && (
          <HighscoreModal
            exercise="defi-parents"
            listId="defi-parents"
            listName="Défi parents"
            score={totalScore}
            onClose={() => setShowHighscoreModal(false)}
            onDisable={() => { localStorage.setItem('odigo_highscores', 'off'); setShowHighscoreModal(false) }}
            onReplay={handleReplay}
            onQuit={handleQuit}
          />
        )}

        {showLeaderboard && (
          <HighscoreModal
            exercise="defi-parents"
            listId="defi-parents"
            listName="Défi parents"
            score={0}
            initialPhase="leaderboard"
            onClose={() => setShowLeaderboard(false)}
            onDisable={() => setShowLeaderboard(false)}
            onReplay={() => {
              setShowLeaderboard(false)
              setGameState('intro')
              setTotalScore(0)
              setStreak(0)
              setResults([])
            }}
            onQuit={() => setShowLeaderboard(false)}
          />
        )}
      </div>
    )
  }

  // ═══ JEU ═══
  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) {
    return <div style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>Chargement des questions...</div>
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '0.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ color: '#888', fontSize: '0.9rem' }}>
          Question {currentIndex + 1} / {questions.length}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {streak >= 2 && (
            <span style={{ color: '#e76f51', fontWeight: 'bold', fontSize: '0.9rem' }}>🔥 x{streak}</span>
          )}
          <span style={{ color: '#e9c46a', fontWeight: 'bold' }}>{totalScore} pts</span>
        </div>
      </div>

      {/* Barre de temps */}
      <div style={{ height: '6px', background: '#e0e0e0', borderRadius: '3px', margin: '0.75rem 0' }}>
        <div style={{
          height: '100%',
          width: `${timeProgress}%`,
          background: timeProgress <= 30 ? '#e63946' : '#2a9d8f',
          borderRadius: '3px',
          transition: 'width 0.1s linear, background 0.3s',
        }} />
      </div>

      {/* Catégorie */}
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#888', background: '#f0faf8', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
          {currentQuestion.category}
        </span>
      </div>

      {/* Question */}
      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center', margin: '1rem 0', color: '#333', lineHeight: '1.4' }}>
        {currentQuestion.question}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          textAlign: 'center',
          background: feedback === 'correct' ? '#a5d6a7' : feedback === 'incorrect' ? '#ffd6c2' : '#f0f0f0',
          color: '#333',
          fontSize: '0.95rem',
          fontWeight: 'bold',
        }}>
          {feedback === 'correct' && (
            <>
              ✓ Bravo ! +{lastPoints} pts
              {lastBonus > 0 && <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>🔥 Bonus streak +{lastBonus} pts !</div>}
            </>
          )}
          {feedback === 'incorrect' && `✗ Réponse : ${currentQuestion.answer}`}
          {feedback === 'timeout' && `⏱️ Temps écoulé ! Réponse : ${currentQuestion.answer}`}
        </div>
      )}

      {/* QCM */}
      {currentQuestion.type === 'qcm' && shuffledChoices.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
          {shuffledChoices.map(choice => (
            <button
              key={choice}
              onClick={() => { setSelectedChoice(choice); handleAnswer(choice) }}
              disabled={!!feedback}
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '2px solid',
                cursor: feedback ? 'default' : 'pointer',
                fontSize: '0.9rem',
                background: feedback
                  ? choice === currentQuestion.answer ? '#a5d6a7'
                    : choice === selectedChoice ? '#ffd6c2'
                    : 'white'
                  : 'white',
                borderColor: feedback
                  ? choice === currentQuestion.answer ? '#2a9d8f' : '#e0e0e0'
                  : '#e0f0ee',
                fontWeight: choice === currentQuestion.answer && !!feedback ? 'bold' : 'normal',
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* Saisie */}
      {currentQuestion.type === 'saisie' && (
        <div style={{ marginTop: '1rem' }}>
          <input
            type="text"
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAnswer(userAnswer) }}
            disabled={!!feedback}
            placeholder="Ta réponse..."
            autoFocus
            style={{
              width: '100%', padding: '0.75rem', fontSize: '1.1rem',
              textAlign: 'center', borderRadius: '0.5rem',
              border: '2px solid #e0f0ee', boxSizing: 'border-box' as const,
            }}
          />
          <button
            onClick={() => handleAnswer(userAnswer)}
            disabled={!!feedback || !userAnswer.trim()}
            style={{
              width: '100%', marginTop: '0.5rem', padding: '0.75rem',
              background: feedback || !userAnswer.trim() ? '#ccc' : '#2a9d8f',
              color: 'white', border: 'none', borderRadius: '0.5rem',
              fontWeight: 'bold', cursor: feedback || !userAnswer.trim() ? 'default' : 'pointer',
              fontSize: '1rem',
            }}
          >
            Valider
          </button>
        </div>
      )}

      {/* Progression */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '1.5rem', justifyContent: 'center' }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: i < results.length
              ? results[i] ? '#2a9d8f' : '#e63946'
              : i === currentIndex ? '#e9c46a' : '#e0e0e0',
          }} />
        ))}
      </div>
    </div>
  )
}
