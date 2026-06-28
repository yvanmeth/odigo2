import { useState, useEffect } from 'react'
import { Delta } from '../../components/Delta'
import { EmptyState } from '../../components/EmptyState'
import { supabase } from '../../lib/supabase'
import { deductDigoos } from '../../services/digoos'
import { formatDateDMY } from '../../lib/dates'
import { useToast } from '../../components/Toast'
import type { IrlReward, Progress, RewardTab } from './types'

interface Theme {
  id: string
  name: string
  price: number
  colors: {
    primary: string
    background: string
    accent: string
    border: string
  }
}

const THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'ODIGO Classic',
    price: 0,
    colors: { primary: '#2a9d8f', background: '#f0faf8', accent: '#e9c46a', border: '#e0f0ee' },
  },
  {
    id: 'foret',
    name: 'Forêt',
    price: 50,
    colors: { primary: '#2d6a4f', background: '#f4f9f4', accent: '#95d5b2', border: '#d4edda' },
  },
  {
    id: 'ocean',
    name: 'Océan',
    price: 50,
    colors: { primary: '#1a6b8a', background: '#f0f7fa', accent: '#48cae4', border: '#cce9f5' },
  },
  {
    id: 'sunset',
    name: 'Coucher de soleil',
    price: 50,
    colors: { primary: '#e76f51', background: '#fff8f5', accent: '#f4a261', border: '#fde0d4' },
  },
  {
    id: 'minuit',
    name: 'Minuit',
    price: 50,
    colors: { primary: '#5c6bc0', background: '#f5f5ff', accent: '#9fa8da', border: '#e0e0f5' },
  },
]

type BoutiqueView = 'menu' | 'irl' | 'cartes' | 'divertissement' | 'themes'

interface RewardsBoutiqueProps {
  progress: Progress | null
  onDigoosUpdate: () => void
  irlRewards: IrlReward[]
  onNavigate?: (page: string, exercise?: string) => void
  activeTab: RewardTab
}

export default function RewardsBoutique({
  progress, onDigoosUpdate, irlRewards, onNavigate, activeTab,
}: RewardsBoutiqueProps) {
  const { showToast } = useToast()
  const [view, setView] = useState<BoutiqueView>('menu')
  const [loadingRewardId, setLoadingRewardId] = useState<string | null>(null)
  const [expandedReward, setExpandedReward] = useState<string | null>(null)
  const [activeThemeId, setActiveThemeId] = useState<string>(() => localStorage.getItem('odigo_theme') || 'classic')
  const [cardsOwned, setCardsOwned] = useState(0)
  const [cardsTotal, setCardsTotal] = useState(0)

  useEffect(() => {
    setView('menu')
  }, [activeTab])

  useEffect(() => {
    fetchCardCounts()
  }, [progress?.user_id])

  const fetchCardCounts = async () => {
    const targetId = progress?.user_id
    if (!targetId) return
    const [ownedRes, totalRes] = await Promise.all([
      supabase.from('user_cards').select('id', { count: 'exact', head: true }).eq('user_id', targetId),
      supabase.from('cards').select('id', { count: 'exact', head: true }),
    ])
    setCardsOwned(ownedRes.count || 0)
    setCardsTotal(totalRes.count || 0)
  }

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

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement
    root.style.setProperty('--color-primary', theme.colors.primary)
    root.style.setProperty('--color-background', theme.colors.background)
    root.style.setProperty('--color-accent', theme.colors.accent)
    root.style.setProperty('--color-border', theme.colors.border)
    localStorage.setItem('odigo_theme', theme.id)
    localStorage.setItem('odigo_theme_color', theme.colors.primary)
    localStorage.setItem('odigo_theme_bg', theme.colors.background)
    localStorage.setItem('odigo_theme_accent', theme.colors.accent)
    localStorage.setItem('odigo_theme_border', theme.colors.border)
    setActiveThemeId(theme.id)
  }

  const menuCardStyle = (color: string): React.CSSProperties => ({
    background: 'white', borderRadius: '1rem',
    padding: '1.5rem', textAlign: 'center',
    border: `2px solid ${color}`,
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    transition: 'transform 0.15s ease',
  })

  const menuHoverProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = 'translateY(-2px)' },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = 'translateY(0)' },
  }

  const backButton = (
    <button
      onClick={() => setView('menu')}
      style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: 'var(--color-primary)', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
    >
      ← Retour
    </button>
  )

  if (view === 'menu') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        {irlRewards.length > 0 && (
          <div onClick={() => setView('irl')} style={menuCardStyle('#2a9d8f')} {...menuHoverProps}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎁</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>Récompenses IRL</div>
            <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.3rem' }}>Récompenses créées par tes parents</div>
          </div>
        )}
        <div onClick={() => onNavigate?.('exercises', 'cartes')} style={menuCardStyle('#e76f51')} {...menuHoverProps}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎴</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>Cartes OΔIGO</div>
          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.3rem' }}>{cardsOwned} / {cardsTotal} cartes dans ta collection</div>
        </div>
        <div onClick={() => setView('divertissement')} style={menuCardStyle('#5c6bc0')} {...menuHoverProps}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎮</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>Divertissement</div>
          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.3rem' }}>Jeux et histoires interactives</div>
        </div>
        <div onClick={() => setView('themes')} style={menuCardStyle('#e9c46a')} {...menuHoverProps}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎨</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>Thèmes</div>
          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.3rem' }}>Personnalise ton interface</div>
        </div>
      </div>
    )
  }

  if (view === 'irl') {
    return (
      <div>
        {backButton}
        <h3 style={{ color: 'var(--color-primary)', marginBottom: '0.25rem', fontSize: '1.1rem' }}>🎁 Récompenses IRL</h3>
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
                          background: 'none', border: 'none', color: 'var(--color-primary)',
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
                    <div style={{ display: 'inline-block', background: 'var(--color-accent)', color: 'white', fontWeight: 'bold', borderRadius: '1rem', padding: '0.2rem 0.75rem', fontSize: '0.85rem' }}>
                      {r.cost} <Delta size={16} />
                    </div>
                    <button
                      onClick={() => canBuy && !isLoading && handleObtenir(r)}
                      disabled={!canBuy || isLoading}
                      style={{
                        width: '100%', marginTop: '0.25rem', padding: '0.6rem',
                        background: canBuy ? 'var(--color-primary)' : '#ddd',
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
    )
  }

  if (view === 'divertissement') {
    return (
      <div>
        {backButton}
        <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem', fontSize: '1.1rem' }}>🎮 Divertissement</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⚔️</span>
            <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.95rem' }}>Jeu des allumettes</div>
            <button
              onClick={() => onNavigate?.('exercises', 'allumettes')}
              style={{ alignSelf: 'flex-start', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '1rem', padding: '0.4rem 0.8rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}
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
              style={{ alignSelf: 'flex-start', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '1rem', padding: '0.4rem 0.8rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem' }}
            >
              <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Jouer</span>
              <span style={{ color: '#ffffff', fontSize: '0.85rem' }}>1 <Delta size={14} /> par choix</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {backButton}
      <h3 style={{ color: 'var(--color-primary)', marginBottom: '1rem', fontSize: '1.1rem' }}>🎨 Thèmes</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {THEMES.map(theme => {
          const isActive = activeThemeId === theme.id
          return (
            <div
              key={theme.id}
              onClick={() => applyTheme(theme)}
              style={{
                borderRadius: '0.75rem',
                overflow: 'hidden',
                border: isActive ? '3px solid #2a9d8f' : '2px solid #e0e0e0',
                cursor: 'pointer',
              }}
            >
              {/* Aperçu miniature du thème */}
              <div style={{
                background: theme.colors.background,
                padding: '0.75rem',
                height: '80px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}>
                <div style={{ background: theme.colors.primary, height: '12px', borderRadius: '4px', width: '30%' }} />
                <div style={{
                  background: '#fff',
                  border: `1px solid ${theme.colors.border}`,
                  height: '20px', borderRadius: '4px', flex: 1,
                }} />
                <div style={{ background: theme.colors.accent, height: '8px', borderRadius: '4px', width: '50%' }} />
              </div>
              <div style={{
                padding: '0.5rem 0.75rem',
                background: 'white',
                borderTop: `2px solid ${theme.colors.border}`,
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{theme.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {theme.price === 0 ? 'Gratuit' : `${theme.price} Δ`}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
