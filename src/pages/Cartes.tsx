import { useEffect, useState } from 'react'
import { Delta } from '../components/Delta'
import { supabase } from '../lib/supabase'
import { deductDigoos } from '../services/digoos'
import { useToast } from '../components/Toast'

const PRIMARY = '#2a9d8f'
const CARD_PRICE = 1000

interface CardValue {
  value: {
    id: string
    name: string
    category: { name: string; color: string }
  }
}

interface CardData {
  id: string
  number: number
  name: string
  image_url: string
  stock_remaining: number
  stock_total: number
  card_values?: CardValue[]
  species?: { name: string } | null
}

type DisplayCard = CardData | { id: string; mystery: true }

const isMysteryCard = (card: DisplayCard): card is { id: string; mystery: true } =>
  'mystery' in card && card.mystery === true

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

export default function Cartes() {
  const { showToast } = useToast()
  const [cards, setCards] = useState<CardData[]>([])
  const [ownedCardIds, setOwnedCardIds] = useState<Set<string>>(new Set())
  const [digoos, setDigoos] = useState(0)
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  const fetchData = async (initial = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: cardsData }, { data: userCardsData }, { data: progressData }] = await Promise.all([
      supabase.from('cards').select(`
        *,
        card_values (
          value:values (
            id, name,
            category:value_categories (name, color)
          )
        ),
        species:species (name)
      `).order('number'),
      supabase.from('user_cards').select('card_id').eq('user_id', user.id),
      supabase.from('progress').select('digoos').eq('user_id', user.id).single(),
    ])

    const ownedSet = new Set((userCardsData || []).map(uc => uc.card_id))

    setCards(cardsData || [])
    setOwnedCardIds(ownedSet)
    setDigoos(progressData?.digoos || 0)

    if (initial) {
      const initialFlipped: Record<string, boolean> = {}
      ;(cardsData || []).forEach((c: CardData) => {
        if (ownedSet.has(c.id)) initialFlipped[c.id] = true
      })
      setFlipped(initialFlipped)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData(true)
  }, [])

  const handleObtenir = async (card: CardData) => {
    if (digoos < CARD_PRICE || purchasing) return
    setPurchasing(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setPurchasing(false)
      return
    }

    await deductDigoos(CARD_PRICE)
    await supabase.from('user_cards').insert({ user_id: user.id, card_id: card.id })

    await supabase
      .from('cards')
      .update({ stock_remaining: card.stock_remaining - 1 })
      .eq('id', card.id)

    setTimeout(() => {
      setFlipped(prev => ({ ...prev, [card.id]: true }))
    }, 100)

    showToast('🎴 Carte obtenue !')
    await fetchData()
    setPurchasing(false)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
        Chargement...
      </div>
    )
  }

  const ownedCount = cards.filter(c => ownedCardIds.has(c.id)).length

  const displayCards: DisplayCard[] = [
    ...cards,
    ...Array(Math.max(0, 12 - cards.length)).fill(null).map((_, i) => ({ id: `mystery-${i}`, mystery: true as const })),
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <h2 style={{ color: PRIMARY, margin: 0 }}>🎴 Cartes à collectionner</h2>
          <p style={{ color: '#888', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
            {ownedCount} / {cards.length} cartes obtenues
          </p>
        </div>
        <span style={{ background: '#fff8e0', color: '#b8860b', padding: '0.3rem 0.75rem', borderRadius: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
          {digoos} <Delta size={16} />
        </span>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#aaa', textAlign: 'center', marginBottom: '1.5rem' }}>
        D'autres cartes OΔIGO arriveront bientôt ⏳
      </p>

      <div className="cartes-grid">
        {displayCards.map((card, i) => {
          const mystery = isMysteryCard(card)
          const owned = !mystery && ownedCardIds.has(card.id)
          const purchasable = !mystery && i === 0 && !owned
          const isFlipped = !!flipped[card.id]

          return (
            <div key={card.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div
                className={`card-flip${isFlipped ? ' flipped' : ''}`}
                style={{
                  width: '160px',
                  height: '224px',
                  position: 'relative',
                  cursor: purchasable ? 'pointer' : 'default',
                }}
              >
                <div className="card-front">
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src="/cards/card-back.png"
                      alt="Carte mystère"
                      draggable={false}
                      onContextMenu={e => e.preventDefault()}
                      className="card-image"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1, userSelect: 'none' }} onContextMenu={e => e.preventDefault()} />
                  </div>
                </div>
                {!mystery && (
                  <div className="card-back">
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <img
                        src={`/cards/${card.image_url}`}
                        alt={card.name || 'Carte'}
                        draggable={false}
                        onContextMenu={e => e.preventDefault()}
                        className="card-image"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, zIndex: 1, userSelect: 'none' }} onContextMenu={e => e.preventDefault()} />
                    </div>
                  </div>
                )}
              </div>

              {!mystery && owned && (
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>{card.name}</div>
              )}

              {!mystery && !owned && renderValuePills(card.card_values)}

              {purchasable && (
                <>
                  <div style={{
                    fontSize: '0.8rem', color: '#888',
                    textAlign: 'center', marginBottom: '0.4rem'
                  }}>
                    {card.stock_remaining}/{card.stock_total} disponibles
                  </div>
                  <button
                    onClick={() => handleObtenir(card)}
                    disabled={digoos < CARD_PRICE || purchasing}
                    style={{
                      padding: '0.5rem 1rem',
                      background: digoos >= CARD_PRICE ? PRIMARY : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: digoos >= CARD_PRICE && !purchasing ? 'pointer' : 'default',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {digoos >= CARD_PRICE
                      ? <span>Obtenir — {CARD_PRICE} <Delta size={14} /></span>
                      : <span><Delta size={14} /> insuffisants</span>}
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
