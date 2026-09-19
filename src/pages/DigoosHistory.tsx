import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Delta } from '../components/Delta'
import { EmptyState } from '../components/EmptyState'

const PAGE_SIZE = 20

interface Transaction {
  id: string
  amount: number
  balance_after: number
  source: string
  label: string
  created_at: string
}

interface MonthGroup {
  key: string
  label: string
  items: Transaction[]
}

const formatDateTime = (isoStr: string): string => {
  const d = new Date(isoStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month} à ${hours}h${minutes}`
}

const toMonthKey = (isoStr: string): string => isoStr.slice(0, 7)

const toMonthLabel = (key: string): string => {
  const [year, month] = key.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  const s = d.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const mergeIntoGroups = (existing: MonthGroup[], newItems: Transaction[]): MonthGroup[] => {
  const map = new Map<string, MonthGroup>(existing.map(g => [g.key, { ...g, items: [...g.items] }]))
  for (const item of newItems) {
    const key = toMonthKey(item.created_at)
    const group = map.get(key)
    if (group) {
      group.items.push(item)
    } else {
      map.set(key, { key, label: toMonthLabel(key), items: [item] })
    }
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
}

export default function DigoosHistory() {
  const [groups, setGroups] = useState<MonthGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set())

  const fetchPage = async (pageOffset: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('digoos_transactions')
      .select('id, amount, balance_after, source, label, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1)

    if (!data) { setLoading(false); setLoadingMore(false); return }

    if (pageOffset === 0 && data.length > 0) {
      setOpenMonths(new Set([toMonthKey(data[0].created_at)]))
    }

    setGroups(prev => mergeIntoGroups(prev, data))
    setHasMore(data.length === PAGE_SIZE)
    setOffset(pageOffset + data.length)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage(0)
  }, [])

  const loadMore = () => {
    setLoadingMore(true)
    fetchPage(offset)
  }

  const toggleMonth = (key: string) => {
    setOpenMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#aaa', padding: '2rem' }}>Chargement…</div>
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        emoji="📭"
        title="Aucun mouvement pour l'instant"
        subtitle="Tes gains et dépenses en Δ apparaîtront ici dès ta première activité."
      />
    )
  }

  return (
    <div>
      {groups.map(group => {
        const open = openMonths.has(group.key)
        return (
          <div key={group.key} style={{ marginBottom: '0.75rem' }}>
            <button
              onClick={() => toggleMonth(group.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '0.6rem 0.75rem',
                background: 'var(--color-background)', border: 'none', borderRadius: '0.5rem',
                cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                color: 'var(--color-primary)', textAlign: 'left',
              }}
            >
              <span>{group.label}</span>
              <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{open ? '▲' : '▼'}</span>
            </button>

            {open && (
              <div style={{ borderRadius: '0 0 0.5rem 0.5rem', overflow: 'hidden', border: '1px solid #f0f0f0', borderTop: 'none' }}>
                {group.items.map((tx, i) => (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.55rem 0.75rem',
                      borderBottom: i < group.items.length - 1 ? '1px solid #f5f5f5' : 'none',
                      background: 'white',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: '#aaa', whiteSpace: 'nowrap', minWidth: '86px' }}>
                      {formatDateTime(tx.created_at)}
                    </div>
                    <div style={{ flex: 1, fontSize: '0.85rem', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.label}
                    </div>
                    <div style={{
                      fontWeight: 'bold', fontSize: '0.88rem', whiteSpace: 'nowrap',
                      color: tx.amount >= 0 ? '#2a9d8f' : '#e63946',
                      display: 'flex', alignItems: 'center', gap: '0.2rem',
                    }}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount} <Delta size={13} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              padding: '0.5rem 1.5rem', background: '#2a9d8f', color: 'white',
              border: 'none', borderRadius: '0.5rem', cursor: loadingMore ? 'default' : 'pointer',
              fontSize: '0.9rem', fontWeight: 'bold', opacity: loadingMore ? 0.7 : 1,
            }}
          >
            {loadingMore ? 'Chargement…' : 'Voir plus'}
          </button>
        </div>
      )}
    </div>
  )
}
