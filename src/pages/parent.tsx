import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import { formatISODate, formatISODateTime } from '../lib/dates'
import ChildTargetSelector from './parent/ChildTargetSelector'
import ParentCreateChild from './parent/ParentCreateChild'
import ParentChildren from './parent/ParentChildren'
import ParentIrlRewards from './parent/ParentIrlRewards'
import ParentPendingPurchases from './parent/ParentPendingPurchases'
import type { Child } from './parent/types'

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
  status: 'pending' | 'claimed' | 'completed'
  claimed_at: string | null
  completed_at: string | null
  profiles?: { first_name: string | null } | null
}

export default function ParentDashboard({ onSelectChild }: { onSelectChild: (childId: string | null) => void }) {
  const { showToast } = useToast()
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

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

  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    fetchChildren()
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

  const fetchMissions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('missions')
      .select('id, parent_id, child_id, name, description, deadline, reward_type, reward_amount, reward_irl_id, status, claimed_at, completed_at')
      .eq('parent_id', user.id)
      .order('deadline', { ascending: true })
    console.log('missions data:', data, 'error:', error)
    if (error) { console.error('fetchMissions RLS/error:', error.message, error.details); return }
    if (!data || data.length === 0) { setMissions([]); return }
    // Enrichir avec le prénom de l'enfant séparément pour éviter les problèmes de FK join
    const childIds = [...new Set(data.map((m: any) => m.child_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name')
      .in('id', childIds)
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.first_name]))
    const enriched = data.map((m: any) => ({
      ...m,
      profiles: { first_name: profileMap.get(m.child_id) || null },
    }))
    setMissions(enriched as Mission[])
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
      const { error: digoosError } = await supabase.rpc('add_digoos_to_user', {
        target_user_id: mission.child_id,
        amount: mission.reward_amount,
      })
      if (digoosError) {
        console.error('Erreur credit digoos:', digoosError)
        showToast('Erreur lors du crédit des Digoos', 'error')
        return
      }
    } else if (mission.reward_type === 'irl_reward' && mission.reward_irl_id) {
      const { data: reward } = await supabase
        .from('irl_rewards')
        .select('name, cost')
        .eq('id', mission.reward_irl_id)
        .single()

      if (reward) {
        const { error: rpcError } = await supabase.rpc(
          'add_irl_purchase_for_child',
          {
            target_child_id: mission.child_id,
            target_reward_id: mission.reward_irl_id,
            target_reward_name: reward.name,
            target_cost: reward.cost,
          }
        )
        if (rpcError) {
          console.error('Erreur coupon IRL:', rpcError)
          showToast("Erreur lors de l'attribution du coupon", 'error')
          return
        }
      }
    }

    showToast('Mission validée et récompense distribuée !')
    fetchMissions()
  }

  const handleRefuseMission = async (missionId: string) => {
    await supabase.from('missions').update({ status: 'pending', claimed_at: null }).eq('id', missionId)
    fetchMissions()
    showToast('Mission renvoyée en cours')
  }

  const handleDeleteMission = async (id: string) => {
    await supabase.from('missions').delete().eq('id', id)
    showToast('Mission supprimée', 'info')
    fetchMissions()
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>

      {/* 0. Créer un compte enfant */}
      <ParentCreateChild onChildCreated={fetchChildren} />

      {/* 1. Mes enfants */}
      <ParentChildren children={children} onSelectChild={onSelectChild} onChildRemoved={fetchChildren} />

      {/* 2. Récompenses IRL */}
      <ParentIrlRewards children={children} onRewardsChanged={fetchIrlRewardsList} />

      {/* 3. Récompenses en attente */}
      <ParentPendingPurchases />

      {/* 4. Missions */}
      <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
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

            <ChildTargetSelector
              children={children}
              mode={missionTargetMode}
              selectedIds={missionTargetChildren}
              onModeChange={setMissionTargetMode}
              onToggle={(childId, checked) => setMissionTargetChildren(prev =>
                checked ? [...prev, childId] : prev.filter(id => id !== childId)
              )}
            />

            <button
              onClick={handleSaveMission}
              style={{ padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
            >
              Créer la mission
            </button>
          </div>
        )}

        {(() => {
          const claimedMissions = missions.filter(m => m.status === 'claimed')
          const pendingMissions = missions.filter(m => m.status === 'pending')
          const completedMissions = missions.filter(m => m.status === 'completed')

          const sectionLabel = (label: string, count: number) => (
            <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', marginTop: '0.25rem' }}>
              {label} <span style={{ fontWeight: 'normal', color: '#aaa' }}>({count})</span>
            </div>
          )

          const missionCard = (m: Mission, variant: 'claimed' | 'pending' | 'completed') => {
            const isExpired = variant === 'pending' && new Date(m.deadline) < new Date()
            const childName = m.profiles?.first_name || 'Enfant'
            const irlRewardName = irlRewardsList.find(r => r.id === m.reward_irl_id)?.name
            return (
              <div key={m.id} style={{
                background: variant === 'claimed' ? '#fff8f0' : 'white',
                border: variant === 'claimed' ? '2px solid #e9c46a' : '1px solid var(--color-border)',
                borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '0.6rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '0.15rem' }}>
                      {m.name} <span style={{ fontWeight: 'normal', color: '#888', fontSize: '0.85rem' }}>— {childName}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.4rem' }}>{m.description}</div>
                    {variant !== 'completed' && (
                      <div style={{ fontSize: '0.82rem', color: isExpired ? '#e63946' : '#888' }}>
                        ⏱ {isExpired ? '⏰ Expirée — deadline : ' : 'Jusqu\'au '}{formatISODateTime(m.deadline)}
                      </div>
                    )}
                    {variant === 'completed' && m.completed_at && (
                      <div style={{ fontSize: '0.82rem', color: '#888' }}>Accomplie le {formatISODate(m.completed_at)}</div>
                    )}
                    {variant === 'claimed' && m.claimed_at && (
                      <div style={{ fontSize: '0.8rem', color: '#b8860b', marginTop: '0.2rem' }}>Signalée le {formatISODate(m.claimed_at)}</div>
                    )}
                    <div style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>
                      {m.reward_type === 'digoos'
                        ? <span style={{ color: '#b8860b', fontWeight: 'bold' }}>💰 {m.reward_amount} Δ</span>
                        : <span style={{ color: '#2a9d8f', fontWeight: 'bold' }}>🎁 {irlRewardName || 'Récompense IRL'}</span>
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    {variant === 'claimed' && (
                      <>
                        <button onClick={() => handleCompleteMission(m)}
                          style={{ padding: '0.45rem 0.9rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                        >
                          ✓ Accorder la récompense
                        </button>
                        <button onClick={() => handleRefuseMission(m.id)}
                          style={{ padding: '0.35rem 0.7rem', background: 'none', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                          ✗ Refuser
                        </button>
                      </>
                    )}
                    {variant === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button onClick={() => handleCompleteMission(m)}
                          style={{ padding: '0.35rem 0.7rem', background: 'var(--color-border)', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                          ✓ Valider quand même
                        </button>
                        <button onClick={() => handleDeleteMission(m.id)}
                          style={{ padding: '0.35rem 0.6rem', background: 'none', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                    {variant === 'completed' && (
                      <button onClick={() => handleDeleteMission(m.id)}
                        style={{ padding: '0.35rem 0.6rem', background: 'none', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          }

          if (missions.length === 0) {
            return <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune mission créée.</p>
          }

          return (
            <div>
              {/* À valider */}
              {sectionLabel('⏳ À valider', claimedMissions.length)}
              {claimedMissions.length === 0
                ? <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>Aucune mission dans cette catégorie.</p>
                : claimedMissions.map(m => missionCard(m, 'claimed'))
              }

              {/* En cours */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                {sectionLabel('🎯 En cours', pendingMissions.length)}
                {pendingMissions.length === 0
                  ? <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '1rem' }}>Aucune mission dans cette catégorie.</p>
                  : pendingMissions.map(m => missionCard(m, 'pending'))
                }
              </div>

              {/* Accomplies — repliées par défaut */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <button onClick={() => setShowCompleted(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.85rem', padding: '0', marginBottom: '0.5rem' }}
                >
                  {showCompleted ? '▾' : '▸'} Voir les missions accomplies ({completedMissions.length})
                </button>
                {showCompleted && (
                  completedMissions.length === 0
                    ? <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Aucune mission accomplie.</p>
                    : completedMissions.map(m => missionCard(m, 'completed'))
                )}
              </div>
            </div>
          )
        })()}
      </div>

    </div>
  )
}
