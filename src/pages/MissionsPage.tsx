import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Delta } from '../components/Delta'
import { PLANNER_COLORS } from './planner/types'

interface MissionsPageProps {
  userId: string
}

interface Mission {
  id: string
  name: string
  description?: string
  deadline: string
  status: 'pending' | 'claimed' | 'completed'
  reward_amount?: number
  reward_irl_id?: string
  claimed_at?: string
  completed_at?: string
}

const formatMissionDeadline = (deadline: string): string => {
  const d = new Date(deadline)
  return d.toLocaleDateString('fr-CH', {
    weekday: 'long', day: 'numeric', month: 'long',
  }) + ' à ' + d.toLocaleTimeString('fr-CH', {
    hour: '2-digit', minute: '2-digit',
  })
}

export default function MissionsPage({ userId }: MissionsPageProps) {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [showAccomplies, setShowAccomplies] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)

  const fetchMissions = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('missions')
      .select('*')
      .eq('child_id', userId)
      .order('deadline', { ascending: true })
    setMissions((data as Mission[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchMissions()
  }, [userId])

  const handleClaim = async (mission: Mission) => {
    setClaiming(mission.id)
    await supabase
      .from('missions')
      .update({ status: 'claimed', claimed_at: new Date().toISOString() })
      .eq('id', mission.id)
    await fetchMissions()
    setClaiming(null)
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  const now = new Date()
  const enCours = missions.filter(m => m.status === 'pending' && new Date(m.deadline) >= now)
  const claimed = missions.filter(m => m.status === 'claimed')
  const accomplies = missions.filter(m => m.status === 'completed')
  const echues = missions.filter(m => m.status === 'pending' && new Date(m.deadline) < now)

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
    border: '1px solid #e0f0ee',
    borderLeft: `4px solid ${PLANNER_COLORS.mission}`,
  }

  const sectionTitle = (text: string) => (
    <div style={{ color: '#2a9d8f', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
      {text}
    </div>
  )

  if (missions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Aucune mission pour le moment</div>
        <div style={{ fontSize: '0.9rem' }}>Ton parent peut t'en créer depuis son Espace parent.</div>
      </div>
    )
  }

  return (
    <div>
      {/* Section : En attente de validation */}
      {claimed.length > 0 && (
        <>
          {sectionTitle('⏳ À valider par le parent')}
          {claimed.map(m => (
            <div key={m.id} style={{ ...cardStyle, border: '1px solid #e9c46a', background: '#fffbf0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ fontWeight: 'bold', color: '#e76f51', fontSize: '1rem' }}>{m.name}</div>
                <span style={{ background: '#e9c46a', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                  En attente de validation
                </span>
              </div>
              {m.description && <div style={{ color: '#666', fontSize: '0.88rem', marginTop: '0.35rem' }}>{m.description}</div>}
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#888' }}>
                Deadline : {formatMissionDeadline(m.deadline)}
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.88rem', color: '#b8860b', fontWeight: 'bold' }}>
                {m.reward_irl_id
                  ? '🎁 Récompense IRL'
                  : <>{m.reward_amount} <Delta size={13} style={{ verticalAlign: 'middle' }} /></>
                }
              </div>
            </div>
          ))}
        </>
      )}

      {/* Section : En cours */}
      {enCours.length > 0 && (
        <>
          {sectionTitle('🎯 En cours')}
          {enCours.map(m => (
            <div key={m.id} style={cardStyle}>
              <div style={{ fontWeight: 'bold', color: '#e76f51', fontSize: '1rem', marginBottom: '0.25rem' }}>{m.name}</div>
              {m.description && <div style={{ color: '#555', fontSize: '0.88rem', marginBottom: '0.4rem' }}>{m.description}</div>}
              <div style={{ fontSize: '0.82rem', color: '#888', marginBottom: '0.25rem' }}>
                Jusqu'au {formatMissionDeadline(m.deadline)}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#b8860b', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                Récompense :{' '}
                {m.reward_irl_id
                  ? '🎁 Récompense IRL'
                  : <>{m.reward_amount} <Delta size={13} style={{ verticalAlign: 'middle' }} /></>
                }
              </div>
              <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: '#e76f51', marginBottom: '0.75rem' }}>
                Cette mission s'autodétruira le {formatMissionDeadline(m.deadline)}.
              </div>
              <button
                onClick={() => handleClaim(m)}
                disabled={claiming === m.id}
                style={{
                  padding: '0.5rem 1.1rem',
                  background: claiming === m.id ? '#ccc' : '#2a9d8f',
                  color: 'white', border: 'none', borderRadius: '0.5rem',
                  cursor: claiming === m.id ? 'default' : 'pointer',
                  fontWeight: 'bold', fontSize: '0.88rem',
                }}
              >
                {claiming === m.id ? '...' : '✅ Mission accomplie !'}
              </button>
            </div>
          ))}
        </>
      )}

      {enCours.length === 0 && claimed.length === 0 && echues.length === 0 && (
        <div style={{ color: '#888', fontSize: '0.9rem', padding: '1rem 0' }}>
          Aucune mission active pour le moment.
        </div>
      )}

      {/* Section : Accomplies (repliée par défaut) */}
      {accomplies.length > 0 && (
        <>
          {sectionTitle('✅ Accomplies')}
          <button
            onClick={() => setShowAccomplies(v => !v)}
            style={{ background: 'none', border: 'none', color: '#2a9d8f', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0 0.75rem', fontWeight: 'bold' }}
          >
            {showAccomplies ? '▲ Masquer' : `▼ Voir les missions accomplies (${accomplies.length})`}
          </button>
          {showAccomplies && accomplies.map(m => (
            <div key={m.id} style={{ ...cardStyle, opacity: 0.75 }}>
              <div style={{ fontWeight: 'bold', color: '#555' }}>{m.name}</div>
              {m.completed_at && (
                <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.25rem' }}>
                  Accomplie le {new Date(m.completed_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Section : Échues */}
      {echues.length > 0 && (
        <>
          {sectionTitle('⏰ Échues')}
          <div style={{ background: '#fff5f5', border: '1px solid #f5c6cb', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
              Ces missions ont expiré sans être accomplies.
            </div>
            {echues.map(m => (
              <div key={m.id} style={{ color: '#aaa', fontSize: '0.88rem', padding: '0.4rem 0', borderBottom: '1px solid #fde8e8' }}>
                {m.name} — deadline : {formatMissionDeadline(m.deadline)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
