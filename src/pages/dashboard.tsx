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
import Rewards from './rewards'
import Settings from './settings'

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

const exerciseCards = [
  {
    id: 'worddrop',
    label: 'Word Drop',
    icon: '🎮',
    description: 'Aligne le mot sur la bonne traduction avant qu\'il touche le sol !',
    color: '#2a9d8f',
  },
  {
    id: 'qcm',
    label: 'QCM',
    icon: '🧠',
    description: 'Choisis la bonne réponse parmi 2, 4 ou 8 propositions.',
    color: '#e9c46a',
  },
  {
    id: 'spelling',
    label: 'Épellation',
    icon: '✍️',
    description: 'Écoute ou lis le mot et écris sa traduction correctement.',
    color: '#e76f51',
  },
]

export default function Dashboard({ session }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [activeExercise, setActiveExercise] = useState<string | null>(null)

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

        <div style={{ padding: '1.25rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0f0ee' }}>
          {!collapsed && <span style={{ color: '#2a9d8f', fontWeight: 'bold', fontSize: '1.2rem' }}>ODIGO</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a9d8f', fontSize: '1.1rem', padding: '0.25rem' }}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {!collapsed && (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0f0ee' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>{dateStr}</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#2a9d8f' }}>{timeStr}</div>
          </div>
        )}

        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActivePage(item.id); setActiveExercise(null) }}
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
          {activePage === 'exercises' && activeExercise
            ? exerciseCards.find(e => e.id === activeExercise)?.label
            : navItems.find(i => i.id === activePage)?.label}
        </h1>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>Connecté : {session.user.email}</p>

        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          {activePage === 'dashboard' && <Home />}
          {activePage === 'planner' && <Planner />}
          {activePage === 'subjects' && <Subjects />}
          {activePage === 'wordlists' && <WordLists />}

          {activePage === 'exercises' && !activeExercise && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {exerciseCards.map(ex => (
                  <div
                    key={ex.id}
                    onClick={() => setActiveExercise(ex.id)}
                    style={{
                      background: 'white',
                      borderRadius: '1rem',
                      padding: '1.5rem 1rem',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      textAlign: 'center',
                      borderTop: `4px solid ${ex.color}`,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{ex.icon}</div>
                    <div style={{ fontWeight: 'bold', color: '#333', fontSize: '1rem', marginBottom: '0.5rem' }}>{ex.label}</div>
                    <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>{ex.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePage === 'exercises' && activeExercise === 'worddrop' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <WordDrop />
            </div>
          )}

          {activePage === 'exercises' && activeExercise === 'qcm' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <QCM />
            </div>
          )}

          {activePage === 'exercises' && activeExercise === 'spelling' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <Spelling />
            </div>
          )}
          {activePage === 'rewards' && <Rewards />}
          {activePage === 'settings' && <Settings />}
          {activePage !== 'dashboard' && activePage !== 'planner' && activePage !== 'subjects' && activePage !== 'wordlists' && activePage !== 'exercises' && activePage !== 'rewards' && activePage !== 'settings' && (
            <p style={{ color: '#aaa' }}>Contenu à venir...</p>
          )}
        </div>
      </div>
    </div>
  )
}
