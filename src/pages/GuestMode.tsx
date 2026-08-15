import { useState } from 'react'
import { GUEST_EXERCISES, GUEST_MAX_FREE, GUEST_MAX_TOTAL, GUEST_LIST_IDS } from '../config/guestConfig'
import { exerciseCards } from './dashboard/types'
import QCM from './qcm'
import WordDrop from './worddrop'
import Anagramme from './Anagramme'
import ConjugaisonEtrangere from './ConjugaisonEtrangere'
import Maths from './Maths'

interface GuestModeProps {
  onExit: () => void
}

const VOCAB_LANGUAGES = ['Anglais', 'Allemand', 'Grec', 'Arabe']

export default function GuestMode({ onExit }: GuestModeProps) {
  const [partiesPlayed, setPartiesPlayed] = useState(
    parseInt(localStorage.getItem('odigo_guest_parties') || '0')
  )
  const [activeExercise, setActiveExercise] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [hardLimit, setHardLimit] = useState(false)
  const [guestLanguage, setGuestLanguage] = useState('Anglais')

  const handleExerciseClick = (exerciseId: string) => {
    if (partiesPlayed >= GUEST_MAX_TOTAL) {
      setHardLimit(true)
      setShowLimitModal(true)
      return
    }
    setActiveExercise(exerciseId)
  }

  const handleGameEnd = () => {
    const newCount = partiesPlayed + 1
    setPartiesPlayed(newCount)
    localStorage.setItem('odigo_guest_parties', String(newCount))
    setActiveExercise(null)
    if (newCount >= GUEST_MAX_FREE && newCount < GUEST_MAX_TOTAL) {
      setHardLimit(false)
      setShowLimitModal(true)
    } else if (newCount >= GUEST_MAX_TOTAL) {
      setHardLimit(true)
      setShowLimitModal(true)
    }
  }

  const renderExercise = () => {
    const listId = GUEST_LIST_IDS[guestLanguage]
    const guestProps = { guestMode: true as const, guestListId: listId, guestLanguage, onGameEnd: handleGameEnd }
    switch (activeExercise) {
      case 'qcm': return <QCM {...guestProps} />
      case 'worddrop': return <WordDrop {...guestProps} />
      case 'anagramme': return <Anagramme {...guestProps} />
      case 'conjugaison-etrangere': return <ConjugaisonEtrangere {...guestProps} />
      case 'maths-calcul': return <Maths initialExercise="calcul" guestMode onGameEnd={handleGameEnd} />
      default: return null
    }
  }

  if (activeExercise) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1rem 1.5rem',
          background: 'white', borderBottom: '1px solid var(--color-border)',
        }}>
          <button
            onClick={() => setActiveExercise(null)}
            style={{ background: 'var(--color-border)', border: 'none', color: '#555', borderRadius: '0.5rem', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ← Retour
          </button>
          <img src="/logo-full.svg" alt="ODIGO" style={{ height: '28px' }} />
          <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: 'auto' }}>
            Mode découverte · {GUEST_MAX_TOTAL - partiesPlayed} parties restantes
          </span>
        </div>
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem 1rem' }}>
          {renderExercise()}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem',
        background: 'white', borderBottom: '1px solid var(--color-border)',
      }}>
        <img src="/logo-full.svg" alt="ODIGO" style={{ height: '32px' }} />
        <span style={{ fontSize: '0.85rem', color: '#888' }}>
          Mode découverte — {GUEST_MAX_TOTAL - partiesPlayed} partie{GUEST_MAX_TOTAL - partiesPlayed !== 1 ? 's' : ''} restante{GUEST_MAX_TOTAL - partiesPlayed !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onExit}
          style={{
            background: '#2a9d8f', border: 'none', color: 'white',
            borderRadius: '0.5rem', padding: '0.5rem 1rem',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
          }}
        >
          Créer un compte
        </button>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Language selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.9rem', color: '#555', fontWeight: 'bold' }}>Langue :</span>
          {VOCAB_LANGUAGES.map(lang => (
            <button
              key={lang}
              onClick={() => setGuestLanguage(lang)}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '1rem',
                border: '1.5px solid #2a9d8f',
                background: guestLanguage === lang ? '#2a9d8f' : 'white',
                color: guestLanguage === lang ? 'white' : '#2a9d8f',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
              }}
            >
              {lang}
            </button>
          ))}
        </div>

        {/* Exercise grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {exerciseCards.map(ex => {
            const accessible = GUEST_EXERCISES.includes(ex.id)
            return (
              <div
                key={ex.id}
                onClick={() => accessible ? handleExerciseClick(ex.id) : undefined}
                style={{
                  background: 'white',
                  borderRadius: '1rem',
                  padding: '1.25rem',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  borderTop: `4px solid ${accessible ? ex.color : '#ccc'}`,
                  cursor: accessible ? 'pointer' : 'not-allowed',
                  opacity: accessible ? 1 : 0.4,
                  position: 'relative',
                  transition: accessible ? 'transform 0.15s, box-shadow 0.15s' : 'none',
                  userSelect: 'none',
                }}
                onMouseEnter={e => {
                  if (accessible) {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
                }}
              >
                {!accessible && (
                  <div style={{
                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                    fontSize: '0.65rem', background: '#888', color: 'white',
                    borderRadius: '0.5rem', padding: '0.15rem 0.4rem',
                  }}>
                    🔒 Compte requis
                  </div>
                )}
                <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>{ex.icon}</div>
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
                  {ex.label}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888', lineHeight: 1.4 }}>{ex.description}</div>
              </div>
            )
          })}
        </div>

        {/* CTA section */}
        <div style={{
          marginTop: '2rem', textAlign: 'center',
          padding: '1.5rem', background: 'white',
          borderRadius: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Crée un compte gratuit pour débloquer tous les exercices, sauvegarder ta progression et gagner des <strong>Δ</strong> !
          </p>
          <button
            onClick={onExit}
            style={{
              background: '#2a9d8f', border: 'none', color: 'white',
              borderRadius: '0.75rem', padding: '0.75rem 2rem',
              cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem',
            }}
          >
            Créer un compte gratuit
          </button>
        </div>
      </div>

      {/* Invitation modal */}
      {showLimitModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{
            background: 'white', borderRadius: '1rem',
            padding: '2rem', maxWidth: '400px', width: '100%', textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            {hardLimit ? (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎓</div>
                <h3 style={{ color: '#333', marginBottom: '0.75rem', fontSize: '1.3rem' }}>Tu as exploré ODIGO !</h3>
                <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  Tu as utilisé toutes tes parties découverte. Crée un compte gratuit pour continuer à apprendre !
                </p>
                <button
                  onClick={() => { window.location.href = '/' }}
                  style={{
                    width: '100%', padding: '0.85rem',
                    background: '#2a9d8f', color: 'white', border: 'none',
                    borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem',
                  }}
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⭐</div>
                <h3 style={{ color: '#333', marginBottom: '0.75rem', fontSize: '1.3rem' }}>
                  Tu as découvert {partiesPlayed} exercice{partiesPlayed > 1 ? 's' : ''} !
                </h3>
                <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  Crée un compte gratuit pour débloquer tout ODIGO, sauvegarder ta progression et gagner des Δ !
                </p>
                <button
                  onClick={() => { window.location.href = '/' }}
                  style={{
                    width: '100%', padding: '0.85rem', marginBottom: '0.75rem',
                    background: '#2a9d8f', color: 'white', border: 'none',
                    borderRadius: '0.75rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem',
                  }}
                >
                  Créer un compte
                </button>
                <button
                  onClick={() => setShowLimitModal(false)}
                  style={{
                    width: '100%', padding: '0.75rem',
                    background: 'none', color: '#888', border: '1px solid #ddd',
                    borderRadius: '0.75rem', cursor: 'pointer', fontSize: '0.9rem',
                  }}
                >
                  Continuer à explorer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
