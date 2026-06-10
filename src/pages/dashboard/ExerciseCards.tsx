import { exerciseCards } from './types'

interface ExerciseCardsProps {
  onSelectExercise: (id: string) => void
}

export default function ExerciseCards({ onSelectExercise }: ExerciseCardsProps) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {exerciseCards.map(ex => (
          <div
            key={ex.id}
            onClick={() => onSelectExercise(ex.id)}
            className="card-hover"
            style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '1.5rem 1rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              textAlign: 'center',
              borderTop: `4px solid ${ex.color}`,
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{ex.icon}</div>
            <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem', marginBottom: '0.5rem' }}>{ex.label}</div>
            <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>{ex.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
