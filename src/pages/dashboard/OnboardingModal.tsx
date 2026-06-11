import { useState } from 'react'
import { OdigoAvatar } from '../../components/OdigoAvatar'

interface OnboardingModalProps {
  onComplete: () => void
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1)

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '480px', width: '90%', background: 'white', borderRadius: '1.5rem', padding: '2.5rem', boxSizing: 'border-box' }}>

        {onboardingStep === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem' }}><OdigoAvatar size={64} /></div>
            <h2 style={{ color: '#333', margin: '0 0 0.75rem', fontSize: '1.4rem' }}>Bienvenue sur ODIGO !</h2>
            <p style={{ color: '#555', lineHeight: '1.7', margin: 0 }}>
              Je m'appelle Odigo, ton compagnon d'apprentissage.
              Je suis là pour t'aider à t'organiser, réviser et progresser. Prêt·e à commencer ?
            </p>
          </div>
        )}

        {onboardingStep === 2 && (
          <div>
            <h2 style={{ color: '#333', margin: '0 0 1.25rem', fontSize: '1.4rem' }}>Ce que tu peux faire ici</h2>
            {([
              ['📅', 'Planifier tes évaluations et révisions'],
              ['🎯', "T'entraîner avec des exercices interactifs"],
              ['🏆', 'Gagner des Digoos et des récompenses'],
            ] as const).map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                <span style={{ color: '#555', fontSize: '1rem' }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {onboardingStep === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚀</div>
            <h2 style={{ color: '#333', margin: '0 0 0.75rem', fontSize: '1.4rem' }}>C'est parti !</h2>
            <p style={{ color: '#555', lineHeight: '1.7', margin: '0 0 1.5rem' }}>
              Commence par ajouter une évaluation dans le Planificateur, ou lance-toi directement dans un exercice.
              Je suis là si tu as des questions !
            </p>
            <button
              onClick={onComplete}
              style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Commencer →
            </button>
          </div>
        )}

        {/* Points indicateurs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '1.5rem 0 0' }}>
          {([1, 2, 3] as const).map(n => (
            <div key={n} style={{ width: '8px', height: '8px', borderRadius: '50%', background: onboardingStep === n ? '#2a9d8f' : '#e0f0ee', transition: 'background 0.2s' }} />
          ))}
        </div>

        {/* Navigation Précédent / Suivant */}
        {onboardingStep < 3 && (
          <div style={{ display: 'flex', justifyContent: onboardingStep === 1 ? 'flex-end' : 'space-between', marginTop: '1.25rem' }}>
            {onboardingStep > 1 && (
              <button
                onClick={() => setOnboardingStep(s => (s - 1) as 1 | 2 | 3)}
                style={{ padding: '0.6rem 1.25rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ← Précédent
              </button>
            )}
            <button
              onClick={() => setOnboardingStep(s => (s + 1) as 1 | 2 | 3)}
              style={{ padding: '0.6rem 1.25rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Suivant →
            </button>
          </div>
        )}
        {onboardingStep === 3 && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1.25rem' }}>
            <button
              onClick={() => setOnboardingStep(2)}
              style={{ padding: '0.6rem 1.25rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ← Précédent
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
