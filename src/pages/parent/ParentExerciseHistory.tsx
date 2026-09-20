import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatISODateTime } from '../../lib/dates'
import { EmptyState } from '../../components/EmptyState'
import { EXERCISE_LABELS } from '../../lib/exerciseBilan'
import type { Child } from './types'

const PAGE_SIZE = 20

interface ExerciseResult {
  id: string
  exercise: string
  errors: number
  stars: number
  difficulty: string | null
  list_name: string | null
  created_at: string
}

interface ParentExerciseHistoryProps {
  children: Child[]
}

const DIFF_LABELS: Record<string, string> = {
  facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile',
}

export default function ParentExerciseHistory({ children }: ParentExerciseHistoryProps) {
  const [selectedChildId, setSelectedChildId] = useState<string>(children[0]?.id ?? '')
  const [results, setResults] = useState<ExerciseResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const fetchPage = async (childId: string, pageOffset: number) => {
    if (pageOffset === 0) {
      setLoading(true)
      setResults([])
      setOffset(0)
      setHasMore(false)
    } else {
      setLoadingMore(true)
    }

    const { data } = await supabase
      .from('exercise_results')
      .select('id, exercise, errors, stars, difficulty, list_name, created_at')
      .eq('user_id', childId)
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1)

    const rows = (data ?? []) as ExerciseResult[]
    setResults(prev => pageOffset === 0 ? rows : [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setOffset(pageOffset + rows.length)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    if (!selectedChildId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage(selectedChildId, 0)
  }, [selectedChildId])

  if (children.length === 0) {
    return (
      <EmptyState
        emoji="👶"
        title="Aucun enfant lié"
        subtitle="Lie un compte enfant pour voir son historique d'exercices."
      />
    )
  }

  return (
    <div>
      <h3 style={{ fontWeight: 'bold', color: '#333', marginBottom: '1rem', fontSize: '1rem' }}>
        Historique des exercices
      </h3>

      {children.length > 1 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '0.4rem' }}>
            Enfant
          </label>
          <select
            value={selectedChildId}
            onChange={e => setSelectedChildId(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', background: 'white' }}
          >
            {children.map(c => (
              <option key={c.id} value={c.id}>{c.first_name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Chargement…</div>
      ) : results.length === 0 ? (
        <EmptyState
          emoji="📋"
          title="Aucun exercice pour l'instant"
          subtitle="Les exercices apparaîtront ici une fois que cet enfant aura joué."
        />
      ) : (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map(r => {
              const score = 10 - r.errors
              const stars = Math.max(0, Math.min(3, r.stars ?? 0))
              const meta: string[] = []
              if (r.list_name) meta.push(r.list_name)
              if (r.difficulty) meta.push(DIFF_LABELS[r.difficulty] ?? r.difficulty)
              return (
                <div
                  key={r.id}
                  style={{
                    background: 'white',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>
                      {EXERCISE_LABELS[r.exercise] ?? r.exercise}
                    </span>
                    <span style={{ fontWeight: 'bold', color: '#2a9d8f', fontSize: '0.9rem' }}>
                      {score}/10
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.82rem', color: '#aaa' }}>
                      {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
                      {meta.length > 0 ? ` · ${meta.join(' · ')}` : ''}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#bbb' }}>
                      {formatISODateTime(r.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => { setLoadingMore(true); fetchPage(selectedChildId, offset) }}
              disabled={loadingMore}
              style={{
                display: 'block', width: '100%', marginTop: '1rem',
                padding: '0.65rem', background: 'none',
                border: '1px solid #e0e0e0', borderRadius: '0.75rem',
                color: '#888', cursor: loadingMore ? 'default' : 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {loadingMore ? 'Chargement…' : 'Voir plus'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
