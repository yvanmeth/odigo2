import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Delta } from '../../components/Delta'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import { formatDateDMY } from '../../lib/dates'
import { formatDate } from './helpers'
import type { IrlPurchase } from './types'

type PortfolioTab = 'irl' | 'cartes'

interface CardValue {
  value: {
    id: string
    name: string
    category: { name: string; color: string }
  }
}

interface CardInfo {
  id: string
  number: number
  name: string
  image_url: string
  price?: number
  super_pouvoir?: string | null
  quote?: string | null
  card_values?: CardValue[]
  species?: { name: string } | null
}

interface UserCardData {
  id: string
  purchased_at: string
  purchased_price?: number
  quantity: number
  card: CardInfo
}

interface RewardsPortfolioProps {
  irlPurchases: IrlPurchase[]
  userId?: string
}

const renderValuePills = (cardValues?: CardValue[]) => (
  cardValues && cardValues.length > 0 && (
    <div style={{
      display: 'flex', gap: '0.3rem',
      flexWrap: 'wrap', justifyContent: 'center',
      marginTop: '0.4rem'
    }}>
      {cardValues.map(cv => (
        <span key={cv.value.id} style={{
          background: cv.value.category.color,
          color: cv.value.category.color === '#e9c46a'
            ? '#333' : 'white',
          fontSize: '0.7rem',
          padding: '0.15rem 0.5rem',
          borderRadius: '1rem',
          fontWeight: 'bold',
        }}>
          {cv.value.name}
        </span>
      ))}
    </div>
  )
)

export default function RewardsPortfolio({ irlPurchases, userId }: RewardsPortfolioProps) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<PortfolioTab>('irl')
  const [showHistory, setShowHistory] = useState(false)
  const [userCards, setUserCards] = useState<UserCardData[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [currentAvatarCardId, setCurrentAvatarCardId] = useState<string | null>(null)

  const fetchUserCards = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = userId || user.id

    const { data } = await supabase
      .from('user_cards')
      .select(`
        *,
        card:cards (
          *,
          card_values (
            value:values (
              id, name,
              category:value_categories (name, color)
            )
          ),
          species:species (name)
        )
      `)
      .eq('user_id', targetId)
      .order('purchased_at', { ascending: false })

    if (data) setUserCards(data)

    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_card_id')
      .eq('id', user.id)
      .single()
    if (profile) setCurrentAvatarCardId(profile.avatar_card_id)

    setLoadingCards(false)
  }

  const setAsAvatar = async (cardId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ avatar_card_id: cardId }).eq('id', user.id)
    setCurrentAvatarCardId(cardId)
    showToast('Avatar mis à jour !')
  }

  useEffect(() => {
    fetchUserCards()
  }, [userId])

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
          {purchase.cost} <Delta size={16} />
        </span>
        <span style={{ background: '#f0faf8', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {used ? 'Utilisée' : '✓ Valable'}
        </span>
      </div>
    </div>
  )

  const tabStyle = (tab: PortfolioTab): React.CSSProperties => ({
    padding: '0.6rem 1.2rem',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    background: activeTab === tab ? '#2a9d8f' : '#e0f0ee',
    color: activeTab === tab ? 'white' : '#2a9d8f',
    fontWeight: activeTab === tab ? 'bold' : 'normal',
    fontSize: '0.9rem',
  })

  return (
    <div>
      <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>👛 Portefeuille</h3>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button style={tabStyle('irl')} onClick={() => setActiveTab('irl')}>🎁 Récompenses IRL</button>
        <button style={tabStyle('cartes')} onClick={() => setActiveTab('cartes')}>🎴 Mes cartes</button>
      </div>

      {activeTab === 'irl' && (
        <>
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
        </>
      )}

      {activeTab === 'cartes' && (
        <>
          {loadingCards ? (
            <p style={{ color: '#888' }}>Chargement...</p>
          ) : userCards.length === 0 ? (
            <EmptyState
              emoji="🎴"
              title="Aucune carte dans ta collection"
              subtitle="Rends-toi dans Digooland pour découvrir les cartes disponibles !"
            />
          ) : (
            <div>
              {userCards.map(uc => (
                <div key={uc.id} style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid #f5f5f5', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40%', position: 'relative' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      {uc.quantity > 1 && (
                        <div style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          width: '100%',
                          height: '100%',
                          borderRadius: 12,
                          background: '#e0f0ee',
                          border: '1px solid #2a9d8f',
                          zIndex: 0,
                        }} />
                      )}
                      <img
                        src={`/cards/${uc.card.image_url}`}
                        draggable={false}
                        onContextMenu={e => e.preventDefault()}
                        className="card-image"
                        style={{
                          width: '100%',
                          borderRadius: 12,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          position: 'relative',
                          zIndex: 1,
                        }}
                      />
                      {uc.quantity > 1 && (
                        <div style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          background: '#2a9d8f',
                          color: 'white',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          zIndex: 2,
                        }}>
                          x{uc.quantity}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ width: '60%' }}>
                    <div style={{ fontWeight: 'bold', color: '#2a9d8f', fontSize: '1.1rem' }}>{uc.card.name}</div>
                    {uc.card.species?.name && (
                      <span style={{ display: 'inline-block', background: '#f0faf8', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.4rem' }}>
                        {uc.card.species.name}
                      </span>
                    )}
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.4rem' }}>
                      Obtenue le {formatDateDMY(uc.purchased_at.slice(0, 10))}
                    </div>
                    {renderValuePills(uc.card.card_values)}
                    {uc.card.super_pouvoir && (
                      <div style={{ color: '#5c6bc0', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        ⚡ {uc.card.super_pouvoir}
                      </div>
                    )}
                    {(() => {
                      const isCurrentAvatar = currentAvatarCardId === uc.card.id
                      return (
                        <button
                          onClick={() => setAsAvatar(uc.card.id)}
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.3rem 0.75rem',
                            background: isCurrentAvatar ? '#f0faf8' : '#2a9d8f',
                            color: isCurrentAvatar ? '#2a9d8f' : 'white',
                            border: isCurrentAvatar ? '1px solid #2a9d8f' : 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            width: '100%',
                          }}
                        >
                          {isCurrentAvatar ? '✓ Avatar actuel' : '🖼️ Utiliser comme avatar'}
                        </button>
                      )
                    })()}
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#555' }}>
                      {uc.purchased_price != null && (
                        <span>Prix d'achat : {uc.purchased_price} <Delta size={14} /></span>
                      )}
                      {uc.card.price != null && (
                        <span>Valeur actuelle : {uc.card.price} <Delta size={14} /></span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
