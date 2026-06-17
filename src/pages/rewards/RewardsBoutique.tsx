import { useState } from 'react'
import { Delta } from '../../components/Delta'
import { EmptyState } from '../../components/EmptyState'
import { supabase } from '../../lib/supabase'
import { deductDigoos } from '../../services/digoos'
import { formatDateDMY } from '../../lib/dates'
import { useToast } from '../../components/Toast'
import { formatDate } from './helpers'
import type { IrlReward, ShopItem, UserPurchase, Progress } from './types'

interface RewardsBoutiqueProps {
  progress: Progress | null
  onDigoosUpdate: () => void
  irlRewards: IrlReward[]
  parentIds: string[]
  shopItems: ShopItem[]
  purchases: UserPurchase[]
  gender: 'M' | 'F' | 'X' | null
  onNavigate?: (page: string, exercise?: string) => void
}

export default function RewardsBoutique({
  progress, onDigoosUpdate, irlRewards, parentIds, shopItems, purchases, gender, onNavigate,
}: RewardsBoutiqueProps) {
  const { showToast } = useToast()
  const [loadingRewardId, setLoadingRewardId] = useState<string | null>(null)
  const [loadingPurchaseId, setLoadingPurchaseId] = useState<string | null>(null)
  const [expandedReward, setExpandedReward] = useState<string | null>(null)
  const [digoolandSection, setDigoolandSection] = useState<'divertissement' | 'personnaliser' | null>(null)

  const handleObtenir = async (reward: IrlReward) => {
    setLoadingRewardId(reward.id)
    const { data: { user } } = await supabase.auth.getUser()
    await deductDigoos(reward.cost)
    if (user) {
      await supabase.from('irl_purchases').insert({
        child_id: user.id,
        reward_id: reward.id,
        reward_name: reward.name,
        cost: reward.cost,
        status: 'valid',
      })
      await supabase.from('irl_rewards').update({ stock: reward.stock - 1 }).eq('id', reward.id)
    }
    showToast('🎁 Récompense obtenue ! Demande-la à tes parents.')
    onDigoosUpdate()
    setLoadingRewardId(null)
  }

  const handlePurchase = async (item: ShopItem) => {
    if (!!loadingPurchaseId) return
    if ((progress?.digoos || 0) < item.price) {
      showToast('Digoos insuffisants', 'error')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setLoadingPurchaseId(item.id)
    await deductDigoos(item.price)
    const now = new Date()
    const expiresAt = item.duration_days
      ? new Date(now.getTime() + item.duration_days * 86400000).toISOString()
      : null
    await supabase.from('user_purchases').insert({
      user_id: user.id,
      item_id: item.id,
      purchased_at: now.toISOString(),
      expires_at: expiresAt,
      active: false,
    })
    showToast('✨ Acheté !')
    onDigoosUpdate()
    setLoadingPurchaseId(null)
  }

  const handleActivateTheme = async (purchase: UserPurchase, color: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const themeItemIds = shopItems.filter(i => i.type === 'theme').map(i => i.id)
    if (themeItemIds.length > 0) {
      await supabase.from('user_purchases').update({ active: false }).eq('user_id', user.id).in('item_id', themeItemIds)
    }
    await supabase.from('user_purchases').update({ active: true }).eq('id', purchase.id)
    localStorage.setItem('odigo_theme_color', color)
    window.location.reload()
  }

  const getPurchase = (itemId: string) => purchases.find(p => p.item_id === itemId)
  const isExpiredPurchase = (p: UserPurchase) => !!p.expires_at && new Date(p.expires_at) < new Date()

  const getItemName = (item: ShopItem): string => {
    if (item.type === 'title') {
      if (gender === 'M') return item.name_masculine || item.name
      if (gender === 'F') return item.name_feminine || item.name
      return item.name_masculine && item.name_feminine
        ? item.name_masculine + ' / ' + item.name_feminine
        : item.name
    }
    return item.name
  }

  const themes = shopItems.filter(i => i.type === 'theme')
  const titles = shopItems.filter(i => i.type === 'title')

  const renderShopItem = (item: ShopItem) => {
    const purchase = getPurchase(item.id)
    const expired = purchase ? isExpiredPurchase(purchase) : false
    const canAfford = (progress?.digoos || 0) >= item.price
    const isLoading = loadingPurchaseId === item.id

    let statusNode: React.ReactNode = null

    if (item.price === 0) {
      statusNode = <span style={{ fontSize: '0.8rem', color: '#2a9d8f', fontWeight: 'bold' }}>✓ Actif</span>
    } else if (!purchase) {
      statusNode = (
        <button
          onClick={() => handlePurchase(item)}
          disabled={!canAfford || !!isLoading}
          style={{
            padding: '0.4rem 0.75rem', border: 'none', borderRadius: '0.5rem',
            background: canAfford ? '#2a9d8f' : '#ddd',
            color: canAfford ? 'white' : '#aaa',
            cursor: canAfford ? 'pointer' : 'default',
            fontSize: '0.8rem', fontWeight: 'bold',
          }}
        >
          {isLoading ? '...' : canAfford ? <span>Obtenir — {item.price} <Delta size={16} /></span> : 'Digoos insuffisants'}
        </button>
      )
    } else if (expired) {
      statusNode = (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#e63946' }}>Expiré</span>
          <button
            onClick={() => handlePurchase(item)}
            disabled={!canAfford || !!isLoading}
            style={{
              padding: '0.3rem 0.6rem', border: 'none', borderRadius: '0.4rem',
              background: canAfford ? '#2a9d8f' : '#ddd',
              color: canAfford ? 'white' : '#aaa',
              cursor: canAfford ? 'pointer' : 'default',
              fontSize: '0.78rem',
            }}
          >
            {isLoading ? '...' : 'Renouveler'}
          </button>
        </div>
      )
    } else if (item.type === 'title') {
      statusNode = <span style={{ fontSize: '0.8rem', color: '#2a9d8f', fontWeight: 'bold' }}>✓ Obtenu</span>
    } else if (purchase.active) {
      statusNode = (
        <span style={{ fontSize: '0.8rem', color: '#2a9d8f', fontWeight: 'bold' }}>
          ✓ Actif{purchase.expires_at ? ` jusqu'au ${formatDate(purchase.expires_at)}` : ''}
        </span>
      )
    } else {
      statusNode = (
        <button
          onClick={() => item.color && handleActivateTheme(purchase, item.color)}
          style={{
            padding: '0.4rem 0.75rem', border: 'none', borderRadius: '0.5rem',
            background: '#e9c46a', color: 'white',
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold',
          }}
        >
          Activer
        </button>
      )
    }

    return (
      <div key={item.id} style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {item.type === 'theme' && item.color && (
          <div style={{ width: '36px', height: '36px', borderRadius: '0.5rem', background: item.color }} />
        )}
        {item.type === 'title' && <span style={{ fontSize: '1.4rem' }}>🏷️</span>}
        <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>{getItemName(item)}</div>
        {item.description && <div style={{ fontSize: '0.82rem', color: '#888' }}>{item.description}</div>}
        {item.price > 0 && (
          <div style={{ fontSize: '0.8rem', color: '#e9c46a', fontWeight: 'bold' }}>{item.price} <Delta size={16} /></div>
        )}
        {statusNode}
      </div>
    )
  }

  return (
    <div>
      {/* Récompenses IRL */}
      {parentIds.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ color: '#2a9d8f', marginBottom: '0.25rem', fontSize: '1.1rem' }}>🎁 Récompenses IRL</h3>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>Voici les récompenses actuellement disponibles.</p>

          {irlRewards.length === 0 ? (
            <EmptyState emoji="🎁" title="Aucune récompense disponible" subtitle="Demande à tes parents de créer des récompenses dans leur espace." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {irlRewards.map(r => {
                const canAfford = (progress?.digoos || 0) >= r.cost
                const inStock = r.stock > 0
                const canBuy = canAfford && inStock
                const isLoading = loadingRewardId === r.id
                return (
                  <div key={r.id} style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem' }}>{r.name}</div>
                    {r.description && (
                      <>
                        <div style={{
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: expandedReward === r.id ? 'unset' : 2,
                          WebkitBoxOrient: 'vertical',
                          fontSize: '0.85rem',
                          color: '#555',
                        }}>
                          {r.description}
                        </div>
                        {r.description.length > 80 && (
                          <button onClick={() => setExpandedReward(
                            expandedReward === r.id ? null : r.id
                          )} style={{
                            background: 'none', border: 'none', color: '#2a9d8f',
                            cursor: 'pointer', fontSize: '0.8rem', padding: 0,
                          }}>
                            {expandedReward === r.id ? 'Voir moins ▲' : 'Voir plus ▼'}
                          </button>
                        )}
                      </>
                    )}
                    {r.stock > 1 && <span style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.25rem', display: 'block' }}>{r.stock} disponibles</span>}
                    {r.stock === 1 && <span style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.25rem', display: 'block' }}>1 disponible</span>}
                    {r.stock === 0 && <span style={{ fontSize: '0.78rem', color: '#e63946', marginTop: '0.25rem', display: 'block' }}>Plus de stock</span>}
                    {r.valid_until && <div style={{ fontSize: '0.8rem', color: '#888' }}>Valable jusqu'au {formatDateDMY(r.valid_until)}</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'inline-block', background: '#e9c46a', color: 'white', fontWeight: 'bold', borderRadius: '1rem', padding: '0.2rem 0.75rem', fontSize: '0.85rem' }}>
                        {r.cost} <Delta size={16} />
                      </div>
                      <button
                        onClick={() => canBuy && !isLoading && handleObtenir(r)}
                        disabled={!canBuy || isLoading}
                        style={{
                          width: '100%', marginTop: '0.25rem', padding: '0.6rem',
                          background: canBuy ? '#2a9d8f' : '#ddd',
                          color: canBuy ? 'white' : '#aaa',
                          border: 'none', borderRadius: '0.5rem',
                          cursor: canBuy && !isLoading ? 'pointer' : 'default',
                          fontSize: '0.9rem', fontWeight: 'bold',
                        }}
                      >
                        {isLoading ? '...' : canBuy ? <span>Obtenir — {r.cost} <Delta size={16} /></span> : 'Digoos insuffisants'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Digooland */}
      <div>
        <h3 style={{ color: '#2a9d8f', marginBottom: '1rem', fontSize: '1.1rem' }}>✨ Digooland</h3>

        {digoolandSection === null && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <div
              onClick={() => setDigoolandSection('divertissement')}
              style={{
                background: 'white', borderRadius: '1rem', padding: '1.5rem',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
                borderTop: '4px solid #e76f51', cursor: 'pointer', transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎮</div>
              <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem', marginBottom: '0.5rem' }}>Divertissement</div>
              <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>Jeux, histoires et plus à venir...</div>
            </div>
            <div
              onClick={() => setDigoolandSection('personnaliser')}
              style={{
                background: 'white', borderRadius: '1rem', padding: '1.5rem',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
                borderTop: '4px solid #2a9d8f', cursor: 'pointer', transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎨</div>
              <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem', marginBottom: '0.5rem' }}>Personnaliser</div>
              <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>Thèmes, titres et avatars</div>
            </div>
          </div>
        )}

        {digoolandSection === 'divertissement' && (
          <div>
            <button
              onClick={() => setDigoolandSection(null)}
              style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ← Retour
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>⚔️</span>
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Jeu des allumettes</div>
                <button
                  onClick={() => onNavigate?.('exercises', 'allumettes')}
                  style={{ alignSelf: 'flex-start', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '1rem', padding: '0.4rem 0.8rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}
                >
                  <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Jouer</span>
                  <span style={{ color: '#ffffff', fontSize: '0.85rem' }}>1 <Delta size={14} /></span>
                </button>
              </div>
              <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📖</span>
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Histoire interactive</div>
                <button
                  onClick={() => onNavigate?.('exercises', 'histoire')}
                  style={{ alignSelf: 'flex-start', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '1rem', padding: '0.4rem 0.8rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}
                >
                  <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Jouer</span>
                  <span style={{ color: '#ffffff', fontSize: '0.85rem' }}>1 <Delta size={14} /> par choix</span>
                </button>
              </div>
              <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🃏</span>
                <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Cartes à collectionner</div>
                <button
                  onClick={() => onNavigate?.('exercises', 'cartes')}
                  style={{ alignSelf: 'flex-start', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '1rem', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                >
                  Voir la collection
                </button>
              </div>
            </div>
          </div>
        )}

        {digoolandSection === 'personnaliser' && (
          <div>
            <button
              onClick={() => setDigoolandSection(null)}
              style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ← Retour
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🎨 Personnalise ton Odigo</h4>
              {themes.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {themes.map(renderShopItem)}
                </div>
              ) : (
                <p style={{ color: '#aaa' }}>Aucun thème disponible pour l'instant.</p>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🏷️ Titres</h4>
              {titles.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                  {titles.map(renderShopItem)}
                </div>
              ) : (
                <p style={{ color: '#aaa' }}>Aucun titre disponible pour l'instant.</p>
              )}
            </div>

            <div>
              <h4 style={{ color: '#555', marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '0.95rem' }}>🐾 Avatars</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.6, cursor: 'default' }}>
                  <span style={{ fontSize: '1.4rem' }}>🐾</span>
                  <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Avatar Odigo</div>
                  <span style={{ display: 'inline-block', background: '#e0e0e0', color: '#888', borderRadius: '1rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', alignSelf: 'flex-start' }}>
                    Bientôt disponible
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
