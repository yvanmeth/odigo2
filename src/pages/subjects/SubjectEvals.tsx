import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { EmptyState } from '../../components/EmptyState'
import type { Evaluation, Revision } from '../../type/index'
import { fmtDateDMY } from './types'

interface SubjectEvalsProps {
  userId?: string
  subjectId: number | string
}

export default function SubjectEvals({ userId, subjectId }: SubjectEvalsProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [revisions, setRevisions] = useState<Revision[]>([])

  useEffect(() => { fetchEvaluations() }, [subjectId])

  const getTargetId = async () => {
    if (userId) return userId
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id
  }

  const fetchEvaluations = async () => {
    const tid = await getTargetId()
    if (!tid) return
    const today = new Date().toISOString().split('T')[0]
    const [evalsRes, revsRes] = await Promise.all([
      supabase.from('evaluations').select('*')
        .eq('user_id', tid).eq('subject_id', subjectId)
        .gte('evaluation_date', today).order('evaluation_date'),
      supabase.from('revisions').select('*').eq('user_id', tid),
    ])
    if (evalsRes.data) setEvaluations(evalsRes.data)
    if (revsRes.data) setRevisions(revsRes.data)
  }

  if (evaluations.length === 0) {
    return <EmptyState emoji="📅" title="Aucune évaluation à venir" subtitle="Les évaluations planifiées pour cette matière apparaîtront ici." />
  }

  return (
    <div>
      {evaluations.map(e => {
        const total = revisions.filter(r => r.evaluation_id === e.id).length
        const done = revisions.filter(r => r.evaluation_id === e.id && r.completed).length
        return (
          <div key={e.id} style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '0.6rem', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ fontWeight: 'bold', color: '#333' }}>{e.topic}</div>
            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.2rem' }}>
              {fmtDateDMY(e.evaluation_date)} · révisions {done}/{total}
            </div>
            {e.readiness !== null && e.readiness !== undefined && (
              <div style={{ fontSize: '0.85rem', color: '#2a9d8f', marginTop: '0.2rem' }}>Note attendue : {e.readiness}/6</div>
            )}
            {e.grade !== null && e.grade !== undefined && (
              <div style={{ fontSize: '0.85rem', color: '#2a9d8f' }}>Note obtenue : {e.grade}/6</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
