import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type ModalPhase = 'entry' | 'leaderboard'

interface Highscore {
  id: string
  initials: string
  score: number
  created_at: string
}

interface HighscoreModalProps {
  exercise: string
  listId: string
  listName: string
  score: number
  initialPhase?: ModalPhase
  onClose: () => void
  onDisable: () => void
  onReplay: () => void
  onQuit: () => void
}

export default function HighscoreModal({
  exercise, listId, listName, score,
  initialPhase = 'entry',
  onClose, onDisable, onReplay, onQuit,
}: HighscoreModalProps) {
  const [phase, setPhase] = useState<ModalPhase>(initialPhase)
  const [initials, setInitials] = useState('')
  const [leaderboard, setLeaderboard] = useState<Highscore[]>([])
  const [newEntryId, setNewEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isValidUUID = (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

  const listIdToInsert = isValidUUID(listId) ? listId : null

  const fetchLeaderboard = async (): Promise<Highscore[]> => {
    const query = supabase
      .from('highscores')
      .select('id, initials, score, created_at')
      .eq('exercise', exercise)
    const { data } = await (listIdToInsert
      ? query.eq('list_id', listIdToInsert)
      : query.is('list_id', null))
    return (data || []).sort((a: Highscore, b: Highscore) => b.score - a.score).slice(0, 5)
  }

  useEffect(() => {
    if (phase === 'leaderboard') {
      setLoading(true)
      fetchLeaderboard().then(board => {
        setLeaderboard(board)
        setLoading(false)
      })
    }
  }, [phase])

  const handleSubmit = async () => {
    if (!initials.trim()) return
    setLoading(true)
    const { data: newEntry } = await supabase
      .from('highscores')
      .insert({ exercise, list_id: listIdToInsert, list_name: listName, initials: initials.trim().toUpperCase(), score })
      .select()
      .single()
    const board = await fetchLeaderboard()
    setLeaderboard(board)
    setNewEntryId(newEntry?.id || null)
    setPhase('leaderboard')
    setLoading(false)
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: '360px', width: '100%',
    background: '#1a1a2e', borderRadius: '1rem', padding: '2rem',
  }

  const btnStyle = (primary: boolean): React.CSSProperties => ({
    background: primary ? '#2a9d8f' : 'rgba(255,255,255,0.1)',
    color: 'white', border: 'none', borderRadius: '0.5rem',
    padding: '0.6rem 1.5rem', width: '100%',
    cursor: 'pointer', fontSize: '1rem',
    fontWeight: primary ? 'bold' : 'normal',
  })

  if (phase === 'entry') {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e9c46a' }}>🏆 TOP 5 !</div>
            <div style={{ color: 'white', marginTop: '0.5rem' }}>Tu entres dans le classement !</div>
            <div style={{ color: '#2a9d8f', fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
              Ton score : {score} pts
            </div>
          </div>

          <input
            value={initials}
            onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 3))}
            maxLength={3}
            placeholder="AAA"
            autoFocus
            style={{
              display: 'block', margin: '0 auto 1.5rem', width: '120px',
              textAlign: 'center', fontSize: '2rem', fontWeight: 'bold',
              letterSpacing: '0.5rem', background: '#0d0d1a', color: '#e9c46a',
              border: '2px solid #e9c46a', borderRadius: '0.5rem', padding: '0.5rem',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={handleSubmit}
              disabled={initials.length < 1 || loading}
              style={{
                background: initials.length >= 1 && !loading ? '#e9c46a' : '#444',
                color: '#1a1a2e', border: 'none', borderRadius: '0.5rem',
                padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold',
                cursor: initials.length >= 1 && !loading ? 'pointer' : 'default',
              }}
            >
              {loading ? '⏳ Enregistrement...' : '✓ Enregistrer'}
            </button>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '0.5rem', fontSize: '0.9rem' }}>
              Passer
            </button>
            <button onClick={onDisable}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '0.25rem', fontSize: '0.8rem' }}>
              Désactiver les highscores
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#e9c46a' }}>🏆 Classement</div>
          <div style={{ color: '#aaa', marginTop: '0.25rem', fontSize: '0.9rem' }}>{listName}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: '1rem' }}>Chargement...</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: '1rem' }}>Aucun score pour l'instant.</div>
        ) : (
          <div style={{ marginBottom: '1.5rem' }}>
            {leaderboard.map((entry, index) => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.6rem 1rem', borderRadius: '0.5rem',
                background: entry.id === newEntryId ? 'rgba(233,196,106,0.15)' : 'transparent',
                border: entry.id === newEntryId ? '1px solid #e9c46a' : '1px solid transparent',
                marginBottom: '0.4rem',
              }}>
                <span style={{
                  color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#aaa',
                  fontWeight: 'bold', fontSize: '1.1rem', width: '2rem',
                }}>
                  #{index + 1}
                </span>
                <span style={{ color: '#e9c46a', fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '0.2rem', flex: 1 }}>
                  {entry.initials}
                </span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{entry.score} pts</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button onClick={onReplay} style={btnStyle(true)}>🔄 Rejouer</button>
          <button onClick={onQuit} style={btnStyle(false)}>Quitter</button>
        </div>
      </div>
    </div>
  )
}
