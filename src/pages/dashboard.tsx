import type { Session } from '@supabase/supabase-js'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Subjects from './subjects'
import Planner from './planner'
import Home from './home'
import WordLists from './wordlists'
import WordDrop from './worddrop'
import QCM from './qcm'
import Spelling from './spelling'

interface Props {
  session: Session
}

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: '🏠' },
  { id: 'planner', label: 'Planificateur', icon: '📅' },
  { id: 'subjects', label: 'Matières', icon: '📚' },
  { id: 'wordlists', label: 'Listes de mots', icon: '📝' },
  { id: 'exercises', label: 'Exercices', icon: '🎯' },
  { id: 'rewards', label: 'Récompenses', icon: '🏆' },
  { id: 'settings', label: 'Paramètres', icon: '⚙️' },
]

export default function Dashboard({ session }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', background: '#f0faf8' }}>

      {/* Menu latéral */}
      <div style={{
        width: collapsed ? '60px' : '220px',
        background: 'white',
        borderRight: '1px solid #e0f0ee',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        overflow: 'hidden',
        minHeight: '100vh',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
      }}>

        {/* Header menu */}
        <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0f0ee' }}>
          {!collapsed && <span style={{ color: '#2a9d8f', fontWeight: 'bold', fontSize: '1.2rem' }}>ODIGO</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a9d8f', fontSize: '1.1rem', padding: '0.25rem' }}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* Date et heure */}
        {!collapsed && (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0f0ee' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>{dateStr}</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2a9d8f' }}>{timeStr}</div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: activePage === item.id ? '#f0faf8' : 'none',
                border: 'none',
                borderLeft: activePage === item.id ? '3px solid #2a9d8f' : '3px solid transparent',
                cursor: 'pointer',
                color: activePage === item.id ? '#2a9d8f' : '#555',
                fontWeight: activePage === item.id ? 'bold' : 'normal',
                fontSize: '0.9rem',
                textAlign: 'left',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              {!collapsed && item.label}
            </button>
          ))}
        </nav>

        {/* Déconnexion */}
        <div style={{ padding: '1rem', borderTop: '1px solid #e0f0ee' }}>
          <button
            onClick={() => supabase.auth.signOut()}
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
            <span>🚪</span>
            {!collapsed && 'Se déconnecter'}
          </button>
        </div>
      </div>

      {/* Zone de contenu */}
      <div style={{ flex: 1, padding: '2rem' }}>
        <h1 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>
          {navItems.find(i => i.id === activePage)?.label}
        </h1>
        <p style={{ color: '#888' }}>Connecté : {session.user.email}</p>
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          marginTop: '1.5rem'
        }}>
         {activePage === 'dashboard' && <Home />}
        {activePage === 'planner' && <Planner />}
        {activePage === 'subjects' && <Subjects />}
        {activePage === 'wordlists' && <WordLists />}
        {activePage === 'exercises' && (
  <div>
    <WordDrop />
    <div style={{ marginTop: '2rem' }}>
      <QCM />
    </div>
    <div style={{ marginTop: '2rem' }}>
      <Spelling />
    </div>
  </div>
)}
        {activePage !== 'dashboard' && activePage !== 'planner' && activePage !== 'subjects' && activePage !== 'wordlists' && activePage !== 'exercises' && <p style={{ color: '#aaa' }}>Contenu à venir...</p>}
        </div>
      </div>
    </div>
  )
}