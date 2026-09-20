import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ParentCreateChild from './parent/ParentCreateChild'
import ParentChildren from './parent/ParentChildren'
import ParentIrlRewards from './parent/ParentIrlRewards'
import ParentPendingPurchases from './parent/ParentPendingPurchases'
import ParentMissions from './parent/ParentMissions'
import ParentExerciseHistory from './parent/ParentExerciseHistory'
import type { Child, IrlRewardSimple } from './parent/types'

type Tab = 'missions' | 'recompenses' | 'exercices'

const TAB_LABELS: Record<Tab, string> = {
  missions: 'Missions',
  recompenses: 'Récompenses IRL',
  exercices: 'Exercices',
}

export default function ParentDashboard({ onSelectChild }: { onSelectChild: (childId: string | null) => void }) {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [irlRewardsList, setIrlRewardsList] = useState<IrlRewardSimple[]>([])
  const [tab, setTab] = useState<Tab>('missions')

  useEffect(() => {
    fetchChildren()
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

  const fetchIrlRewardsList = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('irl_rewards')
      .select('id, name, cost')
      .eq('parent_id', user.id)
    if (data) setIrlRewardsList(data)
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>

  return (
    <div>
      <ParentCreateChild onChildCreated={fetchChildren} />
      <ParentChildren children={children} onSelectChild={onSelectChild} onChildRemoved={fetchChildren} />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['missions', 'recompenses', 'exercices'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '2rem',
              border: 'none',
              background: tab === t ? '#2a9d8f' : '#f0f0f0',
              color: tab === t ? 'white' : '#555',
              cursor: 'pointer',
              fontWeight: tab === t ? 'bold' : 'normal',
              fontSize: '0.9rem',
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'missions' && (
        <>
          <ParentMissions children={children} irlRewardsList={irlRewardsList} />
          <ParentPendingPurchases />
        </>
      )}
      {tab === 'recompenses' && (
        <ParentIrlRewards children={children} onRewardsChanged={fetchIrlRewardsList} />
      )}
      {tab === 'exercices' && (
        <ParentExerciseHistory children={children} />
      )}
    </div>
  )
}
