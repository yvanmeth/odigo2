import { useState } from 'react'
import { Calendar, List, Target, Trophy } from 'lucide-react'
import { OdigoAvatar } from '../../components/OdigoAvatar'
import { Delta } from '../../components/Delta'

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6

interface OnboardingModalProps {
  onComplete: () => void
}

interface StepContent {
  icon: React.ReactNode
  title: string
  text: React.ReactNode
  details?: React.ReactNode
}

const STEPS: StepContent[] = [
  {
    icon: <img src="/logo-full.svg" style={{ width: 140 }} alt="ODIGO" />,
    title: 'Bienvenue sur ODIGO !',
    text: 'Voici une présentation rapide des fonctions principales pour bien démarrer. Tu peux passer à tout moment en cliquant sur ✕.',
  },
  {
    icon: <Calendar size={48} color="#2a9d8f" />,
    title: '📅 Le Planificateur',
    text: <>Note tes évaluations, planifie tes révisions et ajoute des rappels importants. C'est ton agenda scolaire — et chaque action te rapporte des <Delta size={14} /> !</>,
    details: <>Le Planificateur propose une vue liste et une vue calendrier (jour, semaine, mois). Ajouter une évaluation rapporte 2 <Delta size={12} />, cocher une révision comme faite rapporte 2 <Delta size={12} />, et ajouter un événement ou un rappel rapporte 1 <Delta size={12} />.</>,
  },
  {
    icon: <List size={48} color="#5c6bc0" />,
    title: '📋 Listes de mots',
    text: "Crée des listes de vocabulaire, conjugaison ou dictée pour tes cours. Elles sont ensuite utilisées dans les exercices pour t'entraîner efficacement.",
    details: "Tu peux créer tes listes manuellement, les importer depuis Excel/CSV, ou depuis une photo de ton cahier grâce à l'IA. Des listes de démarrage sont déjà disponibles sur ton compte !",
  },
  {
    icon: <Target size={48} color="#e76f51" />,
    title: '🎯 Les Exercices',
    text: <>QCM, épellation, flashcards, conjugaison, puzzle de phrases... Plusieurs façons de mémoriser et de progresser. Chaque exercice terminé rapporte des <Delta size={14} /> !</>,
    details: "Les 10 premiers exercices de la journée sont récompensés à 100%. Du 11e au 20e : 80%. À partir du 21e : 60%. La régularité est plus récompensée que l'intensité !",
  },
  {
    icon: <Trophy size={48} color="#e9c46a" />,
    title: '🏆 Les Récompenses',
    text: <>Les <Delta size={14} /> gagnés peuvent être dépensés de deux façons : les récompenses IRL créées par les parents (sorties, cadeaux...) et les récompenses internes (cartes à collectionner, jeux, thèmes...).</>,
    details: <>Les parents créent des récompenses sur mesure depuis leur espace parent et fixent le prix en <Delta size={12} />. Dans la Boutique, tu peux aussi acheter des cartes à collectionner ODIGO et accéder à des jeux !</>,
  },
  {
    icon: (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <OdigoAvatar direction="up" size={56} />
      </div>
    ),
    title: '🤖 Odi, le chatbot',
    text: "ODIGO intègre un chatbot assistant appelé Odi. Il peut aider à comprendre une notion, préparer une évaluation ou s'organiser. Il peut se tromper — vérifie les choses importantes avec un adulte ou ton enseignant. Il est accessible en bas à droite de l'écran à tout moment.",
  },
]

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<OnboardingStep>(1)
  const [showDetails, setShowDetails] = useState(false)

  const goTo = (s: OnboardingStep) => {
    setStep(s)
    setShowDetails(false)
  }

  const current = STEPS[step - 1]
  const hasDetails = step >= 2 && step <= 5

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '480px', width: '90%', background: 'white', borderRadius: '1.5rem', padding: '2rem', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', position: 'relative', boxSizing: 'border-box' }}>

        {/* Bouton Passer */}
        <button
          onClick={onComplete}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#aaa', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          Passer ✕
        </button>

        {/* Icône / illustration */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          {current.icon}
        </div>

        {/* Titre */}
        <h2 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#2a9d8f', textAlign: 'center', margin: '0 0 0.75rem' }}>
          {current.title}
        </h2>

        {/* Texte principal */}
        <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: 1.6, textAlign: 'center', margin: 0 }}>
          {current.text}
        </p>

        {/* En savoir plus (étapes 2-5) */}
        {hasDetails && (
          <>
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{ background: 'none', border: 'none', color: '#2a9d8f', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', display: 'block', margin: '0.75rem auto 0' }}
            >
              {showDetails ? 'Réduire ▲' : 'En savoir plus ▼'}
            </button>
            {showDetails && (
              <div style={{ background: 'var(--color-background)', borderRadius: '0.5rem', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#555', lineHeight: 1.6 }}>
                {current.details}
              </div>
            )}
          </>
        )}

        {/* Indicateur d'étapes (points) */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
          {([1, 2, 3, 4, 5, 6] as OnboardingStep[]).map(i => (
            <div key={i} style={{ width: step === i ? '20px' : '8px', height: '8px', borderRadius: '4px', background: step === i ? '#2a9d8f' : 'var(--color-border)', transition: 'all 0.2s ease' }} />
          ))}
        </div>

        {/* Boutons navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <button
            onClick={() => goTo((step - 1) as OnboardingStep)}
            disabled={step === 1}
            style={{ background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', cursor: step === 1 ? 'default' : 'pointer', opacity: step === 1 ? 0.3 : 1 }}
          >
            ← Précédent
          </button>
          {step < 6 ? (
            <button
              onClick={() => goTo((step + 1) as OnboardingStep)}
              style={{ background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Suivant →
            </button>
          ) : (
            <button
              onClick={onComplete}
              style={{ background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: 'bold' }}
            >
              C'est parti ! 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
