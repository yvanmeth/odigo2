import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface IrlReward {
  id: string
  parent_id: string
  name: string
  cost: number
  description?: string | null
  created_at: string
}

interface Child {
  id: string
  first_name: string
  email: string
  relationship: string
}

interface InviteCode {
  code: string
  expires_at: string
  used: boolean
}

const REACTIONS = ['👍', '❤️', '👏', '🔥', '💯', '😎', '🤩', '⭐', '🙌', '🫶']

export default function ParentDashboard({ onSelectChild }: { onSelectChild: (childId: string | null) => void }) {
  const [children, setChildren] = useState<Child[]>([])
  const [inviteCode, setInviteCode] = useState<InviteCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState('parent')
  const [copied, setCopied] = useState(false)

  // IRL Rewards states
  const [irlRewards, setIrlRewards] = useState<IrlReward[]>([])
  const [showIrlForm, setShowIrlForm] = useState(false)
  const [irlEditingId, setIrlEditingId] = useState<string | null>(null)
  const [irlName, setIrlName] = useState('')
  const [irlCost, setIrlCost] = useState('')
  const [irlDescription, setIrlDescription] = useState('')

  useEffect(() => {
    fetchChildren()
    fetchInviteCode()
    fetchIrlRewards()
  }, [])

  const fetchChildren = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
  
    const { data: links } = await supabase
      .from('parent_child')
      .select('child_id, relationship')
      .eq('parent_id', user.id)

     
  
    if (links && links.length > 0) {
      const childIds = links.map(d => d.child_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name')
        .in('id', childIds)
  
      if (profiles) {
        const enriched = profiles.map(p => ({
          id: p.id,
          first_name: p.first_name || 'Sans prénom',
          email: '',
          relationship: links.find(d => d.child_id === p.id)?.relationship || 'parent',
        }))
        setChildren(enriched)
      }
    }
    setLoading(false)
  }

  const fetchInviteCode = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('parent_id', user.id)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) setInviteCode(data)
  }

  const generateCode = async () => {
    setGeneratingCode(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data } = await supabase
      .from('invite_codes')
      .insert({
        parent_id: user.id,
        code,
        used: false,
      })
      .select()
      .single()

    if (data) setInviteCode(data)
    setGeneratingCode(false)
  }

  const copyCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fetchIrlRewards = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('irl_rewards').select('*').eq('parent_id', user.id).order('name')
    if (data) setIrlRewards(data)
  }

  const handleEditIrlReward = (r: IrlReward) => {
    setIrlName(r.name)
    setIrlCost(String(r.cost))
    setIrlDescription(r.description || '')
    setIrlEditingId(r.id)
    setShowIrlForm(true)
  }

  const handleSaveIrlReward = async () => {
    if (!irlName || !irlCost) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { name: irlName, cost: parseInt(irlCost), description: irlDescription || null }
    if (irlEditingId) {
      await supabase.from('irl_rewards').update(payload).eq('id', irlEditingId)
    } else {
      await supabase.from('irl_rewards').insert({ ...payload, parent_id: user.id })
    }
    setIrlName(''); setIrlCost(''); setIrlDescription(''); setIrlEditingId(null); setShowIrlForm(false)
    fetchIrlRewards()
  }

  const handleDeleteIrlReward = async (id: string) => {
    await supabase.from('irl_rewards').delete().eq('id', id)
    fetchIrlRewards()
  }

  const removeChild = async (childId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('parent_child').delete().eq('parent_id', user.id).eq('child_id', childId)
    fetchChildren()
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>

        {/* Mes enfants */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>👨‍👧 Mes enfants</h3>

          {children.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucun enfant lié pour l'instant.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
              {children.map(child => (
                <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f0faf8', borderRadius: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{child.first_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{child.relationship}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => onSelectChild(child.id)}
                      style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Voir
                    </button>
                    <button
                      onClick={() => removeChild(child.id)}
                      style={{ padding: '0.4rem 0.8rem', background: 'none', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {children.length < 5 && (
            <div>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Génère un code et transmets-le à ton enfant pour lier les comptes.
              </p>
              <select
                value={selectedRelationship}
                onChange={e => setSelectedRelationship(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.85rem', marginBottom: '0.5rem' }}
              >
                <option value="père">Père</option>
                <option value="mère">Mère</option>
                <option value="autre">Autre</option>
              </select>

              {inviteCode ? (
                <div style={{ background: '#f0faf8', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2a9d8f', letterSpacing: '0.3rem', marginBottom: '0.5rem' }}>
                    {inviteCode.code}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '0.5rem' }}>
                    Expire le {new Date(inviteCode.expires_at).toLocaleDateString('fr-CH')}
                  </div>
                  <button
                    onClick={copyCode}
                    style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {copied ? '✓ Copié !' : 'Copier le code'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateCode}
                  disabled={generatingCode}
                  style={{ width: '100%', padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  {generatingCode ? 'Génération...' : '+ Générer un code d\'invitation'}
                </button>
              )}
            </div>
          )}

          {children.length >= 5 && (
            <p style={{ color: '#aaa', fontSize: '0.8rem' }}>Maximum 5 enfants atteint.</p>
          )}
        </div>

        {/* Réactions disponibles */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>💬 Réactions</h3>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Depuis la vue de ton enfant, tu peux laisser une réaction sur ses évaluations et révisions. Il la verra à sa prochaine connexion.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {REACTIONS.map(r => (
              <span key={r} style={{ fontSize: '1.5rem' }}>{r}</span>
            ))}
          </div>
        </div>

        {/* Mon espace */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>👤 Mon espace</h3>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Tu as aussi ton propre espace ODIGO — planificateur, listes de mots et exercices.
          </p>
          <button
            onClick={() => onSelectChild(null)}
            style={{ padding: '0.6rem 1.2rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Accéder à mon espace
          </button>
        </div>
      </div>

      {/* Récompenses IRL */}
      <div style={{ marginTop: '1.5rem', background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#2a9d8f', margin: 0 }}>🎁 Récompenses IRL</h3>
          <button
            onClick={() => { if (showIrlForm) { setShowIrlForm(false); setIrlEditingId(null) } else { setShowIrlForm(true) } }}
            style={{ padding: '0.4rem 0.9rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {showIrlForm ? '✕ Annuler' : '+ Ajouter'}
          </button>
        </div>

        {showIrlForm && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text" placeholder="Nom de la récompense" value={irlName}
              onChange={e => setIrlName(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            />
            <input
              type="number" placeholder="Coût en Digoos" min={1} value={irlCost}
              onChange={e => setIrlCost(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            />
            <textarea
              placeholder="Description (facultatif)" value={irlDescription}
              onChange={e => setIrlDescription(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', resize: 'vertical', height: '70px' }}
            />
            <button
              onClick={handleSaveIrlReward}
              style={{ padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {irlEditingId ? 'Mettre à jour' : 'Enregistrer'}
            </button>
          </div>
        )}

        {irlRewards.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune récompense définie.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {irlRewards.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: '#f0faf8', borderRadius: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{r.name}</div>
                  {r.description && <div style={{ fontSize: '0.82rem', color: '#888' }}>{r.description}</div>}
                  <div style={{ fontSize: '0.82rem', color: '#e9c46a', fontWeight: 'bold', marginTop: '0.15rem' }}>{r.cost} Digoos</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleEditIrlReward(r)} style={{ background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem' }}>✏️</button>
                  <button onClick={() => handleDeleteIrlReward(r.id)} style={{ background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem' }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}