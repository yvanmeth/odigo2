import type { Session } from '@supabase/supabase-js'
import { useState, useEffect, useRef } from 'react'
import { Menu, Home as HomeIcon, Calendar, Target, Trophy, Settings as SettingsIcon } from 'lucide-react'
import { Delta } from '../../components/Delta'
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
import { useToast } from '../../components/Toast'
import { DigoosAnimation } from '../../components/DigoosAnimation'
import Flashcards from '../flashcards'
import Conjugaison from '../conjugaison'
import Vocabulaire from '../vocabulaire'
import PuzzlePhrases from '../PuzzlePhrases'
import Maths from '../Maths'
import Allumettes from '../Allumettes'
import Histoire from '../Histoire'
import Cartes from '../Cartes'
import Anagramme from '../Anagramme'
import APropos from '../APropos'
import MissionsPage from '../MissionsPage'
import DefiParents from '../DefiParents'
import CarteSuisse from '../CarteSuisse'
import ConjugaisonEtrangere from '../ConjugaisonEtrangere'
import AnagrammeFrancais from '../AnagrammeFrancais'
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
  const { showToast } = useToast()
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const digoosAnimRef = useRef<((amount: number) => void) | null>(null)
  const [pendingInvite] = useState(localStorage.getItem('odigo_pending_invite') || '')
  const [showInviteModal, setShowInviteModal] = useState(!!localStorage.getItem('odigo_pending_invite'))
  const [inviteParentName, setInviteParentName] = useState('')
  const [inviteRelationship, setInviteRelationship] = useState('')
  const [hasNotification, setHasNotification] = useState(false)
  const [notificationMessages, setNotificationMessages] = useState<string[]>([])
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('odigo_theme')
    if (savedTheme) {
      const root = document.documentElement
      root.style.setProperty('--color-primary', localStorage.getItem('odigo_theme_color') || '#2a9d8f')
      root.style.setProperty('--color-background', localStorage.getItem('odigo_theme_bg') || '#f0faf8')
      root.style.setProperty('--color-accent', localStorage.getItem('odigo_theme_accent') || '#e9c46a')
      root.style.setProperty('--color-border', localStorage.getItem('odigo_theme_border') || '#e0f0ee')
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    (window as any).triggerDigoosAnimation =
      (amount: number) => digoosAnimRef.current?.(amount)
  }, [])

  useEffect(() => {
    if (!pendingInvite || !session.user) return
    const fetchInviteInfo = async () => {
      const { data: invite, error: inviteError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', pendingInvite)
        .eq('used', false)
        .maybeSingle()

      if (!invite) {
        localStorage.removeItem('odigo_pending_invite')
        setShowInviteModal(false)
        if (inviteError) {
          console.error('Invite error:', inviteError)
        } else {
          showToast("Code d'invitation introuvable ou expiré.", 'error')
        }
        return
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        localStorage.removeItem('odigo_pending_invite')
        setShowInviteModal(false)
        showToast("Le lien d'invitation a expiré.", 'error')
        return
      }

      const { data: parentProfile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', invite.parent_id)
        .single()

      setInviteRelationship(invite.relationship || '')
      setInviteParentName(parentProfile?.first_name || 'ton parent')
      setShowInviteModal(true)
    }
    fetchInviteInfo()
  }, [pendingInvite, session.user])

  const applyPendingProfile = async (userId: string) => {
    const pending = localStorage.getItem('odigo_pending_profile')
    if (!pending) return
    try {
      const data = JSON.parse(pending)
      const { data: existing } = await supabase
        .from('profiles')
        .select('first_name, role')
        .eq('id', userId)
        .single()
      if (!existing?.first_name) {
        await supabase.from('profiles').upsert({
          id: userId,
          first_name: data.first_name,
          birth_date: data.birth_date,
          gender: data.gender,
          role: data.role,
          has_met_odigo: false,
        })
      }
      localStorage.removeItem('odigo_pending_profile')
    } catch {
      localStorage.removeItem('odigo_pending_profile')
    }
  }

  interface NotificationState {
    hasNew: boolean
    messages: string[]
  }

  const checkNotifications = async (userId: string, lastSeen: string): Promise<NotificationState> => {
    const messages: string[] = []

    const notifMissions = localStorage.getItem('odigo_notif_missions') !== 'off'
    const notifIrl = localStorage.getItem('odigo_notif_irl') !== 'off'
    const notifCartes = localStorage.getItem('odigo_notif_cartes') !== 'off'

    if (notifMissions) {
      const { count: newMissions } = await supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .eq('child_id', userId)
        .eq('status', 'pending')
        .gt('created_at', lastSeen)
      if (newMissions && newMissions > 0) {
        messages.push(newMissions === 1
          ? '🎯 Tu as une nouvelle mission !'
          : `🎯 Tu as ${newMissions} nouvelles missions !`)
      }
    }

    if (notifIrl) {
      const { count: newRewards } = await supabase
        .from('irl_rewards')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', lastSeen)
      if (newRewards && newRewards > 0) {
        messages.push('🎁 Une nouvelle récompense IRL est disponible !')
      }
    }

    if (notifCartes) {
      const today = new Date().toISOString().split('T')[0]
      const { count: newCards } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .lte('available_from', today)
        .gt('available_from', lastSeen.split('T')[0])
      if (newCards && newCards > 0) {
        messages.push('🎴 Une nouvelle carte ODIGO est disponible !')
      }
    }

    return { hasNew: messages.length > 0, messages }
  }

  const fetchProfile = async () => {
    await applyPendingProfile(session.user.id)
    const { data } = await supabase
      .from('profiles')
      .select('role, first_name, gender, has_met_odigo, last_seen_at')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setIsParent(data.role === 'parent')
      setFirstName(data.first_name || '')
      if (data.role === 'parent') fetchChildren()
      if (data.has_met_odigo === false) setShowOnboarding(true)
      if (data.role !== 'parent' && data.last_seen_at) {
        setLastSeenAt(data.last_seen_at)
        const notifState = await checkNotifications(session.user.id, data.last_seen_at)
        setHasNotification(notifState.hasNew)
        setNotificationMessages(notifState.messages)
      }
      await supabase.from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', session.user.id)
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

  // Polling notifications toutes les 2 minutes
  useEffect(() => {
    if (!lastSeenAt || isParent) return
    const interval = setInterval(async () => {
      const result = await checkNotifications(effectiveUserId, lastSeenAt)
      if (result.hasNew) {
        setHasNotification(true)
        setNotificationMessages(result.messages)
      }
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [effectiveUserId, lastSeenAt, isParent])

  // Realtime — solde Digoos
  useEffect(() => {
    if (!effectiveUserId) return
    const subscription = supabase
      .channel('progress_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'progress',
        filter: `user_id=eq.${effectiveUserId}`,
      }, (payload) => {
        const newDigoos = (payload.new as { digoos?: number }).digoos
        if (newDigoos !== undefined) setDigoos(newDigoos)
      })
      .subscribe()
    return () => { supabase.removeChannel(subscription) }
  }, [effectiveUserId])

  // Realtime — nouvelles missions
  useEffect(() => {
    if (!effectiveUserId || isParent) return
    const subscription = supabase
      .channel('missions_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'missions',
        filter: `child_id=eq.${effectiveUserId}`,
      }, () => {
        setHasNotification(true)
        setNotificationMessages(prev => [
          '🎯 Tu as une nouvelle mission !',
          ...prev.filter(m => !m.includes('mission')),
        ])
      })
      .subscribe()
    return () => { supabase.removeChannel(subscription) }
  }, [effectiveUserId, isParent])

  const handleFinishOnboarding = async () => {
    await supabase.from('profiles').update({ has_met_odigo: true }).eq('id', session.user.id)
    setShowOnboarding(false)
  }

  const handleNavigate = (page: string, exercise?: string) => {
    setActivePage(page)
    setActiveExercise(exercise ?? null)
  }

  const backButton = (
    <button
      onClick={() => setActiveExercise(null)}
      style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
    >
      ← Retour aux exercices
    </button>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', background: 'var(--color-background)' }}>

      {/* Barre supérieure mobile */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: '56px',
          background: 'white',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          zIndex: 400,
          gap: '1rem',
        }}>
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: '#2a9d8f' }}
          >
            <Menu size={24} />
          </button>
          <img src="/logo-full.svg" style={{ height: '28px' }} alt="ODIGO" />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b8860b', fontWeight: 'bold', fontSize: '0.9rem' }}>
            {digoos} <Delta size={16} />
          </div>
        </div>
      )}

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
        isMobile={isMobile}
        mobileMenuOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Zone de contenu */}
      <div
        key={activePage + (activeExercise || '')}
        className="page-enter"
        style={isMobile
          ? { flex: 1, padding: '56px 1rem 60px', width: '100%' }
          : { flex: 1, padding: '2rem' }
        }
      >

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
          padding: isMobile ? '1rem' : '2rem',
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
            <div>{backButton}<WordDrop /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'qcm' && (
            <div>{backButton}<QCM /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'spelling' && (
            <div>{backButton}<Spelling /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'flashcards' && (
            <div>{backButton}<Flashcards /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'conjugaison' && (
            <div>{backButton}<Conjugaison /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'vocabulaire' && (
            <div>{backButton}<Vocabulaire /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'puzzlephrases' && (
            <div>{backButton}<PuzzlePhrases /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'anagramme' && (
            <div>{backButton}<Anagramme userId={effectiveUserId} /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'conjugaison-etrangere' && (
            <div>{backButton}<ConjugaisonEtrangere /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'anagramme-francais' && (
            <div>{backButton}<AnagrammeFrancais userId={effectiveUserId} /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'maths-calcul' && (
            <Maths initialExercise="calcul" onBack={() => setActiveExercise(null)} />
          )}
          {activePage === 'exercises' && activeExercise === 'maths-multiplication' && (
            <Maths initialExercise="multiplication" onBack={() => setActiveExercise(null)} />
          )}
          {activePage === 'exercises' && activeExercise === 'maths-division' && (
            <Maths initialExercise="division" onBack={() => setActiveExercise(null)} />
          )}
          {activePage === 'exercises' && activeExercise === 'maths-equation' && (
            <Maths initialExercise="equation" onBack={() => setActiveExercise(null)} />
          )}
          {activePage === 'exercises' && activeExercise === 'defi-parents' && (
            <DefiParents userId={effectiveUserId} onBack={() => setActiveExercise(null)} />
          )}
          {activePage === 'exercises' && activeExercise === 'carte-suisse' && (
            <CarteSuisse userId={effectiveUserId} onBack={() => setActiveExercise(null)} />
          )}
          {activePage === 'exercises' && activeExercise === 'allumettes' && (
            <div>{backButton}<Allumettes /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'histoire' && (
            <div>{backButton}<Histoire /></div>
          )}
          {activePage === 'exercises' && activeExercise === 'cartes' && (
            <div>
              <button
                onClick={() => setActiveExercise(null)}
                style={{ marginBottom: '1.5rem', padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ← Retour
              </button>
              <Cartes />
            </div>
          )}

          {activePage === 'rewards' && (
            <Rewards
              userId={isViewingChild ? effectiveUserId : undefined}
              onNavigate={(page, exercise) => {
                setActivePage(page)
                if (exercise) setActiveExercise(exercise)
              }}
            />
          )}
          {activePage === 'missions' && <MissionsPage userId={effectiveUserId} />}
          {activePage === 'settings' && <Settings onNavigate={setActivePage} />}
          {activePage === 'apropos' && <APropos />}
          {activePage !== 'dashboard' && activePage !== 'planner' && activePage !== 'subjects' && activePage !== 'wordlists' && activePage !== 'exercises' && activePage !== 'missions' && activePage !== 'rewards' && activePage !== 'settings' && activePage !== 'parent' && activePage !== 'apropos' && (
            <p style={{ color: '#aaa' }}>Contenu à venir...</p>
          )}
        </div>
      </div>

      {!isViewingChild && (
        <Companion
          userId={session.user.id}
          currentPage={activePage}
          hasNotification={hasNotification}
          notificationMessages={notificationMessages}
          onNotificationRead={() => setHasNotification(false)}
        />
      )}
      {showOnboarding && <OnboardingModal onComplete={handleFinishOnboarding} />}
      <DigoosAnimation onRef={trigger => { digoosAnimRef.current = trigger }} />

      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔗</div>
            <h3 style={{ color: '#2a9d8f', marginBottom: '0.75rem' }}>Invitation reçue !</h3>
            <p style={{ color: '#555', marginBottom: '1.5rem' }}>
              Tu as été invité·e à lier ton compte à celui de{' '}
              <strong>{inviteParentName}</strong>{inviteRelationship ? ` (${inviteRelationship})` : ''}. Veux-tu accepter ?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={async () => {
                  const { data: invite } = await supabase
                    .from('invite_codes')
                    .select('*')
                    .eq('code', pendingInvite)
                    .eq('used', false)
                    .maybeSingle()

                  if (!invite) {
                    showToast('Code introuvable ou déjà utilisé', 'error')
                    localStorage.removeItem('odigo_pending_invite')
                    setShowInviteModal(false)
                    return
                  }

                  const { error: linkError } = await supabase.from('parent_child').insert({
                    parent_id: invite.parent_id,
                    child_id: session.user.id,
                    relationship: invite.relationship || 'parent',
                  })

                  if (linkError) {
                    if (linkError.code === '23505') showToast('Ce compte parent est déjà lié.', 'error')
                    else showToast('Erreur lors de la liaison des comptes.', 'error')
                    localStorage.removeItem('odigo_pending_invite')
                    setShowInviteModal(false)
                    return
                  }

                  await supabase.from('invite_codes').update({ used: true }).eq('id', invite.id)
                  localStorage.removeItem('odigo_pending_invite')
                  setShowInviteModal(false)
                  showToast('Compte lié avec succès !')
                }}
                style={{ background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✓ Accepter
              </button>
              <button
                onClick={() => { localStorage.removeItem('odigo_pending_invite'); setShowInviteModal(false) }}
                style={{ background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.5rem', cursor: 'pointer' }}
              >
                Refuser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barre de navigation mobile en bas */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          height: '60px',
          background: 'white',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 400,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {[
            { id: 'dashboard', icon: <HomeIcon size={22} />, label: 'Accueil' },
            { id: 'planner', icon: <Calendar size={22} />, label: 'Agenda' },
            { id: 'exercises', icon: <Target size={22} />, label: 'Exercices' },
            { id: 'rewards', icon: <Trophy size={22} />, label: 'Récompenses' },
            { id: 'settings', icon: <SettingsIcon size={22} />, label: 'Paramètres' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActivePage(item.id)
                setActiveExercise(null)
              }}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '2px',
                background: 'none', border: 'none',
                cursor: 'pointer', padding: '0.5rem',
                color: activePage === item.id ? '#2a9d8f' : '#aaa',
                fontSize: '0.65rem', fontWeight: 'bold',
                minWidth: '56px',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
