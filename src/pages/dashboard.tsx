import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Home as HomeIcon, Calendar, BookOpen, List as ListIcon, Target, Trophy, Settings as SettingsIcon, Users, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import Subjects from './subjects/index'
import Planner from './planner'
import Home from './home'
import WordLists from './wordlists'
import WordDrop from './worddrop'
import QCM from './qcm'
import Spelling from './spelling'
import Rewards from './rewards'
import Settings from './settings'
import ParentDashboard from './parent'
import Companion from '../components/Companion'
import Flashcards from './flashcards'
import Conjugaison from './conjugaison'
import Vocabulaire from './vocabulaire'
import Allumettes from './Allumettes'

interface Props {
  session: Session
}

interface Child {
  id: string
  first_name: string
}

const PRIMARY = 'var(--color-primary)'

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

const getTitleName = (item: { type: string; name: string; name_masculine?: string | null; name_feminine?: string | null }, gender: string | null): string => {
  if (gender === 'M') return item.name_masculine || item.name
  if (gender === 'F') return item.name_feminine || item.name
  return item.name_masculine && item.name_feminine
    ? item.name_masculine + ' / ' + item.name_feminine
    : item.name
}

interface NavItem { id: string; label: string; icon: ReactNode }

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <HomeIcon size={18} /> },
  { id: 'planner', label: 'Planificateur', icon: <Calendar size={18} /> },
  { id: 'subjects', label: 'Matières', icon: <BookOpen size={18} /> },
  { id: 'wordlists', label: 'Listes de mots', icon: <ListIcon size={18} /> },
  { id: 'exercises', label: 'Exercices', icon: <Target size={18} /> },
  { id: 'rewards', label: 'Récompenses', icon: <Trophy size={18} /> },
  { id: 'settings', label: 'Paramètres', icon: <SettingsIcon size={18} /> },
]

const exerciseCards = [
  {
    id: 'worddrop',
    label: 'Word Drop',
    icon: '🎮',
    description: 'Aligne le mot sur la bonne traduction avant qu\'il touche le sol !',
    color: PRIMARY,
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
  {
    id: 'flashcards',
    label: 'Flashcards',
    icon: '🃏',
    description: 'Retourne les cartes et swipe selon si tu fais juste ou pas.',
    color: PRIMARY,
  },
  {
    id: 'conjugaison',
    label: 'Conjugaison',
    icon: '✍️',
    description: 'Conjugue les verbes au bon temps et à la bonne personne.',
    color: '#e76f51',
  },
  {
    id: 'vocabulaire',
    label: 'Vocabulaire',
    icon: '📝',
    description: 'Complète les phrases à trou avec le bon mot.',
    color: '#4CAF50',
  },
]

export default function Dashboard({ session }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [activePage, setActivePage] = useState('dashboard')
  const [activeExercise, setActiveExercise] = useState<string | null>(null)
  const [isParent, setIsParent] = useState(false)
  const [children, setChildren] = useState<Child[]>([])
  const [viewingChildId, setViewingChildId] = useState<string | null>(null)
  const [viewingChildName, setViewingChildName] = useState<string>('')
  const [firstName, setFirstName] = useState<string>('')
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  const [digoos, setDigoos] = useState<number>(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3>(1)

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = now.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    const saved = localStorage.getItem('odigo_theme_color')
    document.documentElement.style.setProperty('--color-primary', saved || '#2a9d8f')
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('role, first_name, gender, has_met_odigo')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setIsParent(data.role === 'parent')
      setFirstName(data.first_name || '')
      if (data.role === 'parent') fetchChildren()
      if (data.has_met_odigo === false) setShowOnboarding(true)
    }

    const { data: activePurchases } = await supabase
      .from('user_purchases')
      .select('item_id, expires_at')
      .eq('user_id', session.user.id)
      .eq('active', true)

    const validPurchase = activePurchases?.find(p => !p.expires_at || new Date(p.expires_at) > new Date())
    if (validPurchase) {
      const { data: titleItem } = await supabase
        .from('shop_items')
        .select('type, name, name_masculine, name_feminine')
        .eq('id', validPurchase.item_id)
        .eq('type', 'title')
        .maybeSingle()
      if (titleItem) {
        setActiveTitle(getTitleName(titleItem, data?.gender || null))
      }
    }
  }

  const fetchChildren = async () => {
    const { data } = await supabase
      .from('parent_child')
      .select('child_id')
      .eq('parent_id', session.user.id)

    if (data && data.length > 0) {
      const childIds = data.map(d => d.child_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name')
        .in('id', childIds)

      if (profiles) {
        setChildren(profiles.map(p => ({ id: p.id, first_name: p.first_name || 'Enfant' })))
      }
    }
  }

  const handleSelectChild = (childId: string | null) => {
    setViewingChildId(childId)
    if (childId) {
      const child = children.find(c => c.id === childId)
      setViewingChildName(child?.first_name || 'Enfant')
      setActivePage('dashboard')
    } else {
      setViewingChildName('')
      setActivePage('dashboard')
    }
  }

  const effectiveUserId = viewingChildId || session.user.id
  const isViewingChild = !!viewingChildId

  const fetchDigoos = async () => {
    const { data } = await supabase
      .from('progress')
      .select('digoos')
      .eq('user_id', effectiveUserId)
      .single()
    if (data) setDigoos(data.digoos)
  }

  useEffect(() => {
    fetchDigoos()
  }, [activePage, effectiveUserId])

  const handleFinishOnboarding = async () => {
    await supabase.from('profiles').update({ has_met_odigo: true }).eq('id', session.user.id)
    setShowOnboarding(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', background: '#f0faf8' }}>

      {/* Menu latéral */}
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
            onClick={() => setCollapsed(!collapsed)}
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
              💰 {digoos.toLocaleString('fr-CH')} Digoos
            </div>
          </div>
        )}

        {/* Sélecteur enfant pour les parents */}
        {isParent && !collapsed && (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0f0ee', background: '#f9f9f9' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.4rem' }}>Vue active</div>
            <select
              value={viewingChildId || ''}
              onChange={e => handleSelectChild(e.target.value || null)}
              style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #ddd', fontSize: '0.85rem', color: '#333' }}
            >
              <option value="">👤 Mon espace</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>👧 {c.first_name}</option>
              ))}
            </select>
          </div>
        )}

        <nav style={{ flex: 1, padding: '0.5rem 0' }}>
          {/* Onglet Parent uniquement visible par les parents */}
          {isParent && !isViewingChild && (
            <button
              onClick={() => { setActivePage('parent'); setActiveExercise(null) }}
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
              onClick={() => { setActivePage(item.id); setActiveExercise(null) }}
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
            <LogOut size={18} />
            {!collapsed && 'Se déconnecter'}
          </button>
        </div>
      </div>

      {/* Zone de contenu */}
      <div key={activePage + (activeExercise || '')} className="page-enter" style={{ flex: 1, padding: '2rem' }}>

        {/* Bandeau vue enfant */}
        {isViewingChild && (
          <div style={{ background: '#fff8e0', border: '1px solid #e9c46a', borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e9c46a', fontWeight: 'bold', fontSize: '0.9rem' }}>
              👧 Tu consultes l'espace de <strong>{viewingChildName}</strong>
            </span>
            <button
              onClick={() => handleSelectChild(null)}
              style={{ padding: '0.3rem 0.8rem', background: '#e9c46a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              ← Mon espace
            </button>
          </div>
        )}

        <h1 style={{ color: PRIMARY, marginBottom: '0.25rem' }}>
          {activePage === 'exercises' && activeExercise
            ? exerciseCards.find(e => e.id === activeExercise)?.label
            : activePage === 'parent'
            ? 'Espace parent'
            : navItems.find(i => i.id === activePage)?.label}
        </h1>

        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          {activePage === 'parent' && isParent && (
            <ParentDashboard onSelectChild={handleSelectChild} />
          )}

          {activePage === 'dashboard' && <Home userId={effectiveUserId} />}
          {activePage === 'planner' && <Planner userId={effectiveUserId} isParent={isParent && isViewingChild} />}
          {activePage === 'subjects' && <Subjects userId={effectiveUserId} />}
          {activePage === 'wordlists' && <WordLists userId={effectiveUserId} />}

          {activePage === 'exercises' && !activeExercise && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {exerciseCards.map(ex => (
                  <div
                    key={ex.id}
                    onClick={() => setActiveExercise(ex.id)}
                    className="card-hover"
                    style={{
                      background: 'white',
                      borderRadius: '1rem',
                      padding: '1.5rem 1rem',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                      textAlign: 'center',
                      borderTop: `4px solid ${ex.color}`,
                    }}
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
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
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
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
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
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <Spelling />
            </div>
          )}

          {activePage === 'exercises' && activeExercise === 'flashcards' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <Flashcards />
            </div>
          )}

          {activePage === 'exercises' && activeExercise === 'conjugaison' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <Conjugaison />
            </div>
          )}

          {activePage === 'exercises' && activeExercise === 'vocabulaire' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <Vocabulaire />
            </div>
          )}

          {activePage === 'exercises' && activeExercise === 'allumettes' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <Allumettes />
            </div>
          )}

          {activePage === 'rewards' && (
            <Rewards
              userId={effectiveUserId}
              onNavigate={(page, exercise) => {
                setActivePage(page)
                if (exercise) setActiveExercise(exercise)
              }}
            />
          )}
          {activePage === 'settings' && <Settings />}
          {activePage !== 'dashboard' && activePage !== 'planner' && activePage !== 'subjects' && activePage !== 'wordlists' && activePage !== 'exercises' && activePage !== 'rewards' && activePage !== 'settings' && activePage !== 'parent' && (
            <p style={{ color: '#aaa' }}>Contenu à venir...</p>
          )}
        </div>
      </div>
      {!isViewingChild && <Companion userId={session.user.id} />}

      {showOnboarding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '480px', width: '90%', background: 'white', borderRadius: '1.5rem', padding: '2.5rem', boxSizing: 'border-box' }}>

            {onboardingStep === 1 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🟢</div>
                <h2 style={{ color: '#333', margin: '0 0 0.75rem', fontSize: '1.4rem' }}>Bienvenue sur ODIGO !</h2>
                <p style={{ color: '#555', lineHeight: '1.7', margin: 0 }}>
                  Je m'appelle Odigo, ton compagnon d'apprentissage.
                  Je suis là pour t'aider à t'organiser, réviser et progresser. Prêt·e à commencer ?
                </p>
              </div>
            )}

            {onboardingStep === 2 && (
              <div>
                <h2 style={{ color: '#333', margin: '0 0 1.25rem', fontSize: '1.4rem' }}>Ce que tu peux faire ici</h2>
                {([
                  ['📅', 'Planifier tes évaluations et révisions'],
                  ['🎯', "T'entraîner avec des exercices interactifs"],
                  ['🏆', 'Gagner des Digoos et des récompenses'],
                ] as const).map(([icon, text]) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                    <span style={{ color: '#555', fontSize: '1rem' }}>{text}</span>
                  </div>
                ))}
              </div>
            )}

            {onboardingStep === 3 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🚀</div>
                <h2 style={{ color: '#333', margin: '0 0 0.75rem', fontSize: '1.4rem' }}>C'est parti !</h2>
                <p style={{ color: '#555', lineHeight: '1.7', margin: '0 0 1.5rem' }}>
                  Commence par ajouter une évaluation dans le Planificateur, ou lance-toi directement dans un exercice.
                  Je suis là si tu as des questions !
                </p>
                <button
                  onClick={handleFinishOnboarding}
                  style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Commencer →
                </button>
              </div>
            )}

            {/* Points indicateurs */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '1.5rem 0 0' }}>
              {([1, 2, 3] as const).map(n => (
                <div key={n} style={{ width: '8px', height: '8px', borderRadius: '50%', background: onboardingStep === n ? '#2a9d8f' : '#e0f0ee', transition: 'background 0.2s' }} />
              ))}
            </div>

            {/* Navigation Précédent / Suivant */}
            {onboardingStep < 3 && (
              <div style={{ display: 'flex', justifyContent: onboardingStep === 1 ? 'flex-end' : 'space-between', marginTop: '1.25rem' }}>
                {onboardingStep > 1 && (
                  <button
                    onClick={() => setOnboardingStep(s => (s - 1) as 1 | 2 | 3)}
                    style={{ padding: '0.6rem 1.25rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ← Précédent
                  </button>
                )}
                <button
                  onClick={() => setOnboardingStep(s => (s + 1) as 1 | 2 | 3)}
                  style={{ padding: '0.6rem 1.25rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Suivant →
                </button>
              </div>
            )}
            {onboardingStep === 3 && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1.25rem' }}>
                <button
                  onClick={() => setOnboardingStep(2)}
                  style={{ padding: '0.6rem 1.25rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  ← Précédent
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
