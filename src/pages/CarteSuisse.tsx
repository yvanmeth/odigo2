import { useState, useEffect, useRef } from 'react'
import { logActivity } from '../services/activity'
import ExerciseBilan from '../components/ExerciseBilan'

const CANTONS = [
  { id: 'CHAG', name: 'Argovie', capital: 'Aarau' },
  { id: 'CHAR', name: 'Appenzell Rhodes-Extérieures', capital: 'Herisau' },
  { id: 'CHAI', name: 'Appenzell Rhodes-Intérieures', capital: 'Appenzell' },
  { id: 'CHBE', name: 'Berne', capital: 'Berne' },
  { id: 'CHBL', name: 'Bâle-Campagne', capital: 'Liestal' },
  { id: 'CHBS', name: 'Bâle-Ville', capital: 'Bâle' },
  { id: 'CHFR', name: 'Fribourg', capital: 'Fribourg' },
  { id: 'CHGE', name: 'Genève', capital: 'Genève' },
  { id: 'CHGL', name: 'Glaris', capital: 'Glaris' },
  { id: 'CHGR', name: 'Grisons', capital: 'Coire' },
  { id: 'CHJU', name: 'Jura', capital: 'Delémont' },
  { id: 'CHLU', name: 'Lucerne', capital: 'Lucerne' },
  { id: 'CHNE', name: 'Neuchâtel', capital: 'Neuchâtel' },
  { id: 'CHNW', name: 'Nidwald', capital: 'Stans' },
  { id: 'CHOW', name: 'Obwald', capital: 'Sarnen' },
  { id: 'CHSG', name: 'Saint-Gall', capital: 'Saint-Gall' },
  { id: 'CHSH', name: 'Schaffhouse', capital: 'Schaffhouse' },
  { id: 'CHSO', name: 'Soleure', capital: 'Soleure' },
  { id: 'CHSZ', name: 'Schwytz', capital: 'Schwytz' },
  { id: 'CHTI', name: 'Tessin', capital: 'Bellinzone' },
  { id: 'CHTG', name: 'Thurgovie', capital: 'Frauenfeld' },
  { id: 'CHUR', name: 'Uri', capital: 'Altdorf' },
  { id: 'CHVD', name: 'Vaud', capital: 'Lausanne' },
  { id: 'CHVS', name: 'Valais', capital: 'Sion' },
  { id: 'CHZG', name: 'Zoug', capital: 'Zoug' },
  { id: 'CHZH', name: 'Zurich', capital: 'Zurich' },
]

const TOTAL_QUESTIONS = 10

type GameState = 'select' | 'playing' | 'result'
type Difficulty = 'facile' | 'moyen' | 'difficile'
type QuestionType = 'nom' | 'capitale'
type FeedbackType = 'correct' | 'incorrect' | null

const DIFFICULTY_INFO: Record<Difficulty, { icon: string; label: string; desc: string }> = {
  facile: { icon: '🎒', label: 'Apprenti', desc: 'On te demande le nom du canton.' },
  moyen: { icon: '🧭', label: 'Aventurier', desc: 'On te demande le chef-lieu du canton.' },
  difficile: { icon: '🏆', label: 'Légende', desc: 'Nom ou chef-lieu, mélangés au hasard — et sans indice sur les cantons déjà traités !' },
}

const buildQuestionTypes = (n: number, difficulty: Difficulty): QuestionType[] => {
  if (difficulty === 'facile') return Array(n).fill('nom')
  if (difficulty === 'moyen') return Array(n).fill('capitale')
  return Array.from({ length: n }, () => (Math.random() < 0.5 ? 'nom' : 'capitale'))
}

interface CarteSuisseProps {
  onBack?: () => void
}

export default function CarteSuisse({ onBack }: CarteSuisseProps) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [difficulty, setDifficulty] = useState<Difficulty>('facile')

  const [questions, setQuestions] = useState<typeof CANTONS>([])
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackType>(null)
  const [correctId, setCorrectId] = useState('')
  const [clickedId, setClickedId] = useState('')
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState<string[]>([])
  const [resultats, setResultats] = useState<{ canton: string; cantonCapital: string; questionType: QuestionType; correct: boolean; clickedCantonName: string }[]>([])

  const [svgContent, setSvgContent] = useState('')
  const svgRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<FeedbackType>(null)
  useEffect(() => { feedbackRef.current = feedback }, [feedback])

  useEffect(() => {
    fetch('/ch.svg')
      .then(r => r.text())
      .then(setSvgContent)
  }, [])

  const currentCanton = questions[currentIndex]
  const currentQuestionType = questionTypes[currentIndex]

  const questionText = currentCanton
    ? currentQuestionType === 'nom'
      ? `Clique sur le canton de ${currentCanton.name}`
      : `Clique sur le canton dont le chef-lieu est ${currentCanton.capital}`
    : ''

  const getCantonFill = (cantonId: string): string => {
    if (feedback && cantonId === correctId) return '#a5d6a7'
    if (feedback === 'incorrect' && cantonId === clickedId) return '#ffd6c2'
    if (difficulty !== 'difficile' && answered.includes(cantonId)) return '#e0f0ee'
    return '#d4d4d4'
  }

  const initGame = () => {
    const shuffled = [...CANTONS].sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS)
    setQuestions(shuffled)
    setQuestionTypes(buildQuestionTypes(shuffled.length, difficulty))
    setCurrentIndex(0)
    setScore(0)
    setAnswered([])
    setResultats([])
    setFeedback(null)
    setCorrectId('')
    setClickedId('')
    setGameState('playing')
  }

  const finishGame = async (finalScore: number) => {
    setGameState('result')
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: TOTAL_QUESTIONS,
      questions_correct: finalScore,
      metadata: { exercise: 'cartesuisse', difficulty },
    })
  }

  // Attacher les event listeners sur les cantons SVG
  useEffect(() => {
    if (!svgRef.current || !svgContent || gameState !== 'playing') return
    const canton = questions[currentIndex]
    const questionType = questionTypes[currentIndex]
    if (!canton) return

    const handleClick = (e: Event) => {
      if (feedbackRef.current) return
      const target = e.target as Element
      const id = target.getAttribute('id')
      if (!id || !id.startsWith('CH')) return

      const isCorrect = id === canton.id
      const clickedCantonName = CANTONS.find(c => c.id === id)?.name ?? id
      setClickedId(id)
      setCorrectId(canton.id)
      setFeedback(isCorrect ? 'correct' : 'incorrect')

      const finalScore = isCorrect ? score + 1 : score
      if (isCorrect) {
        setScore(s => s + 1)
        setAnswered(prev => [...prev, id])
      } else {
        setAnswered(prev => [...prev, canton.id])
      }
      setResultats(prev => [...prev, {
        canton: canton.name,
        cantonCapital: canton.capital,
        questionType,
        correct: isCorrect,
        clickedCantonName,
      }])

      const nextIdx = currentIndex + 1
      setTimeout(() => {
        setFeedback(null)
        setClickedId('')
        setCorrectId('')
        if (nextIdx >= questions.length) {
          finishGame(finalScore)
        } else {
          setCurrentIndex(nextIdx)
        }
      }, 1500)
    }

    const elements = svgRef.current.querySelectorAll<HTMLElement>('[id^="CH"]')
    elements.forEach(el => {
      el.style.cursor = 'pointer'
      el.style.transition = 'fill 0.2s'
      el.addEventListener('click', handleClick)
      el.addEventListener('mouseenter', () => {
        if (!feedbackRef.current) el.style.fill = '#b0b0b0'
      })
      el.addEventListener('mouseleave', () => {
        const elId = el.getAttribute('id')
        if (elId) el.style.fill = getCantonFill(elId)
      })
    })

    return () => {
      elements.forEach(el => el.removeEventListener('click', handleClick))
    }
  }, [svgContent, currentIndex, questions, questionTypes, feedback, answered, gameState, score, difficulty])

  // Mettre à jour les couleurs après chaque changement d'état
  useEffect(() => {
    if (!svgRef.current) return
    const elements = svgRef.current.querySelectorAll<HTMLElement>('[id^="CH"]')
    elements.forEach(el => {
      const id = el.getAttribute('id')
      if (id) el.style.fill = getCantonFill(id)
    })
  }, [feedback, answered, currentIndex, difficulty])

  // ─── SÉLECTION ───
  if (gameState === 'select') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', padding: '1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🗺️</div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '0.25rem' }}>Carte de la Suisse</h2>
        <p style={{ color: '#666', marginBottom: '2rem' }}>Clique sur le bon canton !</p>

        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.75rem' }}>Difficulté</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {(['facile', 'moyen', 'difficile'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer',
                  border: `2px solid ${difficulty === d ? '#2a9d8f' : '#e0e0e0'}`,
                  background: difficulty === d ? '#2a9d8f' : 'white',
                  color: difficulty === d ? 'white' : '#555',
                  fontWeight: difficulty === d ? 'bold' : 'normal', fontSize: '0.9rem',
                }}
              >
                {DIFFICULTY_INFO[d].icon} {DIFFICULTY_INFO[d].label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#888' }}>
            {DIFFICULTY_INFO[difficulty].desc}
          </div>
        </div>

        <button
          onClick={initGame}
          style={{ padding: '0.85rem 2.5rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.75rem', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', width: '100%' }}
        >
          Commencer 🗺️
        </button>
        {onBack && (
          <button onClick={onBack} style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}>
            ← Retour
          </button>
        )}
      </div>
    )
  }

  // ─── RÉSULTAT ───
  if (gameState === 'result') {
    return (
      <div>
        <ExerciseBilan
          exercise="carte-suisse"
          errors={TOTAL_QUESTIONS - score}
          difficulty={difficulty}
          hasRevisionBonus={false}
          onDone={() => setGameState('select')}
        />
        <div style={{ maxWidth: '560px', margin: '0 auto', marginTop: '1.5rem', paddingBottom: '2rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
            {resultats.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', gap: '0.75rem' }}>
                <span style={{ width: '3.5rem', flexShrink: 0, textAlign: 'center', color: '#aaa', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.85rem' }}>
                  <span style={{ color: '#555' }}>
                    <strong>
                      {r.questionType === 'nom' ? r.canton : `${r.cantonCapital} (${r.canton})`}
                    </strong>
                  </span>
                  <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
                    {r.correct ? '✓ Trouvé' : `✗ Raté (Tu as cliqué sur ${r.clickedCantonName})`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── JEU ───
  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0.5rem' }}>
      {/* Progression */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ color: '#888', fontSize: '0.9rem' }}>Question {currentIndex + 1} / {questions.length}</span>
        <span style={{ color: '#e9c46a', fontWeight: 'bold' }}>{score} ✓</span>
      </div>
      <div style={{ height: '5px', background: '#e0e0e0', borderRadius: '3px', marginBottom: '1rem' }}>
        <div style={{
          height: '100%',
          width: `${((currentIndex + 1) / questions.length) * 100}%`,
          background: '#2a9d8f', borderRadius: '3px', transition: 'width 0.3s',
        }} />
      </div>

      {/* Question */}
      <div style={{
        fontSize: '1.3rem', fontWeight: 'bold', textAlign: 'center',
        padding: '1rem', background: '#f0faf8', borderRadius: '0.75rem',
        marginBottom: '1rem', color: '#333', lineHeight: '1.4',
      }}>
        {questionText}
      </div>

      {/* SVG carte */}
      <div
        ref={svgRef}
        className="ch-map"
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'block', overflow: 'hidden' }}
      />

      {/* Feedback */}
      {feedback && (
        <div style={{
          marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.5rem',
          textAlign: 'center', fontWeight: 'bold', fontSize: '1rem',
          background: feedback === 'correct' ? '#e8f5e9' : '#fff3e0',
          color: feedback === 'correct' ? '#2e7d32' : '#e65100',
        }}>
          {feedback === 'correct'
            ? '✓ Bravo !'
            : `✗ C'était ${currentCanton?.name} !`}
        </div>
      )}
    </div>
  )
}
