import { Delta } from '../../components/Delta'
import { formatMissionDeadline } from '../../lib/dates'
import type { Mission } from '../../services/missions'

interface HomeMissionsProps {
  missions: Mission[]
  onClaim: (missionId: string) => void
}

export default function HomeMissions({ missions, onClaim }: HomeMissionsProps) {
  if (missions.length === 0) return null

  return (
    <div style={{
      background: 'var(--color-card)', borderRadius: '1rem', padding: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ color: '#2a9d8f', fontSize: '1rem', fontWeight: 'bold' }}>🎯 Missions</div>
      </div>
      {missions.map(m => (
        <div key={m.id} style={{
          borderLeft: '4px solid #e76f51',
          background: '#fff8f5',
          borderRadius: '0.75rem',
          padding: '0.85rem 1rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{ fontWeight: 'bold', color: '#e76f51', fontSize: '0.95rem' }}>{m.name}</div>
          {m.description && (
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.2rem' }}>{m.description}</div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.3rem' }}>
            Deadline : {formatMissionDeadline(m.deadline)}
          </div>
          {m.reward_type === 'digoos' && m.reward_amount !== null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', background: '#fff8e0', color: '#b8860b', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold' }}>
              Récompense : {m.reward_amount} <Delta size={14} />
            </div>
          )}
          {m.reward_type === 'irl_reward' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', background: 'var(--color-background)', color: '#2a9d8f', padding: '0.2rem 0.6rem', borderRadius: '0.4rem', fontSize: '0.82rem', fontWeight: 'bold' }}>
              🎁 Récompense IRL
            </div>
          )}
          {m.status === 'pending' ? (
            <button
              onClick={() => onClaim(m.id)}
              style={{ marginTop: '0.5rem', padding: '0.4rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', width: '100%' }}
            >
              ✅ Mission accomplie !
            </button>
          ) : (
            <div style={{ marginTop: '0.5rem', padding: '0.3rem 0.75rem', background: '#fff8e0', color: '#b8860b', borderRadius: '0.5rem', fontSize: '0.82rem', fontWeight: 'bold', display: 'inline-block' }}>
              ⏳ En attente de validation parent
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
