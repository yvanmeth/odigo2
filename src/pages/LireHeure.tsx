import { useState, useEffect, useRef } from 'react'
import AnalogClock from '../components/AnalogClock'
import {
  formatTimeFR, formatTimeEN, formatTimeDE, formatTimeEL,
  type TimeExpression,
} from '../lib/timeFormatting'
import { logActivity } from '../services/activity'
import ExerciseBilan from '../components/ExerciseBilan'
import type { Difficulty } from '../lib/exerciseBilan'

// ── Types exportés (réutilisables aux étapes suivantes) ────────────────────
export type Language  = 'fr' | 'en' | 'de' | 'el'
export type Level     = 'pile' | 'quart' | 'libre'
export type ClockMode = 'mots' | 'aiguilles' | 'mixte'
type GameState        = 'select' | 'playing' | 'result'
type QuestionMode     = 'mots' | 'aiguilles'

const mapLevelToDifficulty = (l: Level): Difficulty => {
  if (l === 'pile') return 'facile'
  if (l === 'quart') return 'moyen'
  return 'difficile'
}

// ── Configuration ──────────────────────────────────────────────────────────
const TOTAL_QUESTIONS    = 10
const DISTRACTOR_COUNT   = 3
const DISTRACTOR_SAMPLES = 40

const FORMATTERS: Record<Language, (h: number, m: number) => TimeExpression> = {
  fr: formatTimeFR, en: formatTimeEN, de: formatTimeDE, el: formatTimeEL,
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
  availableWords: string[]
}

// ── Récapitulatif ──────────────────────────────────────────────────────────
interface RecapEntry {
  hour: number
  minute: number
  expressionText: string
  questionMode: QuestionMode
  correct: boolean
  donneTexte: string
}

// ── Utilitaires ────────────────────────────────────────────────────────────
function randomHour():                 number { return Math.floor(Math.random() * 12) + 1 }
function randomMinute(l: Level):       number {
  if (l === 'pile')  return 0
  if (l === 'quart') return [0, 15, 30, 45][Math.floor(Math.random() * 4)]
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
function generateDistractors(expression: TimeExpression, lang: Language, level: Level): string[] {
  const fmt        = FORMATTERS[lang]
  const correctSet = new Set(expression.words)
  const candidates = new Set<string>()
  for (let i = 0; i < DISTRACTOR_SAMPLES; i++) {
    fmt(randomHour(), randomMinute(level)).words.forEach(w => { if (!correctSet.has(w)) candidates.add(w) })
    if (candidates.size >= DISTRACTOR_COUNT * 4) break
  }
  return shuffle(Array.from(candidates)).slice(0, DISTRACTOR_COUNT)
}
function buildQuestion(lang: Language, level: Level, mode: ClockMode): Question {
  const hour         = randomHour()
  const minute       = randomMinute(level)
  const expression   = FORMATTERS[lang](hour, minute)
  const questionMode = pickQuestionMode(mode)
  const distractors  = generateDistractors(expression, lang, level)
  return { hour, minute, expression, questionMode, availableWords: shuffle([...expression.words, ...distractors]) }
}

// ── Props ──────────────────────────────────────────────────────────────────
interface Props { onBack?: () => void }

export default function LireHeure({ onBack }: Props) {
  // ── Sélections ────────────────────────────────────────────────────────
  const [lang,  setLang]  = useState<Language>('fr')
  const [level, setLevel] = useState<Level>('quart')
  const [mode,  setMode]  = useState<ClockMode>('mixte')

  // ── État partie ────────────────────────────────────────────────────────
  const [gameState,    setGameState]    = useState<GameState>('select')
  const [questions,    setQuestions]    = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [feedback,     setFeedback]     = useState<'correct' | 'incorrect' | null>(null)
  const [score,        setScore]        = useState(0)
  const [resultats,    setResultats]    = useState<RecapEntry[]>([])

  // ── État mode mots ─────────────────────────────────────────────────────
  const [available, setAvailable] = useState<string[]>([])
  const [selected,  setSelected]  = useState<string[]>([])

  // ── État mode aiguilles — persiste entre questions ─────────────────────
  // 0-719 : 0 = 12h00, 60 = 1h00, ..., 719 = 11h59
  const [clockMinutes, setClockMinutes] = useState(0)
  // Compteur non-borné pour les angles CSS cumulatifs — évite le bug 359°→0° :
  // cumulSteps * 6 et cumulSteps * 0.5 croissent/décroissent monotonement,
  // le CSS interpole donc toujours dans le bon sens, sans grand tour inversé.
  const [cumulSteps, setCumulSteps] = useState(0)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Valeurs dérivées pour AnalogClock (hour: 1-12, minute: 0-59)
  const clockHourIdx     = Math.floor(clockMinutes / 60)       // 0-11
  const clockDisplayHour = clockHourIdx === 0 ? 12 : clockHourIdx
  const clockDisplayMin  = clockMinutes % 60

  // Cleanup timer sur démontage
  useEffect(() => {
    return () => { if (pressTimerRef.current !== null) clearTimeout(pressTimerRef.current) }
  }, [])

  // ── Pression maintenue sur les boutons de navigation ──────────────────
  const stopPress = () => {
    if (pressTimerRef.current !== null) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null }
  }

  const startPress = (delta: number) => {
    stopPress()
    setClockMinutes(prev => ((prev + delta) % 720 + 720) % 720)
    setCumulSteps(prev => prev + delta)
    // Compteur de répétitions capturé en closure — évite Date.now() (rule: react-hooks/purity)
    let steps = 0
    const repeat = () => {
      steps += 1
      // 250ms (4/s) → 100ms (10/s) sur ~5 répétitions ≈ 1 seconde de maintien
      const interval = Math.max(100, Math.round(250 - 150 * Math.min(steps / 5, 1)))
      setClockMinutes(prev => ((prev + delta) % 720 + 720) % 720)
      setCumulSteps(prev => prev + delta)
      pressTimerRef.current = setTimeout(repeat, interval)
    }
    pressTimerRef.current = setTimeout(repeat, 300)
  }

  // ── Actions ────────────────────────────────────────────────────────────
  const startGame = () => {
    const qs = Array.from({ length: TOTAL_QUESTIONS }, () => buildQuestion(lang, level, mode))
    setQuestions(qs)
    setCurrentIndex(0)
    setScore(0)
    setResultats([])
    setClockMinutes(0)
    setCumulSteps(0)
    setAvailable([...qs[0].availableWords])
    setSelected([])
    setFeedback(null)
    setGameState('playing')
  }

  const finaliser = async () => {
    setGameState('result')
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: TOTAL_QUESTIONS,
      questions_correct: score,
      metadata: { exercise: 'lire-heure', language: lang, level, mode },
    })
  }

  const handleSuivant = () => {
    const nextIdx = currentIndex + 1
    if (nextIdx < questions.length) {
      setCurrentIndex(nextIdx)
      setAvailable([...questions[nextIdx].availableWords])
      setSelected([])
      setFeedback(null)
    } else {
      finaliser()
    }
  }

  // Mode mots — clic sur un mot disponible
  const clickAvailable = (word: string, idx: number) => {
    if (feedback) return
    setAvailable(prev => { const a = [...prev]; a.splice(idx, 1); return a })
    setSelected(prev => [...prev, word])
  }
  // Mode mots — retrait d'un mot de la zone réponse
  const clickSelected = (word: string, idx: number) => {
    if (feedback) return
    setSelected(prev => { const a = [...prev]; a.splice(idx, 1); return a })
    setAvailable(prev => [...prev, word])
  }
  // Mode mots — validation
  const validateMots = () => {
    if (feedback || selected.length === 0) return
    const q       = questions[currentIndex]
    const correct = selected.join('|') === q.expression.words.join('|')
    if (correct) setScore(prev => prev + 1)
    setFeedback(correct ? 'correct' : 'incorrect')
    setResultats(prev => [...prev, {
      hour: q.hour,
      minute: q.minute,
      expressionText: q.expression.text,
      questionMode: q.questionMode,
      correct,
      donneTexte: selected.join(' '),
    }])
  }

  // Mode aiguilles — validation avec tolérance ±3 min (cycle 12h)
  const validateHands = () => {
    if (feedback) return
    const q           = questions[currentIndex]
    const targetClock = (q.hour % 12) * 60 + q.minute  // 0-719
    const diff        = Math.abs(clockMinutes - targetClock)
    const wrappedDiff = Math.min(diff, 720 - diff)
    const correct     = wrappedDiff <= 3
    if (correct) setScore(prev => prev + 1)
    setFeedback(correct ? 'correct' : 'incorrect')
    // Capture la position réelle de l'élève AVANT qu'elle ne soit réutilisée pour la question suivante
    // (clockMinutes persiste entre questions, cf. commentaire sur son state).
    const donneTexte = correct ? '' : FORMATTERS[lang](clockDisplayHour, clockDisplayMin).text
    setResultats(prev => [...prev, {
      hour: q.hour,
      minute: q.minute,
      expressionText: q.expression.text,
      questionMode: q.questionMode,
      correct,
      donneTexte,
    }])
  }

  // ── Styles ─────────────────────────────────────────────────────────────
  const btnSelectStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.9rem', border: 'none', borderRadius: '0.5rem',
    cursor: 'pointer', fontWeight: 'bold', fontSize: '0.88rem',
    background: active ? '#2a9d8f' : 'var(--color-border)',
    color: active ? 'white' : '#2a9d8f', transition: 'background 0.15s ease',
  })

  const wordChipStyle = (variant: 'available' | 'selected'): React.CSSProperties => ({
    padding: '0.4rem 0.85rem',
    border: variant === 'selected' ? '2px solid #2a9d8f' : '2px solid #b2d8d4',
    borderRadius: '0.5rem', cursor: feedback ? 'default' : 'pointer',
    fontWeight: '600', fontSize: '0.92rem',
    background: variant === 'selected' ? '#e8f7f5' : 'white',
    color: '#334155', userSelect: 'none' as const,
    opacity: feedback && variant === 'available' ? 0.55 : 1,
    transition: 'opacity 0.2s ease',
  })

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: '56px', height: '56px',
    border: '2px solid #2a9d8f', borderRadius: '0.5rem',
    background: 'white', color: '#2a9d8f',
    fontSize: '1.25rem', fontWeight: 'bold',
    cursor: disabled ? 'default' : 'pointer',
    userSelect: 'none' as const, opacity: disabled ? 0.45 : 1,
    transition: 'opacity 0.15s ease', touchAction: 'none',
  })

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%', padding: '0.9rem', background: '#2a9d8f', color: 'white',
    border: 'none', borderRadius: '0.75rem', cursor: 'pointer',
    fontSize: '1rem', fontWeight: 'bold',
  }

  const feedbackStyle = (ok: boolean): React.CSSProperties => ({
    padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem',
    background: ok ? '#d4edda' : '#f8d7da',
    color:      ok ? '#155724' : '#721c24',
    textAlign: 'center', fontWeight: '600',
  })

  // ── SELECT ─────────────────────────────────────────────────────────────
  if (gameState === 'select') {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {onBack && (
          <button onClick={onBack} style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
            ← Retour
          </button>
        )}
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.75rem' }}>🕐 Dire l'heure</h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Langue</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {LANGUAGES.map(l => <button key={l.id} onClick={() => setLang(l.id)} style={btnSelectStyle(lang === l.id)}>{l.flag} {l.label}</button>)}
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Niveau</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {LEVELS.map(l => <button key={l.id} onClick={() => setLevel(l.id)} style={btnSelectStyle(level === l.id)}>{l.label}</button>)}
          </div>
        </div>

        <div style={{ marginBottom: '2.25rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Mode</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {MODES.map(m => <button key={m.id} onClick={() => setMode(m.id)} style={btnSelectStyle(mode === m.id)}>{m.label}</button>)}
          </div>
        </div>

        <button onClick={startGame} style={primaryBtnStyle}>🚀 Commencer</button>
      </div>
    )
  }

  // ── PLAYING ────────────────────────────────────────────────────────────
  if (gameState === 'playing' && questions.length > 0) {
    const q        = questions[currentIndex]
    const progress = ((currentIndex + 1) / TOTAL_QUESTIONS) * 100
    const isOk     = feedback === 'correct'
    const isLast   = currentIndex + 1 >= TOTAL_QUESTIONS

    // Boutons de navigation aiguilles
    const NAV = [
      { label: '«', delta: -15 },
      { label: '‹', delta: -1  },
      { label: '›', delta:  1  },
      { label: '»', delta:  15 },
    ]

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

        {/* ── Mode mots : lire l'horloge et cliquer les tokens ──────── */}
        {q.questionMode === 'mots' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <AnalogClock hour={q.hour} minute={q.minute} size={190} />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Ta réponse :</p>
              <div style={{ minHeight: '46px', padding: '0.5rem 0.6rem', background: '#f0faf8', borderRadius: '0.5rem', border: '1.5px dashed #b2d8d4', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {selected.length === 0 && (
                  <span style={{ color: '#b2d8d4', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Clique les mots ci-dessous pour composer ta réponse
                  </span>
                )}
                {selected.map((w, i) => <button key={i} onClick={() => clickSelected(w, i)} style={wordChipStyle('selected')}>{w}</button>)}
              </div>
            </div>

            {feedback && (
              <div style={feedbackStyle(isOk)}>
                {isOk ? '✅ Correct !' : `❌ Réponse attendue : « ${q.expression.text} »`}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Mots disponibles :</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {available.map((w, i) => <button key={i} onClick={() => clickAvailable(w, i)} style={wordChipStyle('available')}>{w}</button>)}
              </div>
            </div>

            {!feedback ? (
              <button onClick={validateMots} disabled={selected.length === 0} style={{ ...primaryBtnStyle, background: selected.length === 0 ? '#b2d8d4' : '#2a9d8f', cursor: selected.length === 0 ? 'default' : 'pointer' }}>
                Valider
              </button>
            ) : (
              <button onClick={handleSuivant} style={primaryBtnStyle}>
                {isLast ? 'Voir le résultat' : 'Suivant →'}
              </button>
            )}
          </>
        )}

        {/* ── Mode aiguilles : lire l'énoncé, positionner les aiguilles ── */}
        {q.questionMode === 'aiguilles' && (
          <>
            {/* Énoncé à représenter */}
            <div style={{ textAlign: 'center', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#f0faf8', borderRadius: '0.75rem', border: '1.5px solid #b2d8d4' }}>
              <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.2rem' }}>Représente cette heure :</p>
              <p style={{ color: '#2a9d8f', fontWeight: 'bold', fontSize: '1.15rem', margin: 0 }}>
                « {q.expression.text} »
              </p>
            </div>

            {/* Horloge contrôlée par l'élève */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AnalogClock
                hour={clockDisplayHour}
                minute={clockDisplayMin}
                size={190}
                minuteAngle={cumulSteps * 6}
                hourAngle={cumulSteps * 0.5}
                transitionMs={100}
              />
            </div>

            {/* Boutons de navigation */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {NAV.map(({ label, delta }) => (
                <button
                  key={delta}
                  disabled={!!feedback}
                  style={navBtnStyle(!!feedback)}
                  onMouseDown={() => startPress(delta)}
                  onMouseUp={stopPress}
                  onMouseLeave={stopPress}
                  onTouchStart={e => { e.preventDefault(); startPress(delta) }}
                  onTouchEnd={stopPress}
                >
                  {label}
                </button>
              ))}
            </div>

            {feedback && (
              <div style={feedbackStyle(isOk)}>
                {isOk ? '✅ Correct !' : `❌ Réponse attendue : « ${q.expression.text} »`}
              </div>
            )}

            {!feedback ? (
              <button onClick={validateHands} style={primaryBtnStyle}>Valider</button>
            ) : (
              <button onClick={handleSuivant} style={primaryBtnStyle}>
                {isLast ? 'Voir le résultat' : 'Suivant →'}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // ── RÉSULTAT ──────────────────────────────────────────────────────────
  return (
    <div>
      <ExerciseBilan
        exercise="lire-heure"
        errors={TOTAL_QUESTIONS - score}
        difficulty={mapLevelToDifficulty(level)}
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
                  {r.expressionText}
                  {mode === 'mixte' && (
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#aaa' }}>
                      ({r.questionMode === 'mots' ? 'mots' : 'aiguilles'})
                    </span>
                  )}
                </span>
                <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
                  {r.correct ? `✓ ${r.expressionText}` : `✗ ${r.donneTexte} → ${r.expressionText}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
