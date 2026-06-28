import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Pencil, Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'

interface IrlReward {
  id: string
  parent_id: string
  name: string
  cost: number
  description?: string | null
  stock: number
  valid_until?: string | null
  created_at: string
}

interface PendingPurchase {
  id: string
  child_id: string
  reward_id: string
  reward_name: string
  cost: number
  status: 'valid' | 'used'
  purchased_at: string
  used_at?: string | null
  profiles?: { first_name: string | null } | null
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

interface IrlRewardSimple {
  id: string
  name: string
  cost: number
}

interface Mission {
  id: string
  parent_id: string
  child_id: string
  name: string
  description: string
  deadline: string
  reward_type: 'digoos' | 'irl_reward'
  reward_amount: number | null
  reward_irl_id: string | null
  status: 'pending' | 'completed'
  completed_at: string | null
  profiles?: { first_name: string | null } | null
}

const REACTIONS = ['👍', '❤️', '👏', '🔥', '💯', '😎', '🤩', '⭐', '🙌', '🫶']

export default function ParentDashboard({ onSelectChild }: { onSelectChild: (childId: string | null) => void }) {
  const { showToast } = useToast()
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
  const [irlStock, setIrlStock] = useState('1')
  const [irlValidUntil, setIrlValidUntil] = useState('')
  const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all')
  const [targetChildren, setTargetChildren] = useState<string[]>([])

  // Missions states
  const [missions, setMissions] = useState<Mission[]>([])
  const [irlRewardsList, setIrlRewardsList] = useState<IrlRewardSimple[]>([])
  const [showMissionForm, setShowMissionForm] = useState(false)
  const [missionName, setMissionName] = useState('')
  const [missionDesc, setMissionDesc] = useState('')
  const [missionDeadlineDate, setMissionDeadlineDate] = useState('')
  const [missionDeadlineTime, setMissionDeadlineTime] = useState('18:00')
  const [rewardType, setRewardType] = useState<'digoos' | 'irl_reward'>('digoos')
  const [rewardAmount, setRewardAmount] = useState(10)
  const [rewardIrlId, setRewardIrlId] = useState('')
  const [missionTargetMode, setMissionTargetMode] = useState<'all' | 'specific'>('all')
  const [missionTargetChildren, setMissionTargetChildren] = useState<string[]>([])

  // Récompenses en attente (coupons des enfants)
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([])
  const [markingUsedId, setMarkingUsedId] = useState<string | null>(null)

  useEffect(() => {
    fetchChildren()
    fetchInviteCode()
    fetchIrlRewards()
    fetchPendingPurchases()
    fetchMissions()
    fetchIrlRewardsList()
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

  const handleEditIrlReward = async (r: IrlReward) => {
    setIrlName(r.name)
    setIrlCost(String(r.cost))
    setIrlDescription(r.description || '')
    setIrlStock(String(r.stock ?? 1))
    setIrlValidUntil(r.valid_until || '')
    setIrlEditingId(r.id)

    const { data: existingTargets } = await supabase
      .from('irl_reward_children')
      .select('child_id')
      .eq('reward_id', r.id)

    if (existingTargets && existingTargets.length > 0) {
      setTargetMode('specific')
      setTargetChildren(existingTargets.map((t: { child_id: string }) => t.child_id))
    } else {
      setTargetMode('all')
      setTargetChildren([])
    }

    setShowIrlForm(true)
  }

  const handleSaveIrlReward = async () => {
    if (!irlName || !irlCost) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      name: irlName,
      cost: parseInt(irlCost),
      description: irlDescription || null,
      stock: parseInt(irlStock) || 1,
      valid_until: irlValidUntil || null,
    }

    let rewardId: string
    if (irlEditingId) {
      await supabase.from('irl_rewards').update(payload).eq('id', irlEditingId)
      rewardId = irlEditingId
      showToast('Récompense mise à jour')
    } else {
      const { data } = await supabase.from('irl_rewards').insert({ ...payload, parent_id: user.id }).select().single()
      rewardId = data?.id
      showToast('Récompense créée')
    }

    if (rewardId) {
      await supabase.from('irl_reward_children').delete().eq('reward_id', rewardId)
      if (targetMode === 'specific' && targetChildren.length > 0) {
        await supabase.from('irl_reward_children').insert(
          targetChildren.map(childId => ({ reward_id: rewardId, child_id: childId }))
        )
      }
    }

    setIrlName(''); setIrlCost(''); setIrlDescription(''); setIrlStock('1'); setIrlValidUntil('')
    setIrlEditingId(null); setShowIrlForm(false)
    setTargetMode('all'); setTargetChildren([])
    fetchIrlRewards()
  }

  const handleDeleteIrlReward = async (id: string) => {
    await supabase.from('irl_rewards').delete().eq('id', id)
    showToast('Supprimé', 'info')
    fetchIrlRewards()
  }

  const fetchMissions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('missions')
      .select('*, profiles!child_id(first_name)')
      .eq('parent_id', user.id)
      .order('deadline', { ascending: true })
    setMissions((data as Mission[]) || [])
  }

  const fetchIrlRewardsList = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('irl_rewards')
      .select('id, name, cost')
      .eq('parent_id', user.id)
    if (data) setIrlRewardsList(data)
  }

  const resetMissionForm = () => {
    setMissionName(''); setMissionDesc(''); setMissionDeadlineDate('')
    setMissionDeadlineTime('18:00'); setRewardType('digoos'); setRewardAmount(10)
    setRewardIrlId(''); setMissionTargetMode('all'); setMissionTargetChildren([])
    setShowMissionForm(false)
  }

  const handleSaveMission = async () => {
    if (!missionName || !missionDesc || !missionDeadlineDate) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const deadline = `${missionDeadlineDate}T${missionDeadlineTime}:00`
    const targetIds = missionTargetMode === 'all'
      ? children.map(c => c.id)
      : missionTargetChildren

    if (targetIds.length === 0) {
      showToast('Sélectionne au moins un enfant', 'error')
      return
    }

    const missionsToInsert = targetIds.map(childId => ({
      parent_id: user.id,
      child_id: childId,
      name: missionName,
      description: missionDesc,
      deadline: new Date(deadline).toISOString(),
      reward_type: rewardType,
      reward_amount: rewardType === 'digoos' ? rewardAmount : null,
      reward_irl_id: rewardType === 'irl_reward' ? rewardIrlId : null,
      status: 'pending',
    }))

    await supabase.from('missions').insert(missionsToInsert)
    showToast('Mission(s) créée(s)')
    resetMissionForm()
    fetchMissions()
  }

  const handleCompleteMission = async (mission: Mission) => {
    await supabase.from('missions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', mission.id)

    if (mission.reward_type === 'digoos' && mission.reward_amount) {
      const { data: childProgress } = await supabase
        .from('progress')
        .select('digoos, digoos_this_week')
        .eq('user_id', mission.child_id)
        .single()

      if (childProgress) {
        await supabase.from('progress').update({
          digoos: (childProgress.digoos || 0) + mission.reward_amount,
          digoos_this_week: (childProgress.digoos_this_week || 0) + mission.reward_amount,
        }).eq('user_id', mission.child_id)
      } else {
        await supabase.from('progress').insert({
          user_id: mission.child_id,
          digoos: mission.reward_amount,
          digoos_this_week: mission.reward_amount,
        })
      }
    } else if (mission.reward_type === 'irl_reward' && mission.reward_irl_id) {
      const { data: reward } = await supabase
        .from('irl_rewards')
        .select('name, cost')
        .eq('id', mission.reward_irl_id)
        .single()

      if (reward) {
        await supabase.from('irl_purchases').insert({
          child_id: mission.child_id,
          reward_id: mission.reward_irl_id,
          reward_name: reward.name,
          cost: 0,
          status: 'valid',
        })
      }
    }

    showToast('Mission validée et récompense distribuée !')
    fetchMissions()
  }

  const handleDeleteMission = async (id: string) => {
    await supabase.from('missions').delete().eq('id', id)
    showToast('Mission supprimée', 'info')
    fetchMissions()
  }

  const fetchPendingPurchases = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: links } = await supabase
      .from('parent_child').select('child_id').eq('parent_id', user.id)
    const childIds = links?.map(l => l.child_id) || []
    if (childIds.length === 0) { setPendingPurchases([]); return }

    const [purchasesRes, profilesRes] = await Promise.all([
      supabase.from('irl_purchases').select('*').in('child_id', childIds).eq('status', 'valid').order('purchased_at', { ascending: false }),
      supabase.from('profiles').select('id, first_name').in('id', childIds),
    ])

    const firstNames = new Map((profilesRes.data || []).map(p => [p.id, p.first_name]))
    const enriched = (purchasesRes.data || []).map(p => ({ ...p, profiles: { first_name: firstNames.get(p.child_id) || null } }))
    setPendingPurchases(enriched)
  }

  const handleMarkUsed = async (purchase: PendingPurchase) => {
    setMarkingUsedId(purchase.id)
    await supabase.from('irl_purchases').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', purchase.id)
    showToast('Récompense marquée comme utilisée')
    await fetchPendingPurchases()
    setMarkingUsedId(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} à ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
                <div key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--color-background)', borderRadius: '0.5rem' }}>
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
                <div style={{ background: 'var(--color-background)', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
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
            style={{ padding: '0.6rem 1.2rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
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
            onClick={() => {
              if (showIrlForm) {
                setShowIrlForm(false); setIrlEditingId(null)
                setIrlName(''); setIrlCost(''); setIrlDescription(''); setIrlStock('1'); setIrlValidUntil('')
                setTargetMode('all'); setTargetChildren([])
              } else {
                setShowIrlForm(true)
              }
            }}
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
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Quantité disponible</label>
              <input
                type="number" min={1} value={irlStock}
                onChange={e => setIrlStock(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Valable jusqu'au</label>
              <input
                type="date" value={irlValidUntil}
                onChange={e => setIrlValidUntil(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
              />
            </div>
            {children.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Disponible pour</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setTargetMode('all')}
                    style={{
                      padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem',
                      cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
                      background: targetMode === 'all' ? '#2a9d8f' : 'var(--color-border)',
                      color: targetMode === 'all' ? 'white' : '#2a9d8f',
                    }}
                  >
                    Tous mes enfants
                  </button>
                  <button
                    onClick={() => setTargetMode('specific')}
                    style={{
                      padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem',
                      cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
                      background: targetMode === 'specific' ? '#2a9d8f' : 'var(--color-border)',
                      color: targetMode === 'specific' ? 'white' : '#2a9d8f',
                    }}
                  >
                    Choisir
                  </button>
                </div>
                {targetMode === 'specific' && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {children.map(child => (
                      <label key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={targetChildren.includes(child.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setTargetChildren(prev => [...prev, child.id])
                            } else {
                              setTargetChildren(prev => prev.filter(id => id !== child.id))
                            }
                          }}
                        />
                        {child.first_name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--color-background)', borderRadius: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>{r.name}</div>
                  {r.description && <div style={{ fontSize: '0.82rem', color: '#888' }}>{r.description}</div>}
                  <div style={{ fontSize: '0.82rem', color: '#e9c46a', fontWeight: 'bold', marginTop: '0.15rem' }}>{r.cost} Digoos</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleEditIrlReward(r)} style={{ background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center' }}><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteIrlReward(r.id)} style={{ background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.4rem', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Missions */}
      <div style={{ marginTop: '1.5rem', background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#2a9d8f', margin: 0 }}>🎯 Missions</h3>
          <button
            onClick={() => showMissionForm ? resetMissionForm() : setShowMissionForm(true)}
            style={{ padding: '0.4rem 0.9rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {showMissionForm ? '✕ Annuler' : '+ Ajouter'}
          </button>
        </div>

        {showMissionForm && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#f8fffe', borderRadius: '0.75rem', padding: '1rem' }}>
            <input
              type="text" placeholder="Nom de la mission *" value={missionName}
              onChange={e => setMissionName(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            />
            <textarea
              placeholder="Description de la mission *" value={missionDesc}
              onChange={e => setMissionDesc(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', resize: 'vertical', height: '80px' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Date limite *</label>
                <input
                  type="date" value={missionDeadlineDate}
                  onChange={e => setMissionDeadlineDate(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.25rem' }}>Heure limite</label>
                <input
                  type="time" value={missionDeadlineTime}
                  onChange={e => setMissionDeadlineTime(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Récompense</label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button
                  onClick={() => setRewardType('digoos')}
                  style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', background: rewardType === 'digoos' ? '#2a9d8f' : 'var(--color-border)', color: rewardType === 'digoos' ? 'white' : '#2a9d8f' }}
                >
                  💰 Digoos
                </button>
                <button
                  onClick={() => setRewardType('irl_reward')}
                  style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', background: rewardType === 'irl_reward' ? '#2a9d8f' : 'var(--color-border)', color: rewardType === 'irl_reward' ? 'white' : '#2a9d8f' }}
                >
                  🎁 Récompense IRL
                </button>
              </div>
              {rewardType === 'digoos' && (
                <input
                  type="number" min={1} value={rewardAmount}
                  onChange={e => setRewardAmount(Number(e.target.value) || 10)}
                  placeholder="Nombre de Digoos"
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              )}
              {rewardType === 'irl_reward' && (
                irlRewardsList.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#e63946' }}>Aucune récompense IRL définie. Crée-en une d'abord.</p>
                ) : (
                  <select
                    value={rewardIrlId}
                    onChange={e => setRewardIrlId(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
                  >
                    <option value="">Choisir une récompense IRL</option>
                    {irlRewardsList.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.cost} Δ)</option>
                    ))}
                  </select>
                )
              )}
            </div>

            {children.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Disponible pour</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setMissionTargetMode('all')}
                    style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', background: missionTargetMode === 'all' ? '#2a9d8f' : 'var(--color-border)', color: missionTargetMode === 'all' ? 'white' : '#2a9d8f' }}
                  >
                    Tous mes enfants
                  </button>
                  <button
                    onClick={() => setMissionTargetMode('specific')}
                    style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', background: missionTargetMode === 'specific' ? '#2a9d8f' : 'var(--color-border)', color: missionTargetMode === 'specific' ? 'white' : '#2a9d8f' }}
                  >
                    Choisir
                  </button>
                </div>
                {missionTargetMode === 'specific' && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {children.map(child => (
                      <label key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={missionTargetChildren.includes(child.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setMissionTargetChildren(prev => [...prev, child.id])
                            } else {
                              setMissionTargetChildren(prev => prev.filter(id => id !== child.id))
                            }
                          }}
                        />
                        {child.first_name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSaveMission}
              style={{ padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
            >
              Créer la mission
            </button>
          </div>
        )}

        {missions.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune mission créée.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {missions.map(m => {
              const isExpired = m.status === 'pending' && new Date(m.deadline) < new Date()
              const childName = m.profiles?.first_name || 'Enfant'
              const irlName = irlRewardsList.find(r => r.id === m.reward_irl_id)?.name
              return (
                <div key={m.id} style={{ background: '#f8fffe', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '0.15rem' }}>
                        {m.name} <span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.85rem' }}>— {childName}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.4rem' }}>{m.description}</div>
                      <div style={{ fontSize: '0.82rem', color: '#888' }}>⏱ Jusqu'au {formatDateTime(m.deadline)}</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '0.2rem' }}>
                        {m.reward_type === 'digoos'
                          ? <span style={{ color: '#b8860b', fontWeight: 'bold' }}>💰 {m.reward_amount} Δ</span>
                          : <span style={{ color: '#2a9d8f', fontWeight: 'bold' }}>🎁 {irlName || 'Récompense IRL'}</span>
                        }
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {m.status === 'completed' ? (
                          <span style={{ background: 'var(--color-border)', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 'bold' }}>✓ Accomplie</span>
                        ) : (
                          <span style={{ background: '#fff8e0', color: '#b8860b', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 'bold' }}>En attente</span>
                        )}
                        {isExpired && (
                          <span style={{ background: '#ffeaea', color: '#e63946', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.78rem', fontWeight: 'bold' }}>⏰ Expirée</span>
                        )}
                      </div>
                      {m.status === 'completed' && m.completed_at && (
                        <div style={{ fontSize: '0.78rem', color: '#888' }}>Accomplie le {formatDate(m.completed_at)}</div>
                      )}
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {m.status === 'pending' && (
                          <button
                            onClick={() => handleCompleteMission(m)}
                            style={{ padding: '0.35rem 0.7rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                          >
                            ✓ Mission accomplie
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMission(m.id)}
                          style={{ padding: '0.35rem 0.6rem', background: 'none', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Récompenses en attente */}
      <div style={{ marginTop: '1.5rem', background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>🎁 Récompenses en attente</h3>

        {pendingPurchases.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune récompense en attente.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingPurchases.map(p => (
              <div
                key={p.id}
                style={{
                  background: 'white', border: '2px dashed #2a9d8f', borderRadius: '0.75rem',
                  padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>🎁 {p.reward_name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                    {p.profiles?.first_name || 'Enfant'} · Acheté le {formatDate(p.purchased_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ borderLeft: '1px dashed #ccc', alignSelf: 'stretch' }} />
                  <span style={{ background: '#e9c46a', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    {p.cost} Digoos
                  </span>
                  <span style={{ background: 'var(--color-background)', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                    ✓ Valable
                  </span>
                  <button
                    onClick={() => handleMarkUsed(p)}
                    disabled={markingUsedId === p.id}
                    style={{ padding: '0.4rem 0.8rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: markingUsedId === p.id ? 'default' : 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    {markingUsedId === p.id ? '...' : 'Marquer comme utilisée'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}