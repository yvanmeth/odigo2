import { Sparkles } from 'lucide-react'
import { exerciseCards } from './types'

const SECTIONS = [
  { id: 'langues', label: '🌍 Langues étrangères' },
  { id: 'francais', label: '📖 Français' },
  { id: 'maths', label: '🔢 Mathématiques' },
]

interface ExerciseCardsProps {
  onSelectExercise: (id: string) => void
}

export default function ExerciseCards({ onSelectExercise }: ExerciseCardsProps) {
  return (
    <div>
      {SECTIONS.map(section => (
        <div key={section.id} style={{ marginBottom: '2rem' }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 'bold',
            color: '#2a9d8f',
            marginBottom: '1rem',
            paddingBottom: '0.4rem',
            borderBottom: '2px solid var(--color-border)',
          }}>
            {section.label}
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '1rem',
          }}>
            {exerciseCards
              .filter(ex => ex.category === section.id)
              .map(ex => (
                <div
                  key={ex.id}
                  onClick={() => onSelectExercise(ex.id)}
                  className="card-hover"
                  style={{
                    position: 'relative',
                    background: 'white',
                    borderRadius: '1rem',
                    padding: '1.5rem 1rem',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    textAlign: 'center',
                    borderTop: `4px solid ${ex.color}`,
                  }}
                >
                  {ex.isAI && (
                    <div style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      background: 'rgba(255,255,255,0.92)',
                      borderRadius: '0.75rem',
                      padding: '0.15rem 0.5rem',
                      color: '#5c6bc0',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    }}>
                      <Sparkles size={11} />
                      IA
                    </div>
                  )}
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{ex.icon}</div>
                  <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem', marginBottom: '0.5rem' }}>{ex.label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>{ex.description}</div>
                </div>
              ))
            }
          </div>
        </div>
      ))}
    </div>
  )
}
