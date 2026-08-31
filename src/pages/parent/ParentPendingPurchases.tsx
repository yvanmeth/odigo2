import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/Toast'
import { formatISODate } from '../../lib/dates'
import type { PendingPurchase } from './types'

export default function ParentPendingPurchases() {
  const { showToast } = useToast()
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([])
  const [markingUsedId, setMarkingUsedId] = useState<string | null>(null)

  useEffect(() => { fetchPendingPurchases() }, [])

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

  return (
    <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
      <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>⏳ Récompenses en attente</h3>

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
                  {p.profiles?.first_name || 'Enfant'} · Acheté le {formatISODate(p.purchased_at)}
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
  )
}
