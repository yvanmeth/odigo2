import type { Session } from '@supabase/supabase-js'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Subjects from '../subjects/index'
import Planner from '../planner'
import Home from '../home'
import WordLists from '../wordlists'
import WordDrop from '../worddrop'
import QCM from '../qcm'
import Spelling from '../spelling'
import Rewards from '../rewards'
import Settings from '../settings'
import ParentDashboard from '../parent'
import Companion from '../../components/Companion'
import { DigoosAnimation } from '../../components/DigoosAnimation'
import Flashcards from '../flashcards'
import Conjugaison from '../conjugaison'
import Vocabulaire from '../vocabulaire'
import Allumettes from '../Allumettes'
import Histoire from '../Histoire'
import Sidebar from './Sidebar'
import OnboardingModal from './OnboardingModal'
import ExerciseCards from './ExerciseCards'
import { navItems, exerciseCards, type Child } from './types'

interface Props {
  session: Session
}

const PRIMARY = 'var(--color-primary)'

const getTitleName = (item: { type: string; name: string; name_masculine?: string | null; name_feminine?: string | null }, gender: string | null): string => {
  if (gender === 'M') return item.name_masculine || item.name
  if (gender === 'F') return item.name_feminine || item.name
  return item.name_masculine && item.name_feminine
    ? item.name_masculine + ' / ' + item.name_feminine
    : item.name
}

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
  const digoosAnimRef = useRef<((amount: number) => void) | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('odigo_theme_color')
    document.documentElement.style.setProperty('--color-primary', saved || '#2a9d8f')
    fetchProfile()
  }, [])

  useEffect(() => {
    (window as any).triggerDigoosAnimation =
      (amount: number) => digoosAnimRef.current?.(amount)
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

  const handleNavigate = (page: string, exercise?: string) => {
    setActivePage(page)
    setActiveExercise(exercise ?? null)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', background: '#f0faf8' }}>

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        activePage={activePage}
        activeExercise={activeExercise}
        onNavigate={handleNavigate}
        isParent={isParent}
        isViewingChild={isViewingChild}
        children={children}
        viewingChildId={viewingChildId}
        onSelectChild={handleSelectChild}
        firstName={firstName}
        activeTitle={activeTitle}
        digoos={digoos}
        userId={effectiveUserId}
        onSignOut={() => supabase.auth.signOut()}
      />

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
            <ExerciseCards onSelectExercise={setActiveExercise} />
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

          {activePage === 'exercises' && activeExercise === 'histoire' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: '#e0f0ee', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour aux exercices
              </button>
              <Histoire />
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

      {showOnboarding && <OnboardingModal onComplete={handleFinishOnboarding} />}

      <DigoosAnimation onRef={trigger => { digoosAnimRef.current = trigger }} />
    </div>
  )
}
