import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import ChildTargetSelector from './ChildTargetSelector'
import type { Child, IrlReward } from './types'

interface ParentIrlRewardsProps {
  children: Child[]
  onRewardsChanged: () => void
}

export default function ParentIrlRewards({ children, onRewardsChanged }: ParentIrlRewardsProps) {
  const { showToast } = useToast()
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

  useEffect(() => { fetchIrlRewards() }, [])

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
    onRewardsChanged()
  }

  const handleDeleteIrlReward = async (rewardId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('irl_rewards')
      .delete()
      .eq('id', rewardId)
      .eq('parent_id', user.id)

    if (error) {
      console.error('Delete error:', error)
      showToast('Erreur lors de la suppression', 'error')
      return
    }

    showToast('Récompense supprimée')
    await fetchIrlRewards()
    onRewardsChanged()
  }

  return (
    <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
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
          <ChildTargetSelector
            children={children}
            mode={targetMode}
            selectedIds={targetChildren}
            onModeChange={setTargetMode}
            onToggle={(childId, checked) => setTargetChildren(prev =>
              checked ? [...prev, childId] : prev.filter(id => id !== childId)
            )}
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
  )
}
