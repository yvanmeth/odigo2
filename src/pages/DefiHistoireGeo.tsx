import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import HighscoreModal from '../components/HighscoreModal'

const THEMES = [
  { id: 'moyen-age', label: 'Au Moyen Âge', category: 'Histoire', theme: 'Au Moyen Âge' },
  { id: 'xv-xvi', label: 'Aux XVe et XVIe siècles', category: 'Histoire', theme: 'Aux XVe et XVIe siècles' },
  { id: 'xvii-xviii', label: 'Aux XVIIe et XVIIIe siècles', category: 'Histoire', theme: 'Aux XVIIe et XVIIIe siècles' },
  { id: 'xix', label: 'Au XIXe siècle', category: 'Histoire', theme: 'Au XIXe siècle' },
  { id: 'xx', label: 'Au XXe siècle', category: 'Histoire', theme: 'Au XXe siècle' },
  { id: 'mythes', label: 'Mythes et réalité', category: 'Histoire', theme: 'Mythes et réalité' },
  { id: 'geo-suisse', label: 'Repères géographiques de la Suisse', category: 'Géographie', theme: 'Repères géographiques de la Suisse' },
  { id: 'habitat', label: 'Habitat', category: 'Géographie', theme: 'Habitat' },
  { id: 'loisirs', label: 'Loisirs', category: 'Géographie', theme: 'Loisirs' },
  { id: 'appro', label: 'Approvisionnement', category: 'Géographie', theme: 'Approvisionnement' },
  { id: 'echanges', label: 'Échanges', category: 'Géographie', theme: 'Échanges' },
  { id: 'mix', label: '🎲 Mix Histoire & Géo', category: null, theme: null },
] as const

type Theme = typeof THEMES[number]

const SERIES_OPTIONS = [5, 10, 15]

type GameState = 'select' | 'playing' | 'result'

interface DefiHGQuestion {
  id: string
  question: string
  type: 'qcm' | 'saisie'
  category: string
  theme: string
  choices: string[] | null
  answer: string
}

interface Props {
  userId: string
  onBack?: () => void
}

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function DefiHistoireGeo({ onBack }: Props) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
  const [seriesLength, setSeriesLength] = useState(10)

  const [questions, setQuestions] = useState<DefiHGQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [shuffledChoices, setShuffledChoices] = useState<string[]>([])
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [exerciseId, setExerciseId] = useState('')
  const [showHighscoreModal, setShowHighscoreModal] = useState(false)
  const [noQuestions, setNoQuestions] = useState(false)

  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const resultsRef = useRef<boolean[]>([])
  const currentIndexRef = useRef(0)
  const feedbackRef = useRef<'correct' | 'incorrect' | null>(null)
  const questionsRef = useRef<DefiHGQuestion[]>([])

  // Mélanger les choix à chaque nouvelle question
  useEffect(() => {
    const q = questions[currentIndex]
    if (q?.choices) setShuffledChoices(shuffleArray([...q.choices]))
    else setShuffledChoices([])
  }, [currentIndex, questions])

  const resetRefs = () => {
    scoreRef.current = 0
    streakRef.current = 0
    resultsRef.current = []
    currentIndexRef.current = 0
    feedbackRef.current = null
  }

  const fetchQuestions = async () => {
    if (!selectedTheme) return
    setNoQuestions(false)

    let query = supabase.from('defi_questions').select('*').eq('active', true)

    if (selectedTheme.category && selectedTheme.theme) {
      query = query.eq('category', selectedTheme.category).eq('theme', selectedTheme.theme)
    } else {
      query = query.in('category', ['Histoire', 'Géographie']).not('theme', 'is', null)
    }

    const { data } = await query
    if (!data || data.length === 0) {
      setNoQuestions(true)
      return
    }

    const shuffled = [...data].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, seriesLength) as DefiHGQuestion[]
    questionsRef.current = picked

    resetRefs()
    setQuestions(picked)
    setCurrentIndex(0)
    setScore(0)
    setStreak(0)
    setResults([])
    setFeedback(null)
    setUserAnswer('')
    setSelectedChoice(null)
    setTotalCorrect(0)
    setShowHighscoreModal(false)

    const eid = `histoire-geo-${selectedTheme.id}`
    setExerciseId(eid)
    setGameState('playing')
  }

  const handleAnswer = (answer: string) => {
    if (feedbackRef.current) return

    const question = questionsRef.current[currentIndexRef.current]
    const isCorrect = answer.trim().toLowerCase() === question.answer.trim().toLowerCase()
    const newResults = [...resultsRef.current, isCorrect]
    resultsRef.current = newResults
    setResults(newResults)

    if (isCorrect) {
      const newStreak = streakRef.current + 1
      const bonus = newStreak >= 3 ? 1 : 0
      scoreRef.current += 1 + bonus
      streakRef.current = newStreak
      setScore(scoreRef.current)
      setStreak(newStreak)
    } else {
      streakRef.current = 0
      setStreak(0)
    }

    feedbackRef.current = isCorrect ? 'correct' : 'incorrect'
    setFeedback(isCorrect ? 'correct' : 'incorrect')

    setTimeout(() => nextQuestion(currentIndexRef.current, newResults), 1500)
  }

  const nextQuestion = (fromIndex: number, currentResults: boolean[]) => {
    if (fromIndex + 1 >= questionsRef.current.length) {
      finaliser(currentResults)
    } else {
      const nextIdx = fromIndex + 1
      currentIndexRef.current = nextIdx
      setCurrentIndex(nextIdx)
      feedbackRef.current = null
      setFeedback(null)
      setUserAnswer('')
      setSelectedChoice(null)
    }
  }

  const finaliser = async (finalResults: boolean[]) => {
    const correct = finalResults.filter(Boolean).length
    setTotalCorrect(correct)
    setGameState('result')
    await checkAndShowHighscore(exerciseId || `histoire-geo-${selectedTheme?.id}`, correct)
  }

  const checkAndShowHighscore = async (eid: string, finalScore: number) => {
    if (localStorage.getItem('odigo_highscores') === 'off') return
    const { data } = await supabase
      .from('highscores')
      .select('score')
      .eq('exercise', eid)
      .is('list_id', null)
      .order('score', { ascending: false })
      .limit(5)
    const isTop = !data || data.length < 5 || finalScore > (data[data.length - 1]?.score || 0)
    if (isTop) setShowHighscoreModal(true)
  }

  const handleReplay = () => {
    setShowHighscoreModal(false)
    fetchQuestions()
  }

  const handleChangeTheme = () => {
    setShowHighscoreModal(false)
    setGameState('select')
  }

  const histoireThemes = THEMES.filter(t => t.category === 'Histoire')
  const geoThemes = THEMES.filter(t => t.category === 'Géographie')
  const mixTheme = THEMES.find(t => t.id === 'mix')!

  const themeBtnStyle = (t: Theme): React.CSSProperties => ({
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    border: `2px solid ${selectedTheme?.id === t.id ? '#2a9d8f' : '#e0f0ee'}`,
    background: selectedTheme?.id === t.id ? '#2a9d8f' : 'white',
    color: selectedTheme?.id === t.id ? 'white' : '#333',
    fontWeight: selectedTheme?.id === t.id ? 'bold' : 'normal',
    fontSize: '0.88rem',
    textAlign: 'left' as const,
    transition: 'all 0.15s',
  })

  // ─── SÉLECTION ───
  if (gameState === 'select') {
    return (
      <div style={{ maxWidth: '540px', margin: '0 auto', padding: '0.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>📚</div>
          <h2 style={{ color: '#5c6bc0', margin: '0 0 0.25rem' }}>Histoire & Géographie</h2>
          <p style={{ color: '#888', margin: 0 }}>Teste tes connaissances !</p>
        </div>

        {/* Thèmes */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
          <div style={{ fontWeight: 'bold', color: '#5c6bc0', marginBottom: '1rem' }}>Choisis un thème</div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              📜 Histoire
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {histoireThemes.map(t => (
                <button key={t.id} style={themeBtnStyle(t)} onClick={() => setSelectedTheme(t)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              🌍 Géographie
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {geoThemes.map(t => (
                <button key={t.id} style={themeBtnStyle(t)} onClick={() => setSelectedTheme(t)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button style={{ ...themeBtnStyle(mixTheme), width: '100%', textAlign: 'center' as const, marginTop: '0.25rem' }} onClick={() => setSelectedTheme(mixTheme)}>
            {mixTheme.label}
          </button>
        </div>

        {/* Nombre de questions */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 'bold', color: '#5c6bc0', marginBottom: '0.75rem' }}>Nombre de questions</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {SERIES_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setSeriesLength(n)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer',
                  border: `2px solid ${seriesLength === n ? '#5c6bc0' : '#e0e0e0'}`,
                  background: seriesLength === n ? '#5c6bc0' : 'white',
                  color: seriesLength === n ? 'white' : '#555',
                  fontWeight: seriesLength === n ? 'bold' : 'normal', fontSize: '1rem',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {noQuestions && (
          <div style={{ color: '#e63946', fontSize: '0.9rem', textAlign: 'center', marginBottom: '0.75rem' }}>
            Aucune question trouvée pour ce thème. Essaie un autre !
          </div>
        )}

        <button
          onClick={fetchQuestions}
          disabled={!selectedTheme}
          style={{
            width: '100%', padding: '0.85rem', background: selectedTheme ? '#5c6bc0' : '#ccc',
            color: 'white', border: 'none', borderRadius: '0.75rem',
            fontWeight: 'bold', fontSize: '1.1rem',
            cursor: selectedTheme ? 'pointer' : 'default',
          }}
        >
          Commencer 📚
        </button>

        {onBack && (
          <button onClick={onBack} style={{ display: 'block', margin: '0.75rem auto 0', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}>
            ← Retour
          </button>
        )}
      </div>
    )
  }

  // ─── RÉSULTAT ───
  if (gameState === 'result') {
    const eid = exerciseId || `histoire-geo-${selectedTheme?.id}`
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', padding: '1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📚</div>
        <h2 style={{ color: '#5c6bc0', marginBottom: '1rem' }}>Résultat !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#e9c46a', marginBottom: '0.25rem' }}>
          {totalCorrect} / {questionsRef.current.length || seriesLength}
        </div>
        <div style={{ color: '#666', marginBottom: '0.5rem' }}>bonnes réponses</div>
        {selectedTheme && (
          <div style={{ display: 'inline-block', background: '#f0faf8', color: '#5c6bc0', borderRadius: '1rem', padding: '0.2rem 0.75rem', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '2rem' }}>
            {selectedTheme.label}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '280px', margin: '0 auto' }}>
          <button onClick={handleReplay} style={{ padding: '0.75rem', background: '#5c6bc0', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
            🔄 Rejouer (même thème)
          </button>
          <button onClick={handleChangeTheme} style={{ padding: '0.75rem', background: '#f0faf8', color: '#5c6bc0', border: '2px solid #5c6bc0', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>
            📚 Changer de thème
          </button>
          {onBack && (
            <button onClick={onBack} style={{ padding: '0.75rem', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}>
              Quitter
            </button>
          )}
        </div>

        {showHighscoreModal && selectedTheme && (
          <HighscoreModal
            exercise={eid}
            listId={eid}
            listName={`Histoire & Géo — ${selectedTheme.label}`}
            score={totalCorrect}
            onClose={() => setShowHighscoreModal(false)}
            onDisable={() => { localStorage.setItem('odigo_highscores', 'off'); setShowHighscoreModal(false) }}
            onReplay={handleReplay}
            onQuit={() => { setShowHighscoreModal(false); onBack?.() }}
          />
        )}
      </div>
    )
  }

  // ─── JEU ───
  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) {
    return <div style={{ color: '#888', textAlign: 'center', padding: '2rem' }}>Chargement...</div>
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
          <span style={{ color: '#e9c46a', fontWeight: 'bold' }}>{score} pts</span>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ height: '5px', background: '#e0e0e0', borderRadius: '3px', marginBottom: '0.75rem' }}>
        <div style={{
          height: '100%',
          width: `${(currentIndex / questions.length) * 100}%`,
          background: '#5c6bc0', borderRadius: '3px', transition: 'width 0.3s',
        }} />
      </div>

      {/* Badge thème */}
      {selectedTheme && (
        <div style={{ marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#888', background: '#f0f0f8', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
            {currentQuestion.category} · {currentQuestion.theme}
          </span>
        </div>
      )}

      {/* Question */}
      <div style={{
        fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center',
        margin: '1rem 0', color: '#333', lineHeight: '1.4',
        background: '#f0f0f8', borderRadius: '0.75rem', padding: '1rem',
      }}>
        {currentQuestion.question}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem',
          textAlign: 'center', fontWeight: 'bold', fontSize: '0.95rem',
          background: feedback === 'correct' ? '#a5d6a7' : '#ffd6c2',
          color: '#333',
        }}>
          {feedback === 'correct'
            ? <>✓ Bravo !{streak >= 3 && <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>🔥 +1 bonus streak !</span>}</>
            : `✗ Réponse : ${currentQuestion.answer}`}
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
                padding: '0.75rem', borderRadius: '0.5rem', border: '2px solid',
                cursor: feedback ? 'default' : 'pointer', fontSize: '0.9rem',
                background: feedback
                  ? choice === currentQuestion.answer ? '#a5d6a7'
                    : choice === selectedChoice ? '#ffd6c2'
                    : 'white'
                  : 'white',
                borderColor: feedback
                  ? choice === currentQuestion.answer ? '#5c6bc0' : '#e0e0e0'
                  : '#e0f0f8',
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
              border: '2px solid #e0f0f8', boxSizing: 'border-box' as const,
            }}
          />
          <button
            onClick={() => handleAnswer(userAnswer)}
            disabled={!!feedback || !userAnswer.trim()}
            style={{
              width: '100%', marginTop: '0.5rem', padding: '0.75rem',
              background: feedback || !userAnswer.trim() ? '#ccc' : '#5c6bc0',
              color: 'white', border: 'none', borderRadius: '0.5rem',
              fontWeight: 'bold', cursor: feedback || !userAnswer.trim() ? 'default' : 'pointer',
              fontSize: '1rem',
            }}
          >
            Valider
          </button>
        </div>
      )}

      {/* Points de progression */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '1.5rem', justifyContent: 'center' }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: i < results.length
              ? results[i] ? '#5c6bc0' : '#e63946'
              : i === currentIndex ? '#e9c46a' : '#e0e0e0',
          }} />
        ))}
      </div>
    </div>
  )
}
