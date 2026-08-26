import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import HighscoreModal from '../components/HighscoreModal'

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

const SERIES_OPTIONS = [10, 15, 26]

type GameState = 'select' | 'playing' | 'result'
type Difficulty = 'facile' | 'difficile'
type FeedbackType = 'correct' | 'incorrect' | null

interface CarteSuisseProps {
  onBack?: () => void
}

export default function CarteSuisse({ onBack }: CarteSuisseProps) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [difficulty, setDifficulty] = useState<Difficulty>('facile')
  const [seriesLength, setSeriesLength] = useState(10)

  const [questions, setQuestions] = useState<typeof CANTONS>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackType>(null)
  const [correctId, setCorrectId] = useState('')
  const [clickedId, setClickedId] = useState('')
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState<string[]>([])
  const [showHighscoreModal, setShowHighscoreModal] = useState(false)

  const [svgContent, setSvgContent] = useState('')
  const svgRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<FeedbackType>(null)
  feedbackRef.current = feedback

  useEffect(() => {
    fetch('/ch.svg')
      .then(r => r.text())
      .then(setSvgContent)
  }, [])

  const currentCanton = questions[currentIndex]

  const questionText = currentCanton
    ? difficulty === 'facile'
      ? `Clique sur le canton de ${currentCanton.name}`
      : `Clique sur le canton dont le chef-lieu est ${currentCanton.capital}`
    : ''

  const getCantonFill = (cantonId: string): string => {
    if (feedback && cantonId === correctId) return '#a5d6a7'
    if (feedback === 'incorrect' && cantonId === clickedId) return '#ffd6c2'
    if (answered.includes(cantonId)) return '#e0f0ee'
    return '#d4d4d4'
  }

  const initGame = () => {
    const shuffled = [...CANTONS].sort(() => Math.random() - 0.5)
    setQuestions(shuffled.slice(0, seriesLength))
    setCurrentIndex(0)
    setScore(0)
    setAnswered([])
    setFeedback(null)
    setCorrectId('')
    setClickedId('')
    setShowHighscoreModal(false)
    setGameState('playing')
  }

  // Attacher les event listeners sur les cantons SVG
  useEffect(() => {
    if (!svgRef.current || !svgContent || gameState !== 'playing') return
    const canton = questions[currentIndex]
    if (!canton) return

    const handleClick = (e: Event) => {
      if (feedbackRef.current) return
      const target = e.target as Element
      const id = target.getAttribute('id')
      if (!id || !id.startsWith('CH')) return

      const isCorrect = id === canton.id
      setClickedId(id)
      setCorrectId(canton.id)
      setFeedback(isCorrect ? 'correct' : 'incorrect')

      if (isCorrect) {
        setScore(s => s + 1)
        setAnswered(prev => [...prev, id])
      } else {
        setAnswered(prev => [...prev, canton.id])
      }

      const nextIdx = currentIndex + 1
      setTimeout(() => {
        setFeedback(null)
        setClickedId('')
        setCorrectId('')
        if (nextIdx >= questions.length) {
          setGameState('result')
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
  }, [svgContent, currentIndex, feedback, answered, gameState])

  // Mettre à jour les couleurs après chaque changement d'état
  useEffect(() => {
    if (!svgRef.current) return
    const elements = svgRef.current.querySelectorAll<HTMLElement>('[id^="CH"]')
    elements.forEach(el => {
      const id = el.getAttribute('id')
      if (id) el.style.fill = getCantonFill(id)
    })
  }, [feedback, answered, currentIndex])

  const checkAndShowHighscore = async (finalScore: number) => {
    if (localStorage.getItem('odigo_highscores') === 'off') return
    const { data } = await supabase
      .from('highscores')
      .select('score')
      .eq('exercise', 'carte-suisse')
      .is('list_id', null)
      .order('score', { ascending: false })
      .limit(5)
    const isTop = !data || data.length < 5 || finalScore > (data[data.length - 1]?.score || 0)
    if (isTop) setShowHighscoreModal(true)
  }

  useEffect(() => {
    if (gameState === 'result') {
      checkAndShowHighscore(score)
    }
  }, [gameState])

  // ─── SÉLECTION ───
  if (gameState === 'select') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', padding: '1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🗺️</div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '0.25rem' }}>Carte de la Suisse</h2>
        <p style={{ color: '#666', marginBottom: '2rem' }}>Clique sur le bon canton !</p>

        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem', textAlign: 'left' }}>
          <div style={{ fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.75rem' }}>Difficulté</div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {(['facile', 'difficile'] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer',
                  border: `2px solid ${difficulty === d ? '#2a9d8f' : '#e0e0e0'}`,
                  background: difficulty === d ? '#2a9d8f' : 'white',
                  color: difficulty === d ? 'white' : '#555',
                  fontWeight: difficulty === d ? 'bold' : 'normal', fontSize: '0.95rem',
                }}
              >
                {d === 'facile' ? '😊 Facile' : '💪 Difficile'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
            {difficulty === 'facile' ? 'On te demande le nom du canton.' : 'On te demande le chef-lieu du canton.'}
          </div>

          <div style={{ fontWeight: 'bold', color: '#2a9d8f', margin: '1.25rem 0 0.75rem' }}>Nombre de questions</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {SERIES_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setSeriesLength(n)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer',
                  border: `2px solid ${seriesLength === n ? '#2a9d8f' : '#e0e0e0'}`,
                  background: seriesLength === n ? '#2a9d8f' : 'white',
                  color: seriesLength === n ? 'white' : '#555',
                  fontWeight: seriesLength === n ? 'bold' : 'normal', fontSize: '1rem',
                }}
              >
                {n}
              </button>
            ))}
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
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', padding: '1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🗺️</div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>Résultat !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#e9c46a', marginBottom: '0.25rem' }}>
          {score} / {questions.length}
        </div>
        <div style={{ color: '#666', marginBottom: '2rem' }}>cantons trouvés</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '260px', margin: '0 auto' }}>
          <button
            onClick={initGame}
            style={{ padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
          >
            🔄 Rejouer
          </button>
          <button
            onClick={() => setGameState('select')}
            style={{ padding: '0.75rem', background: 'var(--color-border)', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Changer les options
          </button>
          {onBack && (
            <button onClick={onBack} style={{ padding: '0.75rem', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}>
              Quitter
            </button>
          )}
        </div>

        {showHighscoreModal && (
          <HighscoreModal
            exercise="carte-suisse"
            listId="carte-suisse"
            listName="Carte de la Suisse"
            score={score}
            onClose={() => setShowHighscoreModal(false)}
            onDisable={() => { localStorage.setItem('odigo_highscores', 'off'); setShowHighscoreModal(false) }}
            onReplay={initGame}
            onQuit={() => { setShowHighscoreModal(false); onBack?.() }}
          />
        )}
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
          width: `${(currentIndex / questions.length) * 100}%`,
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
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{ width: '100%', maxWidth: '600px', margin: '0 auto', display: 'block' }}
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
