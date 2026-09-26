import { useState, useEffect, useRef } from 'react'
import { logActivity } from '../services/activity'
import ExerciseBilan from '../components/ExerciseBilan'
import type { RecapItem } from '../lib/exerciseBilan'

type MathExercise = 'calcul' | 'multiplication' | 'division' | 'equation'
type Difficulty = 'facile' | 'moyen' | 'difficile'
type GameState = 'menu' | 'select' | 'playing' | 'result'

interface Question {
  text: string
  answer: number
}

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const generateCalcul = (diff: Difficulty): Question => {
  const ranges = { facile: 20, moyen: 100, difficile: 1000 }
  const max = ranges[diff]
  const a = randomInt(1, max)
  const b = randomInt(1, max)
  const op = Math.random() < 0.5 ? '+' : '-'
  if (op === '+') {
    return { text: `${a} + ${b}`, answer: a + b }
  }
  const big = Math.max(a, b)
  const small = Math.min(a, b)
  return { text: `${big} - ${small}`, answer: big - small }
}

const MULT_TABLES: Record<Difficulty, number[]> = {
  facile: [1, 2, 3, 4, 5, 6, 10],
  moyen: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  difficile: [4, 5, 6, 7, 8, 9, 11, 12],
}

const pickFrom = (arr: number[]) => arr[randomInt(0, arr.length - 1)]

const generateMultiplication = (diff: Difficulty): Question => {
  const tables = MULT_TABLES[diff]
  const a = pickFrom(tables)
  const b = pickFrom(tables)
  return { text: `${a} × ${b}`, answer: a * b }
}

const generateMultiplicationBatch = (diff: Difficulty, count: number): Question[] => {
  const tables = MULT_TABLES[diff]
  const qs: Question[] = []
  let prevKey = ''
  for (let i = 0; i < count; i++) {
    let a = pickFrom(tables)
    let b = pickFrom(tables)
    let attempts = 0
    while (`${Math.min(a, b)}x${Math.max(a, b)}` === prevKey && attempts < 20) {
      a = pickFrom(tables)
      b = pickFrom(tables)
      attempts++
    }
    prevKey = `${Math.min(a, b)}x${Math.max(a, b)}`
    qs.push({ text: `${a} × ${b}`, answer: a * b })
  }
  return qs
}

const generateDivision = (diff: Difficulty): Question => {
  if (diff === 'difficile') {
    const divisor = randomInt(2, 12)
    const dividend = randomInt(divisor * 2, 200)
    return {
      text: `${dividend} ÷ ${divisor} (donne le quotient entier)`,
      answer: Math.floor(dividend / divisor),
    }
  }
  const max = diff === 'facile' ? 50 : 100
  const divisor = randomInt(2, 10)
  const quotient = randomInt(1, Math.floor(max / divisor))
  const dividend = divisor * quotient
  return { text: `${dividend} ÷ ${divisor}`, answer: quotient }
}

const generateEquation = (diff: Difficulty): Question => {
  if (diff === 'facile') {
    const x = randomInt(1, 20)
    const a = randomInt(1, 20)
    const b = x + a
    return { text: `x + ${a} = ${b}`, answer: x }
  }
  if (diff === 'moyen') {
    const x = randomInt(1, 20)
    const a = randomInt(2, 5)
    const b = randomInt(1, 50)
    const c = a * x + b
    return { text: `${a}x + ${b} = ${c}`, answer: x }
  }
  const x = randomInt(1, 20)
  const a = randomInt(3, 8)
  const c = randomInt(1, a - 1)
  const b = randomInt(1, 30)
  const d = (a - c) * x + b
  return { text: `${a}x + ${b} = ${c}x + ${d}`, answer: x }
}

const GENERATORS: Record<MathExercise, (d: Difficulty) => Question> = {
  calcul: generateCalcul,
  multiplication: generateMultiplication,
  division: generateDivision,
  equation: generateEquation,
}

const EXERCISE_INFO: Record<MathExercise, { label: string; icon: string; color: string; description: string }> = {
  calcul: { label: 'Calcul mental', icon: '🧮', color: '#2a9d8f', description: 'Additions et soustractions' },
  multiplication: { label: 'Multiplications', icon: '✖️', color: '#e76f51', description: 'Les tables de multiplication' },
  division: { label: 'Divisions', icon: '➗', color: '#5c6bc0', description: 'Divisions simples et avec reste' },
  equation: { label: 'Équations', icon: '🔢', color: '#e9c46a', description: 'Trouve la valeur de x' },
}

const DIFFICULTIES: { id: Difficulty; label: string; icon: string }[] = [
  { id: 'facile', label: 'Facile', icon: '😊' },
  { id: 'moyen', label: 'Moyen', icon: '🤔' },
  { id: 'difficile', label: 'Difficile', icon: '💪' },
]

interface MathsProps {
  initialExercise?: MathExercise
  onBack?: () => void
  guestMode?: boolean
  onGameEnd?: () => void
}

export default function Maths({ initialExercise, onBack, guestMode, onGameEnd }: MathsProps) {
  const [gameState, setGameState] = useState<GameState>(initialExercise ? 'select' : 'menu')
  const [selectedExercise, setSelectedExercise] = useState<MathExercise | null>(initialExercise ?? null)
  const [difficulty, setDifficulty] = useState<Difficulty>('moyen')

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [results, setResults] = useState<boolean[]>([])
  const [resultats, setResultats] = useState<{
    question: string; userAnswer: string; correctAnswer: string; correct: boolean
  }[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const startGame = () => {
    if (!selectedExercise) return
    const qs = selectedExercise === 'multiplication'
      ? generateMultiplicationBatch(difficulty, 10)
      : Array.from({ length: 10 }, () => GENERATORS[selectedExercise](difficulty))
    setQuestions(qs)
    setCurrentIndex(0)
    setUserAnswer('')
    setResults([])
    setResultats([])
    setFeedback(null)
    setGameState('playing')
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (guestMode && initialExercise) startGame() }, [])

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [currentIndex, gameState])

  const finaliser = async (finalResults: boolean[]) => {
    if (guestMode) {
      onGameEnd?.()
      return
    }
    const totalCorrect = finalResults.filter(Boolean).length
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: 10,
      questions_correct: totalCorrect,
      metadata: { exercise: 'maths', subExercise: selectedExercise, difficulty },
    })
    setGameState('result')
  }

  const checkAnswer = () => {
    if (feedback || !userAnswer) return
    const correct = parseInt(userAnswer) === questions[currentIndex].answer
    const newResults = [...results, correct]

    setFeedback(correct ? 'correct' : 'incorrect')
    setResults(newResults)
    setResultats(prev => [...prev, {
      question: questions[currentIndex].text,
      userAnswer,
      correctAnswer: String(questions[currentIndex].answer),
      correct,
    }])

    setTimeout(() => {
      setFeedback(null)
      setUserAnswer('')
      if (currentIndex + 1 < 10) {
        setCurrentIndex(prev => prev + 1)
      } else {
        finaliser(newResults)
      }
    }, 1200)
  }

  const btnStyle = (active: boolean, color = '#2a9d8f'): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    background: active ? color : 'var(--color-border)',
    color: active ? 'white' : color === '#2a9d8f' ? '#2a9d8f' : '#555',
  })

  // ── MENU ──────────────────────────────────────────────────────────────
  if (gameState === 'menu') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>🔢 Maths</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {(Object.keys(EXERCISE_INFO) as MathExercise[]).map(id => {
            const info = EXERCISE_INFO[id]
            return (
              <div
                key={id}
                onClick={() => { setSelectedExercise(id); setGameState('select') }}
                style={{
                  background: 'white',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                  borderTop: `4px solid ${info.color}`,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{info.icon}</div>
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem', marginBottom: '0.25rem' }}>
                  {info.label}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>{info.description}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── SÉLECTION ─────────────────────────────────────────────────────────
  if (gameState === 'select' && selectedExercise && !guestMode) {
    const info = EXERCISE_INFO[selectedExercise]
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <button
          onClick={() => onBack ? onBack() : setGameState('menu')}
          style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          ← Retour
        </button>

        <h2 style={{ color: info.color, marginBottom: '1.5rem' }}>
          {info.icon} {info.label}
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Choisis la difficulté :</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                style={btnStyle(difficulty === d.id, info.color)}
              >
                {d.icon} {d.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          style={{
            width: '100%', padding: '0.9rem',
            background: info.color, color: 'white',
            border: 'none', borderRadius: '0.75rem',
            cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold',
          }}
        >
          🚀 Commencer (10 questions)
        </button>
      </div>
    )
  }

  // ── JEU ───────────────────────────────────────────────────────────────
  if (gameState === 'playing' && questions.length > 0) {
    const question = questions[currentIndex]
    const progress = ((currentIndex + 1) / 10) * 100

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.9rem', color: '#888' }}>
          <span>Question {currentIndex + 1} / 10</span>
        </div>

        {/* Barre de progression */}
        <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '8px', marginBottom: '1.5rem' }}>
          <div style={{ background: '#2a9d8f', borderRadius: '1rem', height: '8px', width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>

        {/* Question */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333', marginBottom: '0.5rem' }}>
            {question.text}
          </div>
          {selectedExercise === 'equation' && (
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Quelle est la valeur de x ?</div>
          )}
        </div>

        {/* Feedback temporaire */}
        {feedback && (
          <div style={{
            textAlign: 'center',
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            marginBottom: '1rem',
            fontWeight: 'bold',
            fontSize: '1rem',
            background: feedback === 'correct' ? '#a5d6a7' : '#ffd6c2',
            color: feedback === 'correct' ? '#2e7d32' : '#bf360c',
          }}>
            {feedback === 'correct'
              ? '✓ Bravo !'
              : `✗ La réponse était ${question.answer}`}
          </div>
        )}

        {/* Input */}
        <input
          type="number"
          value={userAnswer}
          onChange={e => setUserAnswer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !feedback && userAnswer && checkAnswer()}
          ref={inputRef}
          disabled={!!feedback}
          placeholder="Ta réponse..."
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontSize: '1.5rem',
            textAlign: 'center',
            borderRadius: '0.75rem',
            border: '2px solid var(--color-border)',
            outline: 'none',
            marginBottom: '1rem',
            boxSizing: 'border-box',
            opacity: feedback ? 0.5 : 1,
          }}
        />

        <button
          onClick={checkAnswer}
          disabled={!userAnswer || !!feedback}
          style={{
            width: '100%', padding: '0.8rem',
            background: !userAnswer || !!feedback ? '#ddd' : '#2a9d8f',
            color: !userAnswer || !!feedback ? '#aaa' : 'white',
            border: 'none', borderRadius: '0.75rem',
            cursor: !userAnswer || !!feedback ? 'default' : 'pointer',
            fontSize: '1rem', fontWeight: 'bold',
          }}
        >
          Valider
        </button>
      </div>
    )
  }

  // ── BILAN ─────────────────────────────────────────────────────────────
  if (gameState === 'result') {
    const errors = 10 - results.filter(Boolean).length
    const recapItems: RecapItem[] = resultats.map(r => ({
      label: r.question,
      correct: r.correct,
      detail: r.correct ? undefined : `ta réponse : ${r.userAnswer} → ${r.correctAnswer}`,
    }))
    return (
      <ExerciseBilan
        exercise="maths"
        errors={errors}
        difficulty={difficulty}
        hasRevisionBonus={false}
        subLabel={selectedExercise ? EXERCISE_INFO[selectedExercise].label : undefined}
        recapItems={recapItems}
        onDone={() => setGameState('select')}
      >
        <div style={{ maxWidth: '560px', margin: '0 auto', marginTop: '1rem', paddingBottom: '2rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem' }}>
            <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
            {resultats.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', gap: '0.75rem' }}>
                <span style={{ width: '3.5rem', flexShrink: 0, textAlign: 'center', color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, fontSize: '0.85rem' }}>
                  <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
                    {r.correct
                      ? `✓ ${r.question} = ${r.correctAnswer}`
                      : `✗ ${r.question} — ta réponse : ${r.userAnswer} → ${r.correctAnswer}`
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ExerciseBilan>
    )
  }

  return null
}
