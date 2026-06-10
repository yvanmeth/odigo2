import { useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { formatDate } from './helpers'
import type { IrlPurchase } from './types'

interface RewardsPortfolioProps {
  irlPurchases: IrlPurchase[]
}

export default function RewardsPortfolio({ irlPurchases }: RewardsPortfolioProps) {
  const [showHistory, setShowHistory] = useState(false)

  const validPurchases = irlPurchases.filter(p => p.status === 'valid')
  const usedPurchases = irlPurchases.filter(p => p.status === 'used')

  const renderCoupon = (purchase: IrlPurchase, used: boolean = false) => (
    <div
      key={purchase.id}
      style={{
        background: 'white', border: '2px dashed #2a9d8f', borderRadius: '0.75rem',
        padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        opacity: used ? 0.5 : 1,
      }}
    >
      <div>
        <div style={{ fontWeight: 'bold', color: '#333' }}>🎁 {purchase.reward_name}</div>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>
          Acheté le {formatDate(purchase.purchased_at)}
          {used && purchase.used_at && ` · Utilisé le ${formatDate(purchase.used_at)}`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ borderLeft: '1px dashed #ccc', alignSelf: 'stretch' }} />
        <span style={{ background: '#e9c46a', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {purchase.cost} Δ
        </span>
        <span style={{ background: '#f0faf8', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {used ? 'Utilisée' : '✓ Valable'}
        </span>
      </div>
    </div>
  )

  return (
    <div>
      <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>👛 Portefeuille</h3>

      {validPurchases.length === 0 ? (
        <EmptyState emoji="👛" title="Ton portefeuille est vide" subtitle="Achète des récompenses dans l'onglet Récompenses !" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {validPurchases.map(p => renderCoupon(p))}
        </div>
      )}

      {usedPurchases.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ padding: '0.5rem 1rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
          >
            {showHistory ? '▲' : '▼'} Voir l'historique ({usedPurchases.length})
          </button>
          {showHistory && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {usedPurchases.map(p => renderCoupon(p, true))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
