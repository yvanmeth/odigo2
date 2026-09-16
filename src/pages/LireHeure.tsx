import { useState } from 'react'
import AnalogClock from '../components/AnalogClock'

export type Language  = 'fr' | 'en' | 'de' | 'el'
export type Level     = 'pile' | 'quart' | 'libre'
export type ClockMode = 'mots' | 'aiguilles' | 'mixte'
type GameState        = 'select' | 'playing' | 'result'

const TOTAL_QUESTIONS = 5  // sera paramétrable à l'étape suivante

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

const MODE_LABEL: Record<ClockMode, string> = {
  mots:      'Cliquer les mots',
  aiguilles: 'Placer les aiguilles',
  mixte:     'Mixte',
}

interface Props {
  onBack?: () => void
}

export default function LireHeure({ onBack }: Props) {
  // ── Sélections — valeurs par défaut opérationnelles dès l'ouverture ──────
  const [lang,  setLang]  = useState<Language>('fr')
  const [level, setLevel] = useState<Level>('quart')
  const [mode,  setMode]  = useState<ClockMode>('mixte')

  const [gameState,     setGameState]     = useState<GameState>('select')
  const [questionIndex, setQuestionIndex] = useState(0)

  const startGame = () => {
    setQuestionIndex(0)
    setGameState('playing')
  }

  const handleSuivant = () => {
    if (questionIndex + 1 < TOTAL_QUESTIONS) {
      setQuestionIndex(q => q + 1)
    } else {
      setGameState('result')
    }
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
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

  // ── SÉLECTION ────────────────────────────────────────────────────────────
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

        {/* Groupe 1 — Langue */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Langue</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {LANGUAGES.map(l => (
              <button key={l.id} onClick={() => setLang(l.id)} style={btnStyle(lang === l.id)}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Groupe 2 — Niveau */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Niveau</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {LEVELS.map(l => (
              <button key={l.id} onClick={() => setLevel(l.id)} style={btnStyle(level === l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Groupe 3 — Mode */}
        <div style={{ marginBottom: '2.25rem' }}>
          <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.6rem', fontWeight: '600' }}>Mode</p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={btnStyle(mode === m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bouton toujours actif grâce aux valeurs par défaut */}
        <button
          onClick={startGame}
          style={{
            width: '100%', padding: '0.9rem',
            background: '#2a9d8f', color: 'white',
            border: 'none', borderRadius: '0.75rem',
            cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold',
          }}
        >
          🚀 Commencer
        </button>
      </div>
    )
  }

  // ── JEU (squelette) ──────────────────────────────────────────────────────
  if (gameState === 'playing') {
    const progress = (questionIndex / TOTAL_QUESTIONS) * 100

    return (
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.9rem', color: '#888' }}>
          <span>Question {questionIndex + 1} / {TOTAL_QUESTIONS}</span>
        </div>

        {/* Barre de progression */}
        <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '8px', marginBottom: '2rem' }}>
          <div style={{ background: '#2a9d8f', borderRadius: '1rem', height: '8px', width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>

        {/* Horloge — heure de test statique (logique réelle à l'étape suivante) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <AnalogClock hour={10} minute={10} size={200} />
        </div>

        {/* Placeholder réponse */}
        <div style={{ textAlign: 'center', color: '#aaa', fontSize: '0.85rem', marginBottom: '2rem', fontStyle: 'italic' }}>
          Mode : {MODE_LABEL[mode]} / mot à afficher ici
        </div>

        <button
          onClick={handleSuivant}
          style={{
            width: '100%', padding: '0.9rem',
            background: '#2a9d8f', color: 'white',
            border: 'none', borderRadius: '0.75rem',
            cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold',
          }}
        >
          Suivant →
        </button>
      </div>
    )
  }

  // ── RÉSULTAT (squelette) ─────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingTop: '2rem' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🕐</div>
      <h2 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>Terminé !</h2>
      <p style={{ color: '#aaa', fontSize: '0.88rem', marginBottom: '2rem' }}>
        (squelette — logique de score à venir)
      </p>
      <button
        onClick={() => setGameState('select')}
        style={{
          padding: '0.75rem 2.5rem',
          background: '#2a9d8f', color: 'white',
          border: 'none', borderRadius: '0.75rem',
          cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold',
        }}
      >
        Rejouer
      </button>
    </div>
  )
}
