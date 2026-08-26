import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Delta } from '../../components/Delta'
import { EmptyState } from '../../components/EmptyState'
import { useToast } from '../../components/Toast'
import { formatDateDMY } from '../../lib/dates'
import { formatDate, getCurrentWeekKey } from './helpers'
import { addDigoos } from '../../services/digoos'
import type { IrlPurchase } from './types'

type PortfolioTab = 'irl' | 'cartes'
type WheelSegment = number | 'échange' | 'relancer'

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

interface SellCardInfo {
  userCardId: string
  cardId: string
  cardName: string
  imageUrl: string
  quantity: number
}

interface AvailableCard {
  id: string
  name: string
  image_url: string
  stock_remaining: number
}

interface RewardsPortfolioProps {
  irlPurchases: IrlPurchase[]
}

const WHEEL_BASE: WheelSegment[] = [
  100, 200, 300, 100, 400, 200, 500,
  600, 100, 700, 200, 800, 900, 1000,
  1100, 'échange', 'relancer',
]

const segColor = (s: WheelSegment): string => {
  if (s === 'échange') return '#e9c46a'
  if (s === 'relancer' || s === 2000) return '#5c6bc0'
  if (s === 100) return '#e63946'
  if (s === 200) return '#e76f51'
  if (s === 300) return '#4CAF50'
  if (s === 400) return '#2a9d8f'
  if (s === 500) return '#264653'
  if (s === 600) return '#43aa8b'
  if (s === 700) return '#f4a261'
  if (s === 800) return '#9c27b0'
  if (s === 900) return '#2196F3'
  if (s === 1000) return '#FF5722'
  return '#795548'
}

const segLabel = (s: WheelSegment): string => {
  if (s === 'échange') return '↔'
  if (s === 'relancer') return '↻'
  return String(s)
}

const renderValuePills = (cardValues?: CardValue[]) => (
  cardValues && cardValues.length > 0 && (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.4rem' }}>
      {cardValues.map(cv => (
        <span key={cv.value.id} style={{
          background: cv.value.category.color,
          color: cv.value.category.color === '#e9c46a' ? '#333' : 'white',
          fontSize: '0.7rem', padding: '0.15rem 0.5rem',
          borderRadius: '1rem', fontWeight: 'bold',
        }}>
          {cv.value.name}
        </span>
      ))}
    </div>
  )
)

export default function RewardsPortfolio({ irlPurchases }: RewardsPortfolioProps) {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<PortfolioTab>('irl')
  const [showHistory, setShowHistory] = useState(false)
  const [userCards, setUserCards] = useState<UserCardData[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [currentAvatarCardId, setCurrentAvatarCardId] = useState<string | null>(null)

  // Sell states
  const [showSellModal, setShowSellModal] = useState(false)
  const [sellCard, setSellCard] = useState<SellCardInfo | null>(null)
  const [sellMode, setSellMode] = useState<'wheel' | 'fixed' | null>(null)
  const [wheelResult, setWheelResult] = useState<WheelSegment | null>(null)
  const [wheelSpinning, setWheelSpinning] = useState(false)
  const [wheelAngle, setWheelAngle] = useState(0)
  const [rerollCount, setRerollCount] = useState(0)
  const [canSellWheel, setCanSellWheel] = useState(false)
  const [canSellFixed, setCanSellFixed] = useState(false)
  const [showExchangePicker, setShowExchangePicker] = useState(false)
  const [availableCards, setAvailableCards] = useState<AvailableCard[]>([])

  const segments: WheelSegment[] = WHEEL_BASE.map(s => s === 'relancer' && rerollCount >= 2 ? 2000 : s)

  const fetchUserCards = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = user.id

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
      .eq('id', targetId)
      .single()
    if (profile) setCurrentAvatarCardId(profile.avatar_card_id)

    setLoadingCards(false)
  }

  const setAsAvatar = async (cardId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = user.id
    await supabase.from('profiles').update({ avatar_card_id: cardId }).eq('id', targetId)
    setCurrentAvatarCardId(cardId)
    showToast('Avatar mis à jour !')
  }

  const checkSellConditions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = user.id

    const today = new Date().toISOString().split('T')[0]
    const currentWeek = getCurrentWeekKey()

    const { data: prog } = await supabase
      .from('progress')
      .select('last_card_sale_date, last_card_sale_week, digoos_this_week')
      .eq('user_id', targetId)
      .single()

    const { count: todayActivity } = await supabase
      .from('daily_activity')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetId)
      .eq('date', today)

    const isDayActive = (todayActivity || 0) > 0
    const wheelUsedToday = prog?.last_card_sale_date === today
    setCanSellWheel(isDayActive && !wheelUsedToday)

    const isWeekActive = (prog?.digoos_this_week || 0) >= 300
    const fixedUsedThisWeek = prog?.last_card_sale_week === currentWeek
    setCanSellFixed(isWeekActive && !fixedUsedThisWeek)
  }

  const spinWheel = (effectiveRerollCount = rerollCount) => {
    if (wheelSpinning) return
    setWheelSpinning(true)
    setWheelResult(null)

    const segs: WheelSegment[] = WHEEL_BASE.map(s =>
      s === 'relancer' && effectiveRerollCount >= 2 ? 2000 : s
    )
    const N = segs.length
    const winningIndex = Math.floor(Math.random() * N)
    const winningResult = segs[winningIndex]

    const segmentAngle = 360 / N
    // Angle du centre du segment gagnant (depuis 12h, sens horaire)
    const segmentCenterAngle = (winningIndex + 0.5) * segmentAngle
    // Rotation totale requise pour que ce centre soit sous l'indicateur (en haut)
    const target = 360 - segmentCenterAngle
    const currentMod = wheelAngle % 360
    const diff = (target - currentMod + 360) % 360
    const finalAngle = diff + 360 * 5

    setWheelAngle(prev => prev + finalAngle)

    setTimeout(() => {
      setWheelSpinning(false)
      setWheelResult(winningResult)
    }, 3000)
  }

  const executeSale = async (amount: number) => {
    if (!sellCard) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = user.id

    if (sellCard.quantity > 1) {
      await supabase.from('user_cards')
        .update({ quantity: sellCard.quantity - 1 })
        .eq('id', sellCard.userCardId)
    } else {
      await supabase.from('user_cards')
        .delete()
        .eq('id', sellCard.userCardId)
    }

    await addDigoos(amount, 'reward')

    await supabase.from('card_sales').insert({
      user_id: targetId,
      card_id: sellCard.cardId,
      card_name: sellCard.cardName,
      sale_type: sellMode === 'wheel' ? 'wheel' : 'fixed',
      amount,
    })

    const today = new Date().toISOString().split('T')[0]
    const currentWeek = getCurrentWeekKey()
    const updates: Record<string, string> = {}
    if (sellMode === 'wheel') updates.last_card_sale_date = today
    if (sellMode === 'fixed') updates.last_card_sale_week = currentWeek

    await supabase.from('progress').update(updates).eq('user_id', targetId)

    setShowSellModal(false)
    setSellCard(null)
    fetchUserCards()
    showToast(`+${amount} Δ obtenus !`)
  }

  const executeExchange = async (chosenCard: AvailableCard) => {
    if (!sellCard) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const targetId = user.id

    if (sellCard.quantity > 1) {
      await supabase.from('user_cards')
        .update({ quantity: sellCard.quantity - 1 })
        .eq('id', sellCard.userCardId)
    } else {
      await supabase.from('user_cards')
        .delete()
        .eq('id', sellCard.userCardId)
    }

    const { data: existingCard } = await supabase
      .from('user_cards')
      .select('id, quantity')
      .eq('user_id', targetId)
      .eq('card_id', chosenCard.id)
      .maybeSingle()

    if (existingCard) {
      await supabase.from('user_cards')
        .update({ quantity: existingCard.quantity + 1 })
        .eq('id', existingCard.id)
    } else {
      await supabase.from('user_cards').insert({ user_id: targetId, card_id: chosenCard.id, quantity: 1 })
      await supabase.from('cards').update({ stock_remaining: chosenCard.stock_remaining - 1 }).eq('id', chosenCard.id)
    }

    await supabase.from('card_sales').insert({
      user_id: targetId,
      card_id: sellCard.cardId,
      card_name: sellCard.cardName,
      sale_type: 'exchange',
      amount: 0,
    })

    const today = new Date().toISOString().split('T')[0]
    await supabase.from('progress').update({ last_card_sale_date: today }).eq('user_id', targetId)

    setShowSellModal(false)
    setSellCard(null)
    setShowExchangePicker(false)
    fetchUserCards()
    showToast(`Carte échangée contre ${chosenCard.name} !`)
  }

  useEffect(() => {
    fetchUserCards()
  }, [])

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
        {purchase.reward_id === null && (
          <div style={{ fontSize: '0.75rem', color: '#bbb', marginTop: '0.2rem' }}>(récompense archivée)</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ borderLeft: '1px dashed #ccc', alignSelf: 'stretch' }} />
        <span style={{ background: '#e9c46a', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {purchase.cost} <Delta size={16} />
        </span>
        <span style={{ background: 'var(--color-background)', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          {used ? 'Utilisée' : '✓ Valable'}
        </span>
      </div>
    </div>
  )

  const tabStyle = (tab: PortfolioTab): React.CSSProperties => ({
    padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
    background: activeTab === tab ? '#2a9d8f' : 'var(--color-border)',
    color: activeTab === tab ? 'white' : '#2a9d8f',
    fontWeight: activeTab === tab ? 'bold' : 'normal', fontSize: '0.9rem',
  })

  const renderWheel = () => {
    const N = segments.length
    const cx = 110, cy = 110, r = 100, textR = 68

    return (
      <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto' }}>
        <div style={{
          position: 'absolute', top: '-2px', left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '1.4rem', lineHeight: 1, zIndex: 10,
          color: '#333', textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}>▼</div>
        <svg
          width="220" height="220" viewBox="0 0 220 220"
          style={{
            transform: `rotate(${wheelAngle}deg)`,
            transition: wheelSpinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            display: 'block',
          }}
        >
          {segments.map((seg, i) => {
            const startRad = (i / N * 360 - 90) * Math.PI / 180
            const endRad = ((i + 1) / N * 360 - 90) * Math.PI / 180
            const x1 = cx + r * Math.cos(startRad)
            const y1 = cy + r * Math.sin(startRad)
            const x2 = cx + r * Math.cos(endRad)
            const y2 = cy + r * Math.sin(endRad)
            const midDeg = (i + 0.5) / N * 360 - 90
            const midRad = midDeg * Math.PI / 180
            const tx = cx + textR * Math.cos(midRad)
            const ty = cy + textR * Math.sin(midRad)
            const color = segColor(seg as WheelSegment)
            return (
              <g key={i}>
                <path
                  d={`M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`}
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={tx.toFixed(2)}
                  y={ty.toFixed(2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${(midDeg + 90).toFixed(2)}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`}
                  fill="white"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {segLabel(seg as WheelSegment)}
                </text>
              </g>
            )
          })}
          <circle cx={cx} cy={cy} r="14" fill="white" stroke="#ddd" strokeWidth="2" />
        </svg>
      </div>
    )
  }

  const canSell = true

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
                style={{ padding: '0.5rem 1rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
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
              subtitle="Rends-toi dans la Boutique pour découvrir les cartes disponibles !"
            />
          ) : (
            <div>
              {userCards.map(uc => (
                <div key={uc.id} style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid #f5f5f5', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ width: '40%', position: 'relative' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      {uc.quantity > 1 && (
                        <img
                          src={`/cards/${uc.card.image_url}`}
                          draggable={false}
                          onContextMenu={e => e.preventDefault()}
                          style={{
                            position: 'absolute', top: '8px', left: '8px',
                            width: '100%', height: '100%',
                            borderRadius: 12, objectFit: 'cover', objectPosition: 'top',
                            zIndex: 0, filter: 'brightness(0.85)',
                          }}
                        />
                      )}
                      <img
                        src={`/cards/${uc.card.image_url}`}
                        draggable={false}
                        onContextMenu={e => e.preventDefault()}
                        className="card-image"
                        style={{ width: '100%', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', position: 'relative', zIndex: 1 }}
                      />
                      {uc.quantity > 1 && (
                        <div style={{
                          position: 'absolute', top: '-8px', right: '-8px',
                          background: '#2a9d8f', color: 'white', borderRadius: '50%',
                          width: '28px', height: '28px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 'bold',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 2,
                        }}>
                          x{uc.quantity}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ width: '60%' }}>
                    <div style={{ fontWeight: 'bold', color: '#2a9d8f', fontSize: '1.1rem' }}>{uc.card.name}</div>
                    {uc.card.species?.name && (
                      <span style={{ display: 'inline-block', background: 'var(--color-background)', color: '#2a9d8f', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.4rem' }}>
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
                            marginTop: '0.5rem', padding: '0.3rem 0.75rem',
                            background: isCurrentAvatar ? 'var(--color-background)' : '#2a9d8f',
                            color: isCurrentAvatar ? '#2a9d8f' : 'white',
                            border: isCurrentAvatar ? '1px solid #2a9d8f' : 'none',
                            borderRadius: '0.5rem', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 'bold', width: '100%',
                          }}
                        >
                          {isCurrentAvatar ? '✓ Avatar actuel' : '🖼️ Utiliser comme avatar'}
                        </button>
                      )
                    })()}
                    {canSell && (
                      <button
                        onClick={async () => {
                          await checkSellConditions()
                          setSellCard({
                            userCardId: uc.id,
                            cardId: uc.card.id,
                            cardName: uc.card.name,
                            imageUrl: uc.card.image_url,
                            quantity: uc.quantity,
                          })
                          setSellMode(null)
                          setWheelResult(null)
                          setRerollCount(0)
                          setShowExchangePicker(false)
                          setShowSellModal(true)
                        }}
                        style={{
                          marginTop: '0.4rem', padding: '0.3rem 0.75rem',
                          background: 'white', color: '#e76f51',
                          border: '1px solid #e76f51', borderRadius: '0.5rem',
                          cursor: 'pointer', fontSize: '0.8rem',
                          fontWeight: 'bold', width: '100%',
                        }}
                      >
                        💰 Vendre
                      </button>
                    )}
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

      {/* === MODAL DE VENTE === */}
      {showSellModal && sellCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', maxWidth: '420px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>

            {/* === Phase Exchange Picker === */}
            {showExchangePicker ? (
              <>
                <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem', textAlign: 'center' }}>↔ Choisir une carte</h3>
                <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
                  Sélectionne la carte que tu veux obtenir en échange.
                </p>
                {availableCards.length === 0 ? (
                  <p style={{ color: '#888', textAlign: 'center' }}>Aucune carte disponible pour l'échange.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {availableCards.map(card => (
                      <div
                        key={card.id}
                        onClick={() => executeExchange(card)}
                        style={{ cursor: 'pointer', textAlign: 'center', border: '2px solid #f0f0f0', borderRadius: '0.75rem', padding: '0.5rem', transition: 'border-color 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#2a9d8f')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0f0f0')}
                      >
                        <img
                          src={`/cards/${card.image_url}`}
                          draggable={false}
                          onContextMenu={e => e.preventDefault()}
                          style={{ width: '100%', borderRadius: '0.5rem' }}
                        />
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#333', marginTop: '0.3rem' }}>{card.name}</div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowExchangePicker(false)}
                  style={{ marginTop: '1rem', width: '100%', padding: '0.6rem', background: 'var(--color-border)', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  ← Retour
                </button>
              </>
            ) : sellMode === null ? (
              /* === Phase 1 — Choix du mode === */
              <>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#333' }}>💰 Vendre {sellCard.cardName}</div>
                  <img
                    src={`/cards/${sellCard.imageUrl}`}
                    draggable={false}
                    onContextMenu={e => e.preventDefault()}
                    style={{ width: '80px', borderRadius: '0.5rem', margin: '0.75rem auto', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div
                    onClick={() => canSellWheel && setSellMode('wheel')}
                    style={{
                      border: canSellWheel ? '2px solid #2a9d8f' : '2px solid #ddd',
                      borderRadius: '0.75rem', padding: '1rem',
                      opacity: canSellWheel ? 1 : 0.5,
                      cursor: canSellWheel ? 'pointer' : 'not-allowed',
                      background: canSellWheel ? '#f0faf8' : '#fafafa',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>🎡 Roue de la fortune</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      {canSellWheel
                        ? 'Une fois par jour · Jour actif requis'
                        : 'Disponible demain ou quand ton jour sera actif'}
                    </div>
                  </div>
                  <div
                    onClick={() => canSellFixed && setSellMode('fixed')}
                    style={{
                      border: canSellFixed ? '2px solid #e9c46a' : '2px solid #ddd',
                      borderRadius: '0.75rem', padding: '1rem',
                      opacity: canSellFixed ? 1 : 0.5,
                      cursor: canSellFixed ? 'pointer' : 'not-allowed',
                      background: canSellFixed ? '#fffdf0' : '#fafafa',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', color: '#b8860b', marginBottom: '0.25rem' }}>💎 Prix fixe — 300 <Delta size={14} /></div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      {canSellFixed
                        ? 'Une fois par semaine · Semaine active requise'
                        : 'Disponible quand ta semaine sera active (300 Δ gagnés)'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowSellModal(false)}
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--color-border)', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  Annuler
                </button>
              </>
            ) : sellMode === 'wheel' ? (
              /* === Phase 2A — Roue === */
              <>
                <h3 style={{ color: '#2a9d8f', textAlign: 'center', marginBottom: '1rem' }}>🎡 Roue de la fortune</h3>
                {renderWheel()}

                {/* Avant lancer */}
                {wheelResult === null && !wheelSpinning && (
                  <>
                    <button
                      onClick={() => spinWheel()}
                      style={{
                        marginTop: '1rem', width: '100%', padding: '0.75rem',
                        background: '#2a9d8f', color: 'white', border: 'none',
                        borderRadius: '0.5rem', cursor: 'pointer',
                        fontWeight: 'bold', fontSize: '1rem',
                      }}
                    >
                      🎡 Lancer la roue
                    </button>
                    <button
                      onClick={() => setSellMode(null)}
                      style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: 'var(--color-border)', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      ← Retour
                    </button>
                  </>
                )}

                {/* Pendant rotation */}
                {wheelSpinning && (
                  <p style={{ textAlign: 'center', marginTop: '1rem', color: '#888', fontSize: '0.9rem' }}>
                    La roue tourne...
                  </p>
                )}

                {/* Après résultat */}
                {wheelResult !== null && !wheelSpinning && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    {typeof wheelResult === 'number' && (
                      <>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.5rem' }}>
                          🎉 Tu obtiens {wheelResult} <Delta size={20} /> !
                        </div>
                        <button
                          onClick={() => executeSale(wheelResult)}
                          style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ✓ Confirmer la vente
                        </button>
                      </>
                    )}
                    {wheelResult === 'échange' && (
                      <>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#b8860b', marginBottom: '0.5rem' }}>
                          ↔ Tu peux échanger ta carte !
                        </div>
                        <button
                          onClick={async () => {
                            const today = new Date().toISOString().split('T')[0]
                            const { data } = await supabase.from('cards').select('id, name, image_url, stock_remaining').lte('available_from', today).gt('stock_remaining', 0)
                            setAvailableCards(data || [])
                            setShowExchangePicker(true)
                          }}
                          style={{ width: '100%', padding: '0.75rem', background: '#e9c46a', color: '#333', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ↔ Choisir une carte
                        </button>
                      </>
                    )}
                    {wheelResult === 'relancer' && (
                      <>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#5c6bc0', marginBottom: '0.5rem' }}>
                          ↻ Lance à nouveau !
                        </div>
                        <button
                          onClick={() => {
                            const newCount = rerollCount + 1
                            setRerollCount(newCount)
                            setWheelResult(null)
                            spinWheel(newCount)
                          }}
                          style={{ width: '100%', padding: '0.75rem', background: '#5c6bc0', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ↻ Relancer {rerollCount >= 1 ? '(dernier essai)' : ''}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* === Phase 2B — Prix fixe === */
              <>
                <h3 style={{ color: '#b8860b', textAlign: 'center', marginBottom: '1rem' }}>💎 Prix fixe</h3>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <img
                    src={`/cards/${sellCard.imageUrl}`}
                    draggable={false}
                    onContextMenu={e => e.preventDefault()}
                    style={{ width: '80px', borderRadius: '0.5rem', margin: '0 auto 0.75rem', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                  />
                  <div style={{ fontSize: '1.1rem', color: '#333' }}>
                    Vendre <strong>{sellCard.cardName}</strong> pour{' '}
                    <strong style={{ color: '#b8860b' }}>300 <Delta size={16} /></strong> ?
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setSellMode(null)}
                    style={{ flex: 1, padding: '0.6rem', background: 'var(--color-border)', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => executeSale(300)}
                    style={{ flex: 1, padding: '0.6rem', background: '#e9c46a', color: '#333', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ✓ Confirmer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
