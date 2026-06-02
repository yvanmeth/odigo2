import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Subject } from '../type/index'

const SUBJECT_COLORS: Record<string, string> = {
  'Français': '#4CAF50',
  'Maths': '#2196F3',
  'Allemand': '#FF9800',
  'Anglais': '#9C27B0',
  'Grec': '#00BCD4',
  'Arabe': '#F44336',
  'Géo': '#795548',
  'Histoire': '#607D8B',
}

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSubjects = async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name')

        console.log('data:', data, 'error:', error)
        if (!error && data) setSubjects(data)
      setLoading(false)
    }
    fetchSubjects()
  }, [])

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      {subjects.length === 0 ? (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          textAlign: 'center',
          color: '#aaa'
        }}>
          Aucune matière trouvée. Les matières seront ajoutées par l'administrateur.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '1rem'
        }}>
          {subjects.map(subject => (
            <div key={subject.id} style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '1.5rem 1rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              textAlign: 'center',
              borderTop: `4px solid ${SUBJECT_COLORS[subject.name] || '#2a9d8f'}`,
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                {getSubjectEmoji(subject.name)}
              </div>
              <div style={{
                fontWeight: 'bold',
                color: '#333',
                fontSize: '0.95rem'
              }}>
                {subject.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function getSubjectEmoji(name: string): string {
  const map: Record<string, string> = {
    'Français': '📖',
    'Maths': '🔢',
    'Allemand': '🇩🇪',
    'Anglais': '🇬🇧',
    'Grec': '🏛️',
    'Arabe': '🌙',
    'Géo': '🌍',
    'Histoire': '⏳',
  }
  return map[name] || '📚'
}