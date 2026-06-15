import { useEffect, useState } from 'react'
import { Delta } from '../components/Delta'
import { supabase } from '../lib/supabase'
import { deductDigoos } from '../services/digoos'
import { useToast } from '../components/Toast'

const PRIMARY = '#2a9d8f'
const DRAW_PRICE = 1000
const DRAW_STEPS = 25

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
  available_from: string
  card_values?: CardValue[]
  species?: { name: string } | null
}

interface UserCardRow {
  id: string
  card_id: string
  quantity: number
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
  const [userCards, setUserCards] = useState<UserCardRow[]>([])
  const [digoos, setDigoos] = useState(0)
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [drawingState, setDrawingState] = useState<'idle' | 'drawing' | 'revealed'>('idle')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [drawnCard, setDrawnCard] = useState<CardData | null>(null)
  const [modalFlipped, setModalFlipped] = useState(false)
  const [isNewCard, setIsNewCard] = useState(false)
  const [drawnQuantity, setDrawnQuantity] = useState(1)

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
      supabase.from('user_cards').select('id, card_id, quantity').eq('user_id', user.id),
      supabase.from('progress').select('digoos').eq('user_id', user.id).single(),
    ])

    setCards(cardsData || [])
    setUserCards(userCardsData || [])
    setDigoos(progressData?.digoos || 0)

    if (initial) {
      const initialFlipped: Record<string, boolean> = {}
      const ownedSet = new Set((userCardsData || []).map(uc => uc.card_id))
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

  useEffect(() => {
    if (drawingState !== 'revealed') return
    const t = setTimeout(() => setModalFlipped(true), 150)
    return () => clearTimeout(t)
  }, [drawingState])

  const revealCard = async (card: CardData) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existing = userCards.find(uc => uc.card_id === card.id)
    if (existing) {
      await supabase.from('user_cards')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id)
      setIsNewCard(false)
      setDrawnQuantity(existing.quantity + 1)
    } else {
      await supabase.from('user_cards').insert({
        user_id: user.id,
        card_id: card.id,
        purchased_price: DRAW_PRICE,
        quantity: 1,
      })
      await supabase.from('cards')
        .update({ stock_remaining: card.stock_remaining - 1 })
        .eq('id', card.id)
      setIsNewCard(true)
      setDrawnQuantity(1)
    }

    setFlipped(prev => ({ ...prev, [card.id]: true }))
    setDrawnCard(card)
    setDrawingState('revealed')
    await fetchData()
  }

  const animateDraw = (availableCards: CardData[], targetCard: CardData) => {
    const targetIndex = availableCards.findIndex(c => c.id === targetCard.id)
    let step = 0

    const tick = () => {
      setHighlightedIndex(step % availableCards.length)
      step++

      if (step < DRAW_STEPS) {
        const progress = step / DRAW_STEPS
        const delay = 80 + progress * progress * 400

        if (step === DRAW_STEPS - 1) {
          setTimeout(() => {
            setHighlightedIndex(targetIndex)
            setTimeout(() => revealCard(targetCard), 600)
          }, delay)
        } else {
          setTimeout(tick, delay)
        }
      }
    }
    tick()
  }

  const handleDraw = async () => {
    if (digoos < DRAW_PRICE || drawingState !== 'idle') return

    const today = new Date().toISOString().slice(0, 10)
    const available = cards.filter(c => c.available_from <= today && c.stock_remaining > 0)
    if (available.length === 0) {
      showToast('Aucune carte disponible pour le tirage.', 'error')
      return
    }

    const drawn = available[Math.floor(Math.random() * available.length)]

    await deductDigoos(DRAW_PRICE)
    setDrawingState('drawing')
    animateDraw(available, drawn)
  }

  const handleContinue = () => {
    setDrawingState('idle')
    setDrawnCard(null)
    setHighlightedIndex(-1)
    setModalFlipped(false)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
        Chargement...
      </div>
    )
  }

  const ownedCardIds = new Set(userCards.map(uc => uc.card_id))
  const ownedCount = cards.filter(c => ownedCardIds.has(c.id)).length

  const today = new Date().toISOString().slice(0, 10)
  const availableForDraw = cards.filter(c => c.available_from <= today && c.stock_remaining > 0)
  const highlightedCardId = drawingState === 'drawing' && highlightedIndex >= 0
    ? availableForDraw[highlightedIndex]?.id
    : null

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
        {displayCards.map(card => {
          const mystery = isMysteryCard(card)
          const owned = !mystery && ownedCardIds.has(card.id)
          const isFlipped = !!flipped[card.id]
          const isHighlighted = !mystery && card.id === highlightedCardId
          const quantity = !mystery ? (userCards.find(uc => uc.card_id === card.id)?.quantity || 1) : 1

          return (
            <div key={card.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              position: 'relative', padding: '0.4rem', borderRadius: '12px', boxSizing: 'border-box',
              border: isHighlighted ? '3px solid #e9c46a' : '3px solid transparent',
              transform: isHighlighted ? 'scale(1.05)' : 'scale(1)',
              boxShadow: isHighlighted ? '0 0 20px rgba(233,196,106,0.6)' : 'none',
              transition: 'all 0.1s ease',
            }}>
              <div
                className={`card-flip${isFlipped ? ' flipped' : ''}`}
                style={{ width: '160px', height: '224px', position: 'relative' }}
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

              {!mystery && owned && quantity > 1 && (
                <div style={{
                  position: 'absolute', top: '-8px', right: '-8px',
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: PRIMARY, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 'bold',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                }}>
                  x{quantity}
                </div>
              )}

              {!mystery && owned && (
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.9rem' }}>{card.name}</div>
              )}

              {!mystery && !owned && renderValuePills(card.card_values)}

              {!mystery && !owned && (
                <div style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>
                  {card.stock_remaining === 0 ? 'Épuisé' : `${card.stock_remaining}/${card.stock_total} disponibles`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button
          onClick={handleDraw}
          disabled={digoos < DRAW_PRICE || drawingState !== 'idle'}
          style={{
            padding: '0.75rem 1.5rem',
            background: digoos >= DRAW_PRICE && drawingState === 'idle' ? PRIMARY : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: digoos >= DRAW_PRICE && drawingState === 'idle' ? 'pointer' : 'default',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          {drawingState === 'drawing'
            ? '🎲 Tirage en cours...'
            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>🎲 Tirage au sort — {DRAW_PRICE} <Delta size={16} /></span>}
        </button>
        <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
          Une carte au hasard parmi toutes celles disponibles. Les doublons sont possibles !
        </p>
      </div>

      {drawingState === 'revealed' && drawnCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem',
        }}>
          <div
            className={`card-flip${modalFlipped ? ' flipped' : ''}`}
            style={{ width: '220px', height: '308px', position: 'relative' }}
          >
            <div className="card-front">
              <img
                src="/cards/card-back.png"
                alt="Carte mystère"
                className="card-image"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div className="card-back">
              <img
                src={`/cards/${drawnCard.image_url}`}
                alt={drawnCard.name}
                className="card-image"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          </div>

          <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', margin: 0 }}>
            {isNewCard ? '🎉 Nouvelle carte !' : `✨ Tu as déjà cette carte ! (x${drawnQuantity})`}
          </p>
          <p style={{ color: 'white', fontSize: '1rem', margin: 0 }}>{drawnCard.name}</p>

          <button
            onClick={handleContinue}
            style={{ padding: '0.6rem 1.5rem', background: PRIMARY, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold' }}
          >
            Continuer
          </button>
        </div>
      )}
    </div>
  )
}
