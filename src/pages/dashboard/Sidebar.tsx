import { Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import ChildSelector from './ChildSelector'
import { navItems, type Child } from './types'

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
  isViewingChild: boolean
  children: Child[]
  viewingChildId: string | null
  onSelectChild: (id: string | null) => void
  firstName: string
  activeTitle: string | null
  digoos: number
  userId: string
  onSignOut: () => void
}

export default function Sidebar({
  collapsed, onToggle, activePage, onNavigate,
  isParent, isViewingChild, children, viewingChildId, onSelectChild,
  firstName, activeTitle, digoos, onSignOut,
}: SidebarProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      width: collapsed ? '60px' : '220px',
      background: 'white',
      borderRight: '1px solid #e0f0ee',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      minHeight: '100vh',
      boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
    }}>

      <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0f0ee' }}>
        {!collapsed && <span style={{ color: PRIMARY, fontWeight: 'bold', fontSize: '1.2rem' }}>ODIGO</span>}
        <button
          onClick={onToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: '1.1rem', padding: '0.25rem' }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {collapsed ? (
        <div style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #e0f0ee', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #2a9d8f, #4CAF50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '1rem',
            boxShadow: '0 2px 8px rgba(42,157,143,0.3)',
          }}>
            {getInitials(firstName || 'U')}
          </div>
          <div style={{ fontSize: '1rem' }}>💰</div>
        </div>
      ) : (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0f0ee', textAlign: 'center' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #2a9d8f, #4CAF50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '1rem',
            margin: '0 auto 0.5rem',
            boxShadow: '0 2px 8px rgba(42,157,143,0.3)',
          }}>
            {getInitials(firstName || 'U')}
          </div>
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
            💰 {digoos.toLocaleString('fr-CH')} Δ
          </div>
        </div>
      )}

      {/* Sélecteur enfant pour les parents */}
      {isParent && !collapsed && (
        <ChildSelector children={children} viewingChildId={viewingChildId} onSelectChild={onSelectChild} />
      )}

      <nav style={{ flex: 1, padding: '0.5rem 0' }}>
        {/* Onglet Parent uniquement visible par les parents */}
        {isParent && !isViewingChild && (
          <button
            onClick={() => onNavigate('parent')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.75rem 1rem',
              background: activePage === 'parent' ? '#fff8e0' : 'none',
              border: 'none',
              borderLeft: activePage === 'parent' ? '3px solid #e9c46a' : '3px solid transparent',
              cursor: 'pointer',
              color: activePage === 'parent' ? '#e9c46a' : '#555',
              fontWeight: activePage === 'parent' ? 'bold' : 'normal',
              fontSize: '0.9rem',
              textAlign: 'left',
              whiteSpace: 'nowrap'
            }}
          >
            <Users size={18} />
            {!collapsed && 'Espace parent'}
          </button>
        )}

        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.75rem 1rem',
              background: activePage === item.id ? '#f0faf8' : 'none',
              border: 'none',
              borderLeft: activePage === item.id ? `3px solid ${PRIMARY}` : '3px solid transparent',
              cursor: 'pointer',
              color: activePage === item.id ? PRIMARY : '#555',
              fontWeight: activePage === item.id ? 'bold' : 'normal',
              fontSize: '0.9rem',
              textAlign: 'left',
              whiteSpace: 'nowrap'
            }}
          >
            {item.icon}
            {!collapsed && item.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid #e0f0ee' }}>
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
    </div>
  )
}
