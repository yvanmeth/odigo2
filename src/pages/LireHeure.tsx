import { useState } from 'react'
import AnalogClock from '../components/AnalogClock'
import {
  formatTimeFR, formatTimeEN, formatTimeDE, formatTimeEL,
  type TimeExpression,
} from '../lib/timeFormatting'

// ── Types exportés (réutilisables aux étapes suivantes) ────────────────────
export type Language  = 'fr' | 'en' | 'de' | 'el'
export type Level     = 'pile' | 'quart' | 'libre'
export type ClockMode = 'mots' | 'aiguilles' | 'mixte'
type GameState        = 'select' | 'playing' | 'result'
type QuestionMode     = 'mots' | 'aiguilles'

// ── Configuration ──────────────────────────────────────────────────────────
const TOTAL_QUESTIONS    = 10
const DISTRACTOR_COUNT   = 3
const DISTRACTOR_SAMPLES = 40  // expressions aléatoires générées pour trouver des mots distracteurs

const FORMATTERS: Record<Language, (h: number, m: number) => TimeExpression> = {
  fr: formatTimeFR,
  en: formatTimeEN,
  de: formatTimeDE,
  el: formatTimeEL,
}

const LANGUAGES: { id: Language; label: string; flag: string }[] = [
  { id: 'fr', label: 'Français',  flag: '🇫🇷' },
  { id: 'en', label: 'Anglais',   flag: '🇬🇧' },
  { id: 'de', label: 'Allemand',  flag: '🇩🇪' },
  { id: 'el', label: 'Grec',      flag: '🇬🇷' },
]

const LEVELS: { id: Level; label: string }[] = [
  { id: 'pile',  label: 'Heures pile'    },
  { id: 'quart', label: 'Quart-demie'    },
  { id: 'libre', label: 'Minutes libres' },
]

const MODES: { id: ClockMode; label: string }[] = [
  { id: 'mots',      label: 'Cliquer les mots'    },
  { id: 'aiguilles', label: 'Placer les aiguilles' },
  { id: 'mixte',     label: 'Mixte'                },
]

// ── Question ───────────────────────────────────────────────────────────────
interface Question {
  hour: number
  minute: number
  expression: TimeExpression
  questionMode: QuestionMode
  availableWords: string[]  // mots corrects + distracteurs, mélangés à la génération
}

// ── Utilitaires de génération ──────────────────────────────────────────────
function randomHour(): number { return Math.floor(Math.random() * 12) + 1 }

function randomMinute(level: Level): number {
  if (level === 'pile')  return 0
  if (level === 'quart') return [0, 15, 30, 45][Math.floor(Math.random() * 4)]
  return Math.floor(Math.random() * 60)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickQuestionMode(mode: ClockMode): QuestionMode {
  if (mode === 'mots')      return 'mots'
  if (mode === 'aiguilles') return 'aiguilles'
  return Math.random() < 0.5 ? 'mots' : 'aiguilles'
}

// Génère DISTRACTOR_COUNT mots tirés d'autres formulations de la même langue/niveau,
// cohérents grammaticalement (ne sont pas présents dans la bonne réponse).
function generateDistractors(expression: TimeExpression, lang: Language, level: Level): string[] {
  const fmt = FORMATTERS[lang]
  const correctSet = new Set(expression.words)
  const candidates = new Set<string>()

  for (let i = 0; i < DISTRACTOR_SAMPLES; i++) {
    const expr = fmt(randomHour(), randomMinute(level))
    for (const w of expr.words) {
      if (!correctSet.has(w)) candidates.add(w)
    }
    if (candidates.size >= DISTRACTOR_COUNT * 4) break
  }

  return shuffle(Array.from(candidates)).slice(0, DISTRACTOR_COUNT)
}

function buildQuestion(lang: Language, level: Level, mode: ClockMode): Question {
  const hour       = randomHour()
  const minute     = randomMinute(level)
  const expression = FORMATTERS[lang](hour, minute)
  const questionMode  = pickQuestionMode(mode)
  const distractors   = generateDistractors(expression, lang, level)
  const availableWords = shuffle([...expression.words, ...distractors])
  return { hour, minute, expression, questionMode, availableWords }
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  onBack?: () => void
}

export default function LireHeure({ onBack }: Props) {
  // ── Sélections — défauts opérationnels dès l'ouverture ────────────────
  const [lang,  setLang]  = useState<Language>('fr')
  const [level, setLevel] = useState<Level>('quart')
  const [mode,  setMode]  = useState<ClockMode>('mixte')

  const [gameState, setGameState] = useState<GameState>('select')

  // ── État partie ────────────────────────────────────────────────────────
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [available,    setAvailable]    = useState<string[]>([])
  const [selected,     setSelected]     = useState<string[]>([])
  const [feedback,     setFeedback]     = useState<'correct' | 'incorrect' | null>(null)
  const [score,        setScore]        = useState(0)

  // ── Actions ────────────────────────────────────────────────────────────
  const startGame = () => {
    const qs = Array.from({ length: TOTAL_QUESTIONS }, () => buildQuestion(lang, level, mode))
    setQuestions(qs)
    setCurrentIndex(0)
    setScore(0)
    setAvailable([...qs[0].availableWords])
    setSelected([])
    setFeedback(null)
    setGameState('playing')
  }

  const clickAvailable = (word: string, idx: number) => {
    if (feedback) return
    setAvailable(prev => { const a = [...prev]; a.splice(idx, 1); return a })
    setSelected(prev => [...prev, word])
  }

  const clickSelected = (word: string, idx: number) => {
    if (feedback) return
    setSelected(prev => { const a = [...prev]; a.splice(idx, 1); return a })
    setAvailable(prev => [...prev, word])
  }

  const validate = () => {
    if (feedback || selected.length === 0) return
    const q       = questions[currentIndex]
    const correct = selected.join('|') === q.expression.words.join('|')
    if (correct) setScore(prev => prev + 1)
    setFeedback(correct ? 'correct' : 'incorrect')
  }

  const handleSuivant = () => {
    const nextIdx = currentIndex + 1
    if (nextIdx < questions.length) {
      setCurrentIndex(nextIdx)
      setAvailable([...questions[nextIdx].availableWords])
      setSelected([])
      setFeedback(null)
    } else {
      setGameState('result')
    }
  }

  // ── Styles partagés ────────────────────────────────────────────────────
  const btnSelectStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.9rem',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.88rem',
    background: active ? '#2a9d8f' : 'var(--color-border)',
    color: active ? 'white' : '#2a9d8f',
    transition: 'background 0.15s ease',
  })

  const wordChipStyle = (variant: 'available' | 'selected'): React.CSSProperties => ({
    padding: '0.4rem 0.85rem',
    border: variant === 'selected' ? '2px solid #2a9d8f' : '2px solid #b2d8d4',
    borderRadius: '0.5rem',
    cursor: feedback ? 'default' : 'pointer',
    fontWeight: '600',
    fontSize: '0.92rem',
    background: variant === 'selected' ? '#e8f7f5' : 'white',
    color: '#334155',
    userSelect: 'none' as const,
    opacity: feedback && variant === 'available' ? 0.55 : 1,
    transition: 'opacity 0.2s ease',
  })

  // ── SELECT ─────────────────────────────────────────────────────────────
  if (gameState === 'select') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Retour
          </button>
        )}
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.75rem' }}>🕐 Lire l'heure</h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Langue</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {LANGUAGES.map(l => (
              <button key={l.id} onClick={() => setLang(l.id)} style={btnSelectStyle(lang === l.id)}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Niveau</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {LEVELS.map(l => (
              <button key={l.id} onClick={() => setLevel(l.id)} style={btnSelectStyle(level === l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '2.25rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Mode</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={btnSelectStyle(mode === m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          style={{ width: '100%', padding: '0.9rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
        >
          🚀 Commencer
        </button>
      </div>
    )
  }

  // ── PLAYING ────────────────────────────────────────────────────────────
  if (gameState === 'playing' && questions.length > 0) {
    const q        = questions[currentIndex]
    const progress = (currentIndex / TOTAL_QUESTIONS) * 100

    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.9rem', color: '#888' }}>
          <span>Question {currentIndex + 1} / {TOTAL_QUESTIONS}</span>
          <span style={{ color: '#2a9d8f', fontWeight: 'bold' }}>Score : {score}</span>
        </div>

        {/* Barre de progression */}
        <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '8px', marginBottom: '1.75rem' }}>
          <div style={{ background: '#2a9d8f', borderRadius: '1rem', height: '8px', width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>

        {/* Horloge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <AnalogClock hour={q.hour} minute={q.minute} size={190} />
        </div>

        {/* ── Mode aiguilles : squelette ─────────────────────────────── */}
        {q.questionMode === 'aiguilles' && (
          <>
            <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.88rem', marginBottom: '2rem', fontStyle: 'italic', padding: '1.5rem', background: '#f8f9fa', borderRadius: '0.75rem' }}>
              Mode aiguilles — à venir (étape 5)
            </div>
            <button
              onClick={handleSuivant}
              style={{ width: '100%', padding: '0.9rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
            >
              {currentIndex + 1 < TOTAL_QUESTIONS ? 'Suivant →' : 'Voir le résultat'}
            </button>
          </>
        )}

        {/* ── Mode cliquer les mots ──────────────────────────────────── */}
        {q.questionMode === 'mots' && (
          <>
            {/* Zone réponse construite */}
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Ta réponse :</p>
              <div style={{ minHeight: '46px', padding: '0.5rem 0.6rem', background: '#f0faf8', borderRadius: '0.5rem', border: '1.5px dashed #b2d8d4', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {selected.length === 0 && (
                  <span style={{ color: '#b2d8d4', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Clique les mots ci-dessous pour composer ta réponse
                  </span>
                )}
                {selected.map((w, i) => (
                  <button key={i} onClick={() => clickSelected(w, i)} style={wordChipStyle('selected')}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <div style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                background: feedback === 'correct' ? '#d4edda' : '#f8d7da',
                color:      feedback === 'correct' ? '#155724' : '#721c24',
                textAlign: 'center',
                fontWeight: '600',
              }}>
                {feedback === 'correct'
                  ? '✅ Correct !'
                  : `❌ Réponse attendue : « ${q.expression.text} »`}
              </div>
            )}

            {/* Zone mots disponibles */}
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Mots disponibles :</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {available.map((w, i) => (
                  <button key={i} onClick={() => clickAvailable(w, i)} style={wordChipStyle('available')}>
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Bouton d'action */}
            {!feedback ? (
              <button
                onClick={validate}
                disabled={selected.length === 0}
                style={{
                  width: '100%', padding: '0.9rem',
                  background: selected.length === 0 ? '#b2d8d4' : '#2a9d8f',
                  color: 'white', border: 'none', borderRadius: '0.75rem',
                  cursor: selected.length === 0 ? 'default' : 'pointer',
                  fontSize: '1rem', fontWeight: 'bold',
                }}
              >
                Valider
              </button>
            ) : (
              <button
                onClick={handleSuivant}
                style={{ width: '100%', padding: '0.9rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                {currentIndex + 1 < TOTAL_QUESTIONS ? 'Suivant →' : 'Voir le résultat'}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // ── RÉSULTAT ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingTop: '2rem' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🕐</div>
      <h2 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>Terminé !</h2>
      <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#334155', marginBottom: '0.5rem' }}>
        Score : {score} / {TOTAL_QUESTIONS}
      </p>
      <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '2rem' }}>
        (récompenses à venir)
      </p>
      <button
        onClick={() => setGameState('select')}
        style={{ padding: '0.75rem 2.5rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
      >
        Rejouer
      </button>
    </div>
  )
}
