import { useEffect, useState } from 'react'
import { Delta } from '../components/Delta'
import { supabase } from '../lib/supabase'
import { deductDigoos } from '../services/digoos'
import { useToast } from '../components/Toast'

const PRIMARY = '#2a9d8f'
const DRAW_PRICE = 1000

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
          color: cv.value.category.color === '#e9c46a' ? '#333' : 'white',
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
  const [drawModal, setDrawModal] = useState<{
    open: boolean
    phase: 'spinning' | 'flipping' | 'revealed'
    highlightedIndex: number
    drawnCard: CardData | null
    isNew: boolean
    newQuantity: number
  }>({
    open: false, phase: 'spinning',
    highlightedIndex: -1, drawnCard: null,
    isNew: false, newQuantity: 1,
  })

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

  useEffect(() => { fetchData(true) }, [])

  const startFlip = async (drawn: CardData) => {
    setDrawModal(prev => ({ ...prev, phase: 'flipping' }))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existing = userCards.find(uc => uc.card_id === drawn.id)
    const isNew = !existing
    const newQuantity = existing ? existing.quantity + 1 : 1

    if (existing) {
      await supabase.from('user_cards')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id)
    } else {
      await supabase.from('user_cards').insert({
        user_id: user.id,
        card_id: drawn.id,
        purchased_price: DRAW_PRICE,
        quantity: 1,
      })
      await supabase.from('cards')
        .update({ stock_remaining: drawn.stock_remaining - 1 })
        .eq('id', drawn.id)
    }

    setFlipped(prev => ({ ...prev, [drawn.id]: true }))

    setTimeout(() => {
      setDrawModal(prev => ({ ...prev, phase: 'revealed', isNew, newQuantity }))
      fetchData()
    }, 1200)
  }

  const startDraw = async () => {
    if (digoos < DRAW_PRICE || drawModal.open) return

    const today = new Date().toISOString().split('T')[0]
    const available = cards.filter(c => c.available_from <= today && c.stock_remaining > 0)

    if (available.length === 0) {
      showToast('Aucune carte disponible pour le tirage.', 'error')
      return
    }

    const drawn = available[Math.floor(Math.random() * available.length)]
    const targetIndex = Math.floor(Math.random() * 12)

    await deductDigoos(DRAW_PRICE)

    setDrawModal({ open: true, phase: 'spinning', highlightedIndex: 0, drawnCard: drawn, isNew: false, newQuantity: 1 })

    const totalSteps = 32
    let step = 0

    const tick = () => {
      const progress = step / totalSteps
      const delay = 50 + progress * progress * progress * 750

      setDrawModal(prev => ({ ...prev, highlightedIndex: step % 12 }))

      step++

      if (step < totalSteps - 1) {
        setTimeout(tick, delay)
      } else {
        setTimeout(() => {
          setDrawModal(prev => ({ ...prev, highlightedIndex: targetIndex }))
          setTimeout(() => startFlip(drawn), 1200)
        }, delay)
      }
    }
    tick()
  }

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Chargement...</div>
  }

  const ownedCardIds = new Set(userCards.map(uc => uc.card_id))
  const ownedCount = cards.filter(c => ownedCardIds.has(c.id)).length

  const displayCards: DisplayCard[] = [
    ...cards,
    ...Array(Math.max(0, 12 - cards.length)).fill(null).map((_, i) => ({ id: `mystery-${i}`, mystery: true as const })),
  ]

  const canDraw = digoos >= DRAW_PRICE && !drawModal.open

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

      <p style={{ fontSize: '0.82rem', color: '#aaa', textAlign: 'center', marginBottom: '1rem' }}>
        D'autres cartes OΔIGO arriveront bientôt ⏳
      </p>

      {/* Bouton tirage — AU-DESSUS de la grille */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={startDraw}
          disabled={!canDraw}
          style={{
            padding: '0.75rem 1.5rem',
            background: canDraw ? PRIMARY : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: canDraw ? 'pointer' : 'default',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            🎲 Tirage au sort — {DRAW_PRICE} <Delta size={16} />
          </span>
        </button>
        <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
          Une carte au hasard parmi toutes celles disponibles. Les doublons sont possibles !
        </p>
      </div>

      {/* Grille de collection */}
      <div className="cartes-grid">
        {displayCards.map(card => {
          const mystery = isMysteryCard(card)
          const owned = !mystery && ownedCardIds.has(card.id)
          const isFlipped = !!flipped[card.id]
          const quantity = !mystery ? (userCards.find(uc => uc.card_id === card.id)?.quantity || 1) : 1

          return (
            <div key={card.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
              position: 'relative', padding: '0.4rem', borderRadius: '12px', boxSizing: 'border-box',
              border: '3px solid transparent',
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

      {/* Modal de tirage */}
      {drawModal.open && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.92)', zIndex: 1000,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '1.5rem',
        }}>

          {/* Phase spinning et flipping — grille 4×3 */}
          {drawModal.phase !== 'revealed' && (
            <>
              <div style={{ color: 'white', fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                🎲 Tirage en cours...
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 70px)', gap: '8px',
              }}>
                {Array.from({ length: 12 }, (_, idx) => {
                  const isHighlighted = idx === drawModal.highlightedIndex
                  const isFlipping = drawModal.phase === 'flipping' && isHighlighted

                  return (
                    <div
                      key={idx}
                      style={{
                        width: '70px', height: '98px',
                        borderRadius: '8px', overflow: 'hidden',
                        position: 'relative',
                        boxShadow: isHighlighted ? '0 0 24px rgba(233,196,106,1)' : 'none',
                        transform: isHighlighted ? 'scale(1.12)' : 'scale(1)',
                        border: isHighlighted ? '3px solid #e9c46a' : '3px solid transparent',
                        transition: 'all 0.06s ease',
                        zIndex: isHighlighted ? 2 : 1,
                        boxSizing: 'border-box',
                      }}
                    >
                      {isFlipping && drawModal.drawnCard ? (
                        <div style={{ perspective: '600px', width: '100%', height: '100%' }}>
                          <img
                            className="draw-card-flip"
                            src={`/cards/${drawModal.drawnCard.image_url}`}
                            style={{
                              width: '100%', height: '100%',
                              borderRadius: '5px', objectFit: 'cover',
                              backfaceVisibility: 'hidden',
                            }}
                          />
                        </div>
                      ) : (
                        <img
                          src="/cards/card-back.png"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Phase revealed — carte en grand */}
          {drawModal.phase === 'revealed' && drawModal.drawnCard && (
            <div className="draw-card-reveal" style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '1rem',
            }}>
              <img
                src={`/cards/${drawModal.drawnCard.image_url}`}
                alt={drawModal.drawnCard.name}
                style={{
                  width: '200px',
                  height: '280px',
                  borderRadius: '16px',
                  objectFit: 'cover',
                  boxShadow: '0 0 60px rgba(233,196,106,0.5)',
                }}
              />
              <div style={{
                color: 'white', fontWeight: 'bold',
                fontSize: '1.3rem', textAlign: 'center',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}>
                {drawModal.drawnCard.name}
              </div>
              <div style={{
                padding: '0.4rem 1rem',
                borderRadius: '1rem',
                fontWeight: 'bold', fontSize: '0.9rem',
                background: drawModal.isNew ? '#2a9d8f' : '#e9c46a',
                color: 'white',
              }}>
                {drawModal.isNew
                  ? '🎉 Nouvelle carte !'
                  : `✨ Tu l'as déjà ! (x${drawModal.newQuantity})`
                }
              </div>
              <button
                onClick={() => setDrawModal(prev => ({
                  ...prev, open: false, phase: 'spinning',
                  highlightedIndex: -1, drawnCard: null,
                }))}
                style={{
                  marginTop: '0.5rem',
                  background: 'white', color: '#2a9d8f',
                  border: 'none', borderRadius: '0.75rem',
                  padding: '0.75rem 2rem',
                  fontWeight: 'bold', fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Continuer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
