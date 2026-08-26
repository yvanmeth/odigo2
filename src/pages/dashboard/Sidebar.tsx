import { useState, useEffect } from 'react'
import { Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import ChildSelector from './ChildSelector'
import { navItems, type Child } from './types'
import { Delta } from '../../components/Delta'
import { supabase } from '../../lib/supabase'
import { restoreParentSession, getParentProtection, verifyParentPin } from '../../lib/sessionUtils'

const PRIMARY = 'var(--color-primary)'

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  activePage: string
  activeExercise: string | null
  onNavigate: (page: string, exercise?: string) => void
  isParent: boolean
  children: Child[]
  firstName: string
  activeTitle: string | null
  digoos: number
  userId: string
  onSignOut: () => void
  isMobile: boolean
  mobileMenuOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({
  collapsed, onToggle, activePage, onNavigate,
  isParent, children,
  firstName, activeTitle, digoos, userId, onSignOut,
  isMobile, mobileMenuOpen, onMobileClose,
}: SidebarProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })

  const [avatarCard, setAvatarCard] = useState<{ image_url: string } | null>(null)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnInput, setReturnInput] = useState('')
  const [returnError, setReturnError] = useState('')

  const handleReturnClick = () => {
    const protection = getParentProtection()
    if (protection === 'none') {
      restoreParentSession()
    } else {
      setShowReturnModal(true)
      setReturnInput('')
      setReturnError('')
    }
  }

  const handleReturnSubmit = async () => {
    const protection = getParentProtection()
    if (protection === 'pin') {
      if (verifyParentPin(returnInput)) {
        setShowReturnModal(false)
        restoreParentSession()
      } else {
        setReturnError('Code PIN incorrect')
      }
    } else if (protection === 'password') {
      const parentToken = localStorage.getItem('odigo_parent_access_token')
      if (!parentToken) return
      const payload = JSON.parse(atob(parentToken.split('.')[1]))
      const parentEmail = payload.email
      const { error } = await supabase.auth.signInWithPassword({
        email: parentEmail,
        password: returnInput,
      })
      if (!error) {
        localStorage.removeItem('odigo_parent_access_token')
        localStorage.removeItem('odigo_parent_refresh_token')
        window.location.reload()
      } else {
        setReturnError('Mot de passe incorrect')
      }
    }
  }

  const returnModal = showReturnModal && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '320px', width: '90%', textAlign: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔒</div>
        <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>Retour au compte parent</h3>
        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
          {getParentProtection() === 'pin' ? 'Saisis ton code PIN à 4 chiffres' : 'Saisis ton mot de passe'}
        </p>
        <input
          type="password"
          value={returnInput}
          onChange={e => setReturnInput(e.target.value)}
          maxLength={getParentProtection() === 'pin' ? 4 : 100}
          placeholder={getParentProtection() === 'pin' ? '••••' : 'Mot de passe'}
          autoFocus
          style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e0f0ee', fontSize: '1rem', textAlign: 'center', boxSizing: 'border-box' }}
          onKeyDown={e => e.key === 'Enter' && handleReturnSubmit()}
        />
        {returnError && <div style={{ color: '#e63946', fontSize: '0.8rem', marginTop: '0.5rem' }}>{returnError}</div>}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button onClick={() => setShowReturnModal(false)} style={{ flex: 1, padding: '0.6rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={handleReturnSubmit} style={{ flex: 1, padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )

  useEffect(() => {
    const fetchAvatarCard = async () => {
      if (!userId) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_card_id')
        .eq('id', userId)
        .single()
      if (profile?.avatar_card_id) {
        const { data: card } = await supabase
          .from('cards')
          .select('image_url')
          .eq('id', profile.avatar_card_id)
          .single()
        if (card) setAvatarCard(card)
      } else {
        setAvatarCard(null)
      }
    }
    fetchAvatarCard()
  }, [userId])

  // ── Mobile : overlay + panneau latéral ────────────────────────────────────
  if (isMobile) {
    if (!mobileMenuOpen) return null

    const navButton = (id: string, icon: React.ReactNode, label: string, color = 'var(--color-sidebar-text)', activeColor = PRIMARY, activeBg = 'var(--color-background)', activeBorder = PRIMARY) => (
      <button
        key={id}
        onClick={() => { onNavigate(id); onMobileClose() }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
          padding: '0.75rem 1rem',
          background: activePage === id ? activeBg : 'none',
          border: 'none',
          borderLeft: activePage === id ? `3px solid ${activeBorder}` : '3px solid transparent',
          cursor: 'pointer',
          color: activePage === id ? activeColor : color,
          fontWeight: activePage === id ? 'bold' : 'normal',
          fontSize: '0.9rem', textAlign: 'left',
        }}
      >
        {icon}
        {label}
      </button>
    )

    return (
      <>
        {/* Overlay sombre */}
        <div
          onClick={onMobileClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 499 }}
        />

        {/* Panneau latéral */}
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: '280px', background: 'var(--color-sidebar)',
          zIndex: 500, display: 'flex', flexDirection: 'column',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
          overflowY: 'auto',
        }}>
          {/* Header avec logo + bouton fermer */}
          <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)' }}>
            <img src="/logo-full.svg" alt="ODIGO" style={{ height: '28px', objectFit: 'contain' }} />
            <button
              onClick={onMobileClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: '1.2rem', padding: '0.25rem', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Avatar (toujours en mode étendu) */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
            {avatarCard ? (
              <div style={{ width: '54px', height: '76px', borderRadius: '8px', overflow: 'hidden', margin: '0 auto 0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                <img src={`/cards/${avatarCard.image_url}`} alt="Avatar" draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
              </div>
            ) : (
              <div style={{ width: '54px', height: '76px', borderRadius: '8px', background: 'linear-gradient(135deg, #2a9d8f, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 auto 0.5rem', boxShadow: '0 2px 8px rgba(42,157,143,0.3)' }}>
                {getInitials(firstName || 'U')}
              </div>
            )}
            {firstName && <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333', marginBottom: '0.1rem' }}>{firstName}</div>}
            {activeTitle && <div style={{ fontSize: '0.75rem', color: PRIMARY, fontStyle: 'italic', marginBottom: '0.1rem' }}>{activeTitle}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', marginTop: '0.5rem', padding: '0.3rem 0.75rem', background: '#fff8e0', borderRadius: '1rem', fontSize: '0.85rem', color: '#b8860b', fontWeight: 'bold' }}>
              {digoos.toLocaleString('fr-CH')} <Delta size={16} />
            </div>
          </div>

          {/* Sélecteur enfant ou retour compte parent */}
          {!!localStorage.getItem('odigo_parent_access_token') ? (
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
              <button
                onClick={handleReturnClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none', borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  color: 'var(--color-sidebar-text)',
                  cursor: 'pointer', width: '100%',
                  fontSize: '0.9rem',
                }}
              >
                ← Revenir au compte parent
              </button>
            </div>
          ) : isParent && (
            <ChildSelector children={children} />
          )}

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '0.5rem 0', display: 'flex', flexDirection: 'column' }}>
            {isParent && navButton('parent', <Users size={18} />, 'Espace parent', '#e9c46a', '#e9c46a', '#fff8e0', '#e9c46a')}
            {navItems.filter(i => i.id !== 'apropos' && !(i.id === 'missions' && isParent)).map(item => navButton(item.id, item.icon, item.label))}
            <div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0.5rem 0.75rem' }} />
              {navItems.filter(i => i.id === 'apropos').map(item => navButton(item.id, item.icon, item.label))}
              <button
                onClick={() => { onSignOut(); onMobileClose() }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#e63946', fontSize: '0.9rem' }}
              >
                <LogOut size={18} />
                Se déconnecter
              </button>
            </div>
          </nav>
        </div>
        {returnModal}
      </>
    )
  }

  // ── Desktop : comportement actuel inchangé ────────────────────────────────
  return (
    <div style={{
      width: collapsed ? '60px' : '220px',
      background: 'var(--color-sidebar)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      minHeight: '100vh',
      boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
    }}>

      <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)' }}>
        {!collapsed && <img src="/logo-full.svg" alt="ODIGO" style={{ height: '28px', objectFit: 'contain' }} />}
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: '1.1rem', padding: '0.25rem' }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {collapsed ? (
        <div style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          {avatarCard ? (
            <div style={{ width: '44px', height: '62px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', flexShrink: 0 }}>
              <img src={`/cards/${avatarCard.image_url}`} alt="Avatar" draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          ) : (
            <div style={{ width: '44px', height: '62px', borderRadius: '8px', background: 'linear-gradient(135deg, #2a9d8f, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 2px 8px rgba(42,157,143,0.3)', flexShrink: 0 }}>
              {getInitials(firstName || 'U')[0]}
            </div>
          )}
          <div style={{ fontSize: '0.85rem', color: '#b8860b', fontWeight: 'bold' }}>{digoos.toLocaleString('fr-CH')} <Delta size={14} /></div>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>
          {avatarCard ? (
            <div style={{ width: '54px', height: '76px', borderRadius: '8px', overflow: 'hidden', margin: '0 auto 0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', flexShrink: 0 }}>
              <img src={`/cards/${avatarCard.image_url}`} alt="Avatar" draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          ) : (
            <div style={{ width: '54px', height: '76px', borderRadius: '8px', background: 'linear-gradient(135deg, #2a9d8f, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', margin: '0 auto 0.5rem', boxShadow: '0 2px 8px rgba(42,157,143,0.3)', flexShrink: 0 }}>
              {getInitials(firstName || 'U')}
            </div>
          )}
          {firstName && <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333', marginBottom: '0.1rem' }}>{firstName}</div>}
          {activeTitle && <div style={{ fontSize: '0.75rem', color: PRIMARY, fontStyle: 'italic', marginBottom: '0.1rem' }}>{activeTitle}</div>}
          <div style={{ fontSize: '0.75rem', color: '#888' }}>{dateStr}</div>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: PRIMARY }}>{timeStr}</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center',
            marginTop: '0.5rem', padding: '0.3rem 0.75rem',
            background: '#fff8e0', borderRadius: '1rem',
            fontSize: '0.85rem', color: '#b8860b', fontWeight: 'bold',
          }}>
            {digoos.toLocaleString('fr-CH')} <Delta size={16} />
          </div>
        </div>
      )}

      {/* Sélecteur enfant ou retour compte parent */}
      {!collapsed && (
        !!localStorage.getItem('odigo_parent_access_token') ? (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
            <button
              onClick={handleReturnClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'rgba(255,255,255,0.15)',
                border: 'none', borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                color: 'var(--color-sidebar-text)',
                cursor: 'pointer', width: '100%',
                fontSize: '0.9rem',
              }}
            >
              ← Revenir au compte parent
            </button>
          </div>
        ) : isParent ? (
          <ChildSelector children={children} />
        ) : null
      )}

      <nav style={{ flex: 1, padding: '0.5rem 0', display: 'flex', flexDirection: 'column' }}>
        {/* Onglet Parent uniquement visible par les parents */}
        {isParent && (
          <button
            onClick={() => onNavigate('parent')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
              padding: '0.75rem 1rem',
              background: activePage === 'parent' ? '#fff8e0' : 'none',
              border: 'none',
              borderLeft: activePage === 'parent' ? '3px solid #e9c46a' : '3px solid transparent',
              cursor: 'pointer',
              color: activePage === 'parent' ? '#e9c46a' : 'var(--color-sidebar-text)',
              fontWeight: activePage === 'parent' ? 'bold' : 'normal',
              fontSize: '0.9rem', textAlign: 'left', whiteSpace: 'nowrap'
            }}
          >
            <Users size={18} />
            {!collapsed && 'Espace parent'}
          </button>
        )}

        {navItems.filter(i => i.id !== 'apropos' && !(i.id === 'missions' && isParent)).map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
              padding: '0.75rem 1rem',
              background: activePage === item.id ? 'var(--color-background)' : 'none',
              border: 'none',
              borderLeft: activePage === item.id ? `3px solid ${PRIMARY}` : '3px solid transparent',
              cursor: 'pointer',
              color: activePage === item.id ? PRIMARY : 'var(--color-sidebar-text)',
              fontWeight: activePage === item.id ? 'bold' : 'normal',
              fontSize: '0.9rem', textAlign: 'left', whiteSpace: 'nowrap'
            }}
          >
            {item.icon}
            {!collapsed && item.label}
          </button>
        ))}

        {/* Bas de sidebar : séparateur + À propos + Déconnexion */}
        <div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0.5rem 0.75rem' }} />
          {navItems.filter(i => i.id === 'apropos').map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                padding: '0.75rem 1rem',
                background: activePage === item.id ? 'var(--color-background)' : 'none',
                border: 'none',
                borderLeft: activePage === item.id ? `3px solid ${PRIMARY}` : '3px solid transparent',
                cursor: 'pointer',
                color: activePage === item.id ? PRIMARY : 'var(--color-sidebar-text)',
                fontWeight: activePage === item.id ? 'bold' : 'normal',
                fontSize: '0.9rem', textAlign: 'left', whiteSpace: 'nowrap'
              }}
            >
              {item.icon}
              {!collapsed && item.label}
            </button>
          ))}
          <button
            onClick={onSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#e63946',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap'
            }}
          >
            <LogOut size={18} />
            {!collapsed && 'Se déconnecter'}
          </button>
        </div>
      </nav>
      {returnModal}
    </div>
  )
}
