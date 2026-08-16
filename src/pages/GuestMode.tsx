import { useState } from 'react'
import { GUEST_MAX_FREE, GUEST_MAX_TOTAL, GUEST_LIST_IDS, GUEST_CATEGORIES } from '../config/guestConfig'
import { exerciseCards } from './dashboard/types'
import QCM from './qcm'
import WordDrop from './worddrop'
import Anagramme from './Anagramme'
import ConjugaisonEtrangere from './ConjugaisonEtrangere'
import Maths from './Maths'
import Vocabulaire from './vocabulaire'

interface GuestModeProps {
  onExit: () => void
}

export default function GuestMode({ onExit }: GuestModeProps) {
  const [partiesPlayed, setPartiesPlayed] = useState(
    parseInt(localStorage.getItem('odigo_guest_parties') || '0')
  )
  const [activeExercise, setActiveExercise] = useState<string | null>(null)
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [hardLimit, setHardLimit] = useState(false)

  const handleExerciseClick = (exerciseId: string, language: string | null) => {
    if (partiesPlayed >= GUEST_MAX_TOTAL) {
      setHardLimit(true)
      setShowLimitModal(true)
      return
    }
    setActiveExercise(exerciseId)
    setActiveLanguage(language)
  }

  const handleGameEnd = () => {
    const newCount = partiesPlayed + 1
    setPartiesPlayed(newCount)
    localStorage.setItem('odigo_guest_parties', String(newCount))
    setActiveExercise(null)
    setActiveLanguage(null)
    if (newCount >= GUEST_MAX_FREE && newCount < GUEST_MAX_TOTAL) {
      setHardLimit(false)
      setShowLimitModal(true)
    } else if (newCount >= GUEST_MAX_TOTAL) {
      setHardLimit(true)
      setShowLimitModal(true)
    }
  }

  const renderExercise = () => {
    const lang = activeLanguage ?? 'Anglais'
    const vocabListId = GUEST_LIST_IDS[lang]
    const conjugListId = GUEST_LIST_IDS[`${lang}-conjugaison`]
    const francaisListId = GUEST_LIST_IDS['Français-dictée']
    switch (activeExercise) {
      case 'qcm':
        return <QCM guestMode guestListId={vocabListId} guestLanguage={lang} onGameEnd={handleGameEnd} />
      case 'worddrop':
        return <WordDrop guestMode guestListId={vocabListId} guestLanguage={lang} onGameEnd={handleGameEnd} />
      case 'anagramme':
        return <Anagramme guestMode guestListId={vocabListId} guestLanguage={lang} onGameEnd={handleGameEnd} />
      case 'conjugaison-etrangere':
        return <ConjugaisonEtrangere guestMode guestListId={conjugListId} guestLanguage={lang} onGameEnd={handleGameEnd} />
      case 'maths-calcul':
        return <Maths initialExercise="calcul" guestMode onGameEnd={handleGameEnd} />
      case 'vocabulaire':
        return <Vocabulaire guestMode guestListId={francaisListId} onGameEnd={handleGameEnd} />
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
            onClick={() => { setActiveExercise(null); setActiveLanguage(null) }}
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
        <h2 style={{ textAlign: 'center', color: '#333', marginBottom: '0.75rem', fontSize: '1.4rem' }}>
          🎯 Essaie les exercices !
        </h2>
        <p style={{
          fontSize: '0.9rem', color: '#666',
          textAlign: 'center', maxWidth: '500px',
          margin: '0 auto 2rem', lineHeight: 1.6,
        }}>
          Le mode invité utilise des listes de mots prédéfinies.
          En créant ton compte, tu pourras créer tes propres listes pour t'entraîner
          sur le vocabulaire de ton choix et utiliser les points gagnés pour obtenir des récompenses !
        </p>

        {GUEST_CATEGORIES.map(category => {
          const cards = exerciseCards.filter(ex => ex.category === category.exerciseCategory)
          return (
            <div key={category.id} style={{ marginBottom: '2rem' }}>
              <h3 style={{
                fontSize: '1rem', fontWeight: 'bold',
                color: 'var(--color-primary)',
                marginBottom: '0.75rem',
                paddingBottom: '0.4rem',
                borderBottom: '2px solid var(--color-border)',
              }}>
                {category.label}
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '0.75rem',
              }}>
                {cards.map(ex => {
                  const accessible = category.unlockedExercises.includes(ex.id)
                  return (
                    <div
                      key={`${category.id}-${ex.id}`}
                      onClick={() => accessible ? handleExerciseClick(ex.id, category.language) : undefined}
                      style={{
                        background: 'white',
                        borderRadius: '1rem',
                        padding: '1rem',
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
                          background: 'rgba(0,0,0,0.5)', color: 'white',
                          borderRadius: '0.5rem', padding: '0.2rem 0.5rem',
                          fontSize: '0.75rem',
                        }}>
                          🔒 Compte requis
                        </div>
                      )}
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{ex.icon}</div>
                      <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.88rem', marginBottom: '0.2rem' }}>
                        {ex.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888', lineHeight: 1.4 }}>{ex.description}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* CTA section */}
        <div style={{
          marginTop: '1rem', textAlign: 'center',
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
                  onClick={onExit}
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
                  onClick={onExit}
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
