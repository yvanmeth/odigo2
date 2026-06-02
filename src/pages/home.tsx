import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Evaluation } from '../type/index'
import type { Subject } from '../type/index'

interface EvalWithStats extends Evaluation {
  subjectName: string
  totalRevisions: number
  doneRevisions: number
}

export default function Home() {
  const [evals, setEvals] = useState<EvalWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    const [evalsRes, subjectsRes, revisionsRes] = await Promise.all([
      supabase.from('evaluations').select('*').order('evaluation_date'),
      supabase.from('subjects').select('*'),
      supabase.from('revisions').select('*'),
    ])

    if (evalsRes.data && subjectsRes.data && revisionsRes.data) {
      const subjects: Subject[] = subjectsRes.data
      const revisions = revisionsRes.data

      const enriched: EvalWithStats[] = evalsRes.data.map(e => ({
        ...e,
        subjectName: subjects.find(s => Number(s.id) === Number(e.subject_id))?.name || '?',
        totalRevisions: revisions.filter(r => r.evaluation_id === e.id).length,
        doneRevisions: revisions.filter(r => r.evaluation_id === e.id && r.completed).length,
      }))

      setEvals(enriched)
    }
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]

  const upcoming = evals.filter(e => e.evaluation_date >= today)
  const past = evals.filter(e => e.evaluation_date < today)

  const getReadinessColor = (r: number | null) => {
    if (r === null) return '#aaa'
    if (r >= 5) return '#2a9d8f'
    if (r >= 3) return '#e9c46a'
    return '#e63946'
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      {/* Évaluations à venir */}
      <h2 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>📅 Évaluations à venir</h2>

      {upcoming.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem', color: '#aaa', textAlign: 'center' }}>
          Aucune évaluation à venir.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#f0faf8' }}>
                {['Date', 'Matière', 'Sujet', 'Révisions', 'Situation', 'Note'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', color: '#2a9d8f', fontWeight: 'bold', borderBottom: '1px solid #e0f0ee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcoming.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#333' }}>{formatDate(e.evaluation_date)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>{e.subjectName}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#555' }}>{e.topic}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                    <span style={{ color: e.doneRevisions > 0 ? '#2a9d8f' : '#aaa' }}>
                      {e.doneRevisions}/{e.totalRevisions}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {e.readiness !== null ? (
                      <span style={{ background: getReadinessColor(Number(e.readiness)), color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.85rem' }}>
                        {e.readiness}/6
                      </span>
                    ) : <span style={{ color: '#aaa' }}>—</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#aaa' }}>
                    {e.grade !== null ? `${e.grade}/6` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Évaluations passées */}
      {past.length > 0 && (
        <>
          <h2 style={{ color: '#888', marginBottom: '1rem', fontSize: '1.1rem' }}>📋 Évaluations passées</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', opacity: 0.8 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Date', 'Matière', 'Sujet', 'Révisions', 'Situation', 'Note'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.85rem', color: '#888', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {past.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#888' }}>{formatDate(e.evaluation_date)}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#888' }}>{e.subjectName}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#888' }}>{e.topic}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#aaa' }}>{e.doneRevisions}/{e.totalRevisions}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {e.readiness !== null ? (
                        <span style={{ background: '#ddd', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.85rem' }}>
                        {e.readiness}/6
                      </span>
                    ) : <span style={{ color: '#aaa' }}>—</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#888' }}>
                    {e.grade !== null ? `${e.grade}/6` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}