import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import HelpBubble from '../components/HelpBubble'

type SettingsTab = 'profil' | 'compte'

interface Profile {
  id: string
  first_name?: string
  birth_date?: string
  interests: string[]
  main_language: string
  gender?: 'M' | 'F' | 'X'
  dark_mode: boolean
}

interface SettingsProps {
  onNavigate?: (page: string) => void
}

const SUGGESTED_INTERESTS = [
  'Musique', 'Sport', 'Jeux vidéo', 'Lecture', 'Cinéma', 'Cuisine',
  'Dessin', 'Voyage', 'Nature', 'Sciences', 'Histoire', 'Manga',
  'Animé', 'Mode', 'Danse', 'Théâtre', 'Informatique', 'Animaux'
]

const LANGUAGES = ['Français', 'Anglais', 'Allemand', 'Espagnol', 'Grec', 'Arabe', 'Italien']

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'profil', label: '👤 Mon profil' },
  { id: 'compte', label: '🔐 Gestion du compte' },
]

export default function Settings({ onNavigate }: SettingsProps = {}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profil')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [avatarCardId, setAvatarCardId] = useState<string | null>(null)
  const [newInterest, setNewInterest] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dangerPassword, setDangerPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [parentCode, setParentCode] = useState('')
  const [role, setRole] = useState<'student' | 'parent'>('student')
  const [savingRole, setSavingRole] = useState(false)
  const [highscoresEnabled, setHighscoresEnabled] = useState(
    localStorage.getItem('odigo_highscores') !== 'off'
  )
  const [helpBubbles, setHelpBubbles] = useState(
    localStorage.getItem('odigo_help_bubbles') !== 'off'
  )
  const [notifMissions, setNotifMissions] = useState(
    localStorage.getItem('odigo_notif_missions') !== 'off'
  )
  const [notifIrl, setNotifIrl] = useState(
    localStorage.getItem('odigo_notif_irl') !== 'off'
  )
  const [notifCartes, setNotifCartes] = useState(
    localStorage.getItem('odigo_notif_cartes') !== 'off'
  )
  const [linkedChildren, setLinkedChildren] = useState<{ id: string; first_name: string }[]>([])
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [linkedParent, setLinkedParent] = useState<{ first_name: string } | null>(null)
  const [linkedParents, setLinkedParents] = useState<{ id: string; first_name: string; relationship: string }[]>([])

  const fetchLinkedChildren = async () => {
    setLoadingChildren(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingChildren(false); return }
    const { data: links } = await supabase
      .from('parent_child').select('child_id').eq('parent_id', user.id)
    const childIds = ((links || []) as { child_id: string }[]).map(l => l.child_id)
    if (childIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, first_name').in('id', childIds)
      setLinkedChildren((profiles || []) as { id: string; first_name: string }[])
    } else {
      setLinkedChildren([])
    }
    setLoadingChildren(false)
  }

  useEffect(() => { fetchProfile() }, [])

  useEffect(() => {
    const fetchRoleAndLinks = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (data?.role === 'parent') {
        setRole('parent')
      } else {
        const { data: links } = await supabase
          .from('parent_child').select('parent_id').eq('child_id', user.id).limit(1)
        if (links && links.length > 0) {
          const { data: parentProfile } = await supabase
            .from('profiles').select('first_name').eq('id', links[0].parent_id).single()
          if (parentProfile) setLinkedParent(parentProfile as { first_name: string })
        }
      }
    }
    fetchRoleAndLinks()
  }, [])

  useEffect(() => {
    if (role === 'parent') return
    const fetchLinkedParents = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: links, error } = await supabase
        .from('parent_child')
        .select('parent_id, relationship')
        .eq('child_id', user.id)
      console.log('Links:', links, 'error:', error)
      if (!links || links.length === 0) return
      const parentIds = links.map(l => l.parent_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name')
        .in('id', parentIds)
      if (profiles) {
        setLinkedParents(links.map(l => ({
          id: l.parent_id,
          first_name: profiles.find(p => p.id === l.parent_id)?.first_name || 'Parent',
          relationship: l.relationship || 'Parent',
        })))
      }
    }
    fetchLinkedParents()
  }, [role])

  useEffect(() => {
    if (role !== 'parent' || activeTab !== 'compte' || linkedChildren.length > 0) return
    fetchLinkedChildren()
  }, [role, activeTab, linkedChildren.length])

  const fetchProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile({
        id: user.id,
        first_name: data.first_name || '',
        birth_date: data.birth_date || '',
        interests: data.interests || [],
        main_language: data.main_language || 'Français',
        gender: data.gender || 'X',
        dark_mode: data.dark_mode || false,
      })
      setAvatarCardId(data.avatar_card_id || null)
    } else {
      setProfile({ id: user.id, first_name: '', birth_date: '', interests: [], main_language: 'Français', gender: 'X', dark_mode: false })
    }
    setLoading(false)
  }

  const saveProfile = async () => {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').upsert({
      id: profile.id,
      first_name: profile.first_name,
      birth_date: profile.birth_date || null,
      interests: profile.interests,
      main_language: profile.main_language,
      gender: profile.gender || 'X',
      dark_mode: profile.dark_mode,
    })
    setSaving(false)
    showToast('Profil mis à jour')
  }

  const toggleInterest = (interest: string) => {
    if (!profile) return
    const current = profile.interests || []
    const updated = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest]
    setProfile({ ...profile, interests: updated })
  }

  const addCustomInterest = () => {
    if (!profile || !newInterest.trim()) return
    if (profile.interests.includes(newInterest.trim())) return
    setProfile({ ...profile, interests: [...profile.interests, newInterest.trim()] })
    setNewInterest('')
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { setPasswordMsg('Les mots de passe ne correspondent pas.'); return }
    if (newPassword.length < 6) { setPasswordMsg('Le mot de passe doit faire au moins 6 caractères.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPasswordMsg('Erreur : ' + error.message)
    else { setPasswordMsg('Mot de passe modifié avec succès.'); setNewPassword(''); setConfirmPassword('') }
  }

  const handleReset = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('progress').delete().eq('user_id', user.id)
    await supabase.from('evaluations').delete().eq('user_id', user.id)
    await supabase.from('revisions').delete().eq('user_id', user.id)
    await supabase.from('events').delete().eq('user_id', user.id)
    await supabase.from('word_lists').delete().eq('user_id', user.id)
    setShowReset(false)
    alert('Compte remis à zéro.')
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Es-tu sûr·e de vouloir supprimer ton compte ? Cette action est définitive et irréversible. Toutes tes données seront effacées.')
    if (!confirmed) return
    const secondConfirm = window.confirm('Dernière confirmation : supprimer définitivement ton compte ODIGO ?')
    if (!secondConfirm) return
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' }
      })
      const result = await response.json()
      if (result.success) { await supabase.auth.signOut(); window.location.href = '/' }
      else showToast('Erreur lors de la suppression', 'error')
    } catch { showToast('Erreur lors de la suppression', 'error') }
    finally { setLoading(false) }
  }

  const handleSaveRole = async () => {
    setSavingRole(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ role }).eq('id', user.id)
    showToast('Rôle mis à jour')
    setTimeout(() => window.location.reload(), 1000)
  }

  const handleUnlinkChild = async (childId: string) => {
    const confirmed = window.confirm(
      'Supprimer le lien avec cet enfant ? ' +
      "L'enfant ne sera plus visible dans ton espace parent."
    )
    if (!confirmed) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('parent_child')
      .delete()
      .eq('parent_id', user.id)
      .eq('child_id', childId)
    setLinkedChildren([])
    await fetchLinkedChildren()
    showToast('Lien supprimé')
  }

  const handleLinkParent = async () => {
    if (!parentCode || parentCode.length < 6) { alert('Entre un code valide à 6 caractères.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: invite } = await supabase.from('invite_codes').select('*').eq('code', parentCode.trim().toUpperCase()).eq('used', false).maybeSingle()
    if (!invite) { showToast('Code introuvable ou déjà utilisé', 'error'); return }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) { showToast('Ce code a expiré. Demande un nouveau code.', 'error'); return }
    if (invite.parent_id === user.id) { alert('Tu ne peux pas te lier à ton propre compte.'); return }
    const { data: existing } = await supabase.from('parent_child').select('*').eq('child_id', user.id)
    if (existing && existing.length >= 2) { alert('Tu as déjà 2 parents liés. Maximum atteint.'); return }
    const { error: linkError } = await supabase.from('parent_child').insert({ parent_id: invite.parent_id, child_id: user.id, relationship: invite.relationship || 'parent' })
    if (linkError) {
      if (linkError.code === '23505') alert('Ce compte parent est déjà lié.')
      else alert('Erreur lors de la liaison des comptes. (' + linkError.message + ')')
      return
    }
    await supabase.from('invite_codes').update({ used: true }).eq('id', invite.id)
    await supabase.from('profiles').upsert({ id: user.id, role: 'child' })
    setParentCode('')
    const { data: parentProfile } = await supabase.from('profiles').select('first_name').eq('id', invite.parent_id).single()
    if (parentProfile) setLinkedParent(parentProfile as { first_name: string })
    alert('Compte parent lié avec succès !')
  }

  const inputStyle = {
    width: '100%', padding: '0.6rem', borderRadius: '0.5rem',
    border: '1px solid #ddd', fontSize: '0.9rem',
    boxSizing: 'border-box' as const, marginBottom: '0.75rem',
  }

  const sectionStyle = {
    background: 'white', borderRadius: '1rem',
    padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '1.5rem',
  }

  const toggleRowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>
  if (!profile) return null

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Barre d'onglets */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '0.75rem', border: 'none',
              background: activeTab === tab.id ? 'var(--color-primary)' : '#e0f0ee',
              color: activeTab === tab.id ? 'white' : 'var(--color-primary)',
              cursor: 'pointer', fontWeight: activeTab === tab.id ? 'bold' : 'normal',
              fontSize: '0.9rem', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ ONGLET 1 — MON PROFIL ═══ */}
      {activeTab === 'profil' && (
        <>
          {/* 1. Mon compte */}
          <div style={sectionStyle}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>👤 Mon compte</h3>

            <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Prénom</label>
            <input
              type="text"
              value={profile.first_name || ''}
              onChange={e => setProfile({ ...profile, first_name: e.target.value })}
              style={inputStyle}
              placeholder="Ton prénom"
              autoComplete="off"
            />

            <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Date de naissance</label>
            <input
              type="date"
              value={profile.birth_date || ''}
              onChange={e => setProfile({ ...profile, birth_date: e.target.value })}
              style={inputStyle}
            />

            <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Tu es...</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {(['M', 'F', 'X'] as const).map((g, i) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setProfile({ ...profile, gender: g })}
                  style={{
                    flex: 1, minWidth: '80px', padding: '0.6rem',
                    background: (profile.gender || 'X') === g ? '#2a9d8f' : 'var(--color-border)',
                    color: (profile.gender || 'X') === g ? 'white' : '#2a9d8f',
                    border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem',
                  }}
                >
                  {['Garçon', 'Fille', 'Préférer ne pas préciser'][i]}
                </button>
              ))}
            </div>

            {avatarCardId && (
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.5rem' }}>Avatar carte actif</div>
                <button
                  onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    await supabase.from('profiles').update({ avatar_card_id: null }).eq('id', user.id)
                    setAvatarCardId(null)
                    showToast('Avatar retiré')
                  }}
                  style={{ padding: '0.4rem 1rem', background: 'white', color: '#888', border: '1px solid #ddd', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Retirer l'avatar carte
                </button>
              </div>
            )}
          </div>

          {/* 2. Rôle */}
          <div style={sectionStyle}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>🎭 Rôle</h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button
                onClick={() => setRole('student')}
                style={{ flex: 1, padding: '0.6rem', background: role === 'student' ? '#2a9d8f' : 'var(--color-border)', color: role === 'student' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                👦 Élève
              </button>
              <button
                onClick={() => setRole('parent')}
                style={{ flex: 1, padding: '0.6rem', background: role === 'parent' ? '#2a9d8f' : 'var(--color-border)', color: role === 'parent' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                👨‍👧 Parent
              </button>
            </div>
            {role === 'parent' && (
              <p style={{ background: '#fff8e0', border: '1px solid #e9c46a', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.85rem', color: '#555', marginBottom: '0.5rem' }}>
                En mode parent, tu accèdes à l'espace de supervision de tes enfants.
              </p>
            )}
            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
              Pour lier ton compte à un compte parent, rendez-vous dans{' '}
              <button
                onClick={() => setActiveTab('compte')}
                style={{ background: 'none', border: 'none', color: '#2a9d8f', cursor: 'pointer', padding: 0, fontSize: '0.8rem', textDecoration: 'underline' }}
              >
                Gestion du compte
              </button>.
            </p>
            <button
              onClick={handleSaveRole}
              disabled={savingRole}
              style={{ marginTop: '0.75rem', padding: '0.5rem 1.2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {savingRole ? 'Enregistrement...' : 'Enregistrer le rôle'}
            </button>
          </div>

          {/* 3. Langue principale */}
          <div style={sectionStyle}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>🌍 Langue principale</h3>
            <select
              value={profile.main_language}
              onChange={e => setProfile({ ...profile, main_language: e.target.value })}
              style={inputStyle}
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* 4. Centres d'intérêt */}
          <div style={sectionStyle}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>🎯 Centres d'intérêt</h3>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Ces informations permettent de personnaliser tes exercices.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {SUGGESTED_INTERESTS.map(interest => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  style={{
                    padding: '0.3rem 0.8rem', borderRadius: '2rem',
                    border: `1px solid ${profile.interests?.includes(interest) ? '#2a9d8f' : '#ddd'}`,
                    background: profile.interests?.includes(interest) ? 'var(--color-background)' : 'white',
                    color: profile.interests?.includes(interest) ? '#2a9d8f' : '#555',
                    cursor: 'pointer', fontSize: '0.85rem',
                  }}
                >
                  {profile.interests?.includes(interest) ? '✓ ' : ''}{interest}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={newInterest}
                onChange={e => setNewInterest(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomInterest()}
                placeholder="Ajouter un centre d'intérêt..."
                autoComplete="off"
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button onClick={addCustomInterest} style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                +
              </button>
            </div>
            {profile.interests?.filter(i => !SUGGESTED_INTERESTS.includes(i)).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                {profile.interests.filter(i => !SUGGESTED_INTERESTS.includes(i)).map(interest => (
                  <span key={interest} style={{ padding: '0.3rem 0.8rem', borderRadius: '2rem', background: 'var(--color-border)', color: '#2a9d8f', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {interest}
                    <button onClick={() => toggleInterest(interest)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a9d8f', padding: 0, fontSize: '0.9rem' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 5. Préférences */}
          <div style={sectionStyle}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>⚙️ Préférences</h3>

            <div style={toggleRowStyle}>
              <div>
                <div style={{ fontWeight: 'bold' }}>🏆 Highscores</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Afficher le classement à la fin des exercices</div>
              </div>
              <button
                onClick={() => { const v = !highscoresEnabled; setHighscoresEnabled(v); localStorage.setItem('odigo_highscores', v ? 'on' : 'off') }}
                style={{ background: highscoresEnabled ? '#2a9d8f' : '#ddd', color: highscoresEnabled ? 'white' : '#666', border: 'none', borderRadius: '1rem', padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.2s', flexShrink: 0 }}
              >
                {highscoresEnabled ? 'Activé' : 'Désactivé'}
              </button>
            </div>

            <div style={toggleRowStyle}>
              <div>
                <div style={{ fontWeight: 'bold' }}>💡 Bulles d'aide</div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>Afficher les bulles d'aide dans l'interface</div>
              </div>
              <button
                onClick={() => { const v = !helpBubbles; setHelpBubbles(v); localStorage.setItem('odigo_help_bubbles', v ? 'on' : 'off') }}
                style={{ background: helpBubbles ? '#2a9d8f' : '#ddd', color: helpBubbles ? 'white' : '#666', border: 'none', borderRadius: '1rem', padding: '0.4rem 1rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', transition: 'all 0.2s', flexShrink: 0 }}
              >
                {helpBubbles ? 'Activé' : 'Désactivé'}
              </button>
            </div>

            <div style={{ ...toggleRowStyle, borderBottom: 'none' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>🌙 Mode nuit</div>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Disponible prochainement</div>
              </div>
              <button disabled style={{ background: '#ddd', color: '#aaa', border: 'none', borderRadius: '1rem', padding: '0.4rem 1rem', cursor: 'not-allowed', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 }}>
                Bientôt
              </button>
            </div>

            {role !== 'parent' && (
              <>
                <div style={{ fontWeight: 'bold', color: '#2a9d8f', marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  🔔 Notifications (point rouge sur Odi)
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🎯 Nouvelles missions</div>
                  <button
                    onClick={() => { const v = !notifMissions; setNotifMissions(v); localStorage.setItem('odigo_notif_missions', v ? 'on' : 'off') }}
                    style={{ background: notifMissions ? '#2a9d8f' : '#ddd', color: notifMissions ? 'white' : '#666', border: 'none', borderRadius: '1rem', padding: '0.3rem 0.9rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}
                  >
                    {notifMissions ? 'Activé' : 'Désactivé'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🎁 Nouvelles récompenses IRL</div>
                  <button
                    onClick={() => { const v = !notifIrl; setNotifIrl(v); localStorage.setItem('odigo_notif_irl', v ? 'on' : 'off') }}
                    style={{ background: notifIrl ? '#2a9d8f' : '#ddd', color: notifIrl ? 'white' : '#666', border: 'none', borderRadius: '1rem', padding: '0.3rem 0.9rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}
                  >
                    {notifIrl ? 'Activé' : 'Désactivé'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🎴 Nouvelles cartes ODIGO</div>
                  <button
                    onClick={() => { const v = !notifCartes; setNotifCartes(v); localStorage.setItem('odigo_notif_cartes', v ? 'on' : 'off') }}
                    style={{ background: notifCartes ? '#2a9d8f' : '#ddd', color: notifCartes ? 'white' : '#666', border: 'none', borderRadius: '1rem', padding: '0.3rem 0.9rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}
                  >
                    {notifCartes ? 'Activé' : 'Désactivé'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Bouton Enregistrer principal */}
          <button
            onClick={saveProfile}
            disabled={saving}
            style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem' }}
          >
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </>
      )}

      {/* ═══ ONGLET 2 — GESTION DU COMPTE ═══ */}
      {activeTab === 'compte' && (
        <>
          {/* 1. Liaison compte parent / enfants liés */}
          {role === 'student' ? (
            <div style={sectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <h3 style={{ color: '#2a9d8f', margin: 0 }}>👨‍👧 Lier au compte parent</h3>
                <HelpBubble
                  title="Comment lier ton compte à celui de ton parent ?"
                  position="bottom"
                  content={
                    <div>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 'bold' }}>Option 1 — Par code</p>
                      <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
                        <li>Demande à ton parent de générer un code depuis son Espace parent</li>
                        <li>Saisis ce code dans le champ ci-dessous</li>
                        <li>Clique sur "Lier"</li>
                      </ol>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 'bold' }}>Option 2 — Par lien</p>
                      <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.25rem' }}>
                        <li>Demande à ton parent de générer un lien depuis son Espace parent</li>
                        <li>Clique sur le lien reçu (SMS, email...)</li>
                        <li>Confirme la liaison</li>
                      </ol>
                      <p style={{ color: '#888', fontSize: '0.8rem', margin: 0 }}>Le code et le lien sont valables 48 heures.</p>
                    </div>
                  }
                />
              </div>

              {linkedParent ? (
                <div style={{ background: '#f0faf8', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: '#2a9d8f' }}>
                  ✓ Lié au compte de <strong>{linkedParent.first_name}</strong>
                </div>
              ) : (
                <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Entre le code fourni par ton parent pour lier les comptes.
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={parentCode}
                  onChange={e => setParentCode(e.target.value.toUpperCase())}
                  placeholder="Code parent (ex: AB12CD)"
                  autoComplete="off"
                  maxLength={6}
                  style={{ ...inputStyle, marginBottom: 0, flex: 1, letterSpacing: '0.2rem', fontWeight: 'bold' }}
                />
                <button onClick={handleLinkParent} style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Lier
                </button>
              </div>

              {linkedParents.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#888' }}>Parents liés</label>
                  {linkedParents.map(parent => (
                    <div key={parent.id} style={{
                      display: 'flex', alignItems: 'center',
                      padding: '0.6rem 0.75rem',
                      background: '#f0faf8',
                      borderRadius: '0.5rem',
                      marginTop: '0.4rem',
                      fontSize: '0.9rem',
                    }}>
                      👤 {parent.relationship} ({parent.first_name})
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={sectionStyle}>
              <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>👨‍👧 Enfants liés</h3>
              {loadingChildren ? (
                <p style={{ color: '#888', fontSize: '0.9rem' }}>Chargement...</p>
              ) : linkedChildren.length === 0 ? (
                <>
                  <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Aucun enfant lié. Rendez-vous dans l'Espace parent pour générer un code ou un lien d'invitation.
                  </p>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('parent')}
                      style={{ padding: '0.6rem 1.2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      Aller à l'Espace parent →
                    </button>
                  )}
                </>
              ) : (
                <div>
                  {linkedChildren.map(child => (
                    <div key={child.id} style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.75rem',
                      background: '#f0faf8',
                      borderRadius: '0.5rem',
                      marginTop: '0.4rem',
                    }}>
                      <span style={{ fontSize: '0.9rem' }}>👤 {child.first_name}</span>
                      <button
                        onClick={() => handleUnlinkChild(child.id)}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', color: '#e63946',
                          fontSize: '1rem', padding: '0.2rem 0.4rem',
                          borderRadius: '0.25rem',
                        }}
                        title="Supprimer le lien"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. Modifier le mot de passe */}
          <div style={sectionStyle}>
            <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>🔒 Modifier mon mot de passe</h3>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nouveau mot de passe" style={inputStyle} />
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirmer le mot de passe" style={inputStyle} />
            {passwordMsg && (
              <p style={{ color: passwordMsg.includes('succès') ? '#2a9d8f' : '#e63946', fontSize: '0.85rem' }}>{passwordMsg}</p>
            )}
            <button onClick={handleChangePassword} style={{ padding: '0.6rem 1.2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              Modifier
            </button>
          </div>

          {/* 3. Repartir de zéro */}
          <div style={{ ...sectionStyle, border: '1px solid #fce4ec' }}>
            <h3 style={{ color: '#e9c46a', marginBottom: '0.5rem' }}>🔄 Repartir de zéro</h3>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Supprime toutes tes données (évaluations, révisions, listes de mots, Digoos). Ton compte reste actif mais vide.
            </p>
            {!showReset ? (
              <button onClick={() => setShowReset(true)} style={{ padding: '0.6rem 1.2rem', background: 'white', color: '#e9c46a', border: '1px solid #e9c46a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                Repartir de zéro
              </button>
            ) : (
              <div style={{ background: '#fffbf0', borderRadius: '0.5rem', padding: '1rem' }}>
                <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Cette action est irréversible. Confirme avec ton mot de passe.
                </p>
                <input
                  type="password"
                  value={dangerPassword}
                  onChange={e => setDangerPassword(e.target.value)}
                  placeholder="Confirme avec ton mot de passe"
                  autoComplete="off"
                  style={inputStyle}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser()
                      const { error } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: dangerPassword })
                      if (error) { alert('Mot de passe incorrect.'); return }
                      await handleReset()
                      setDangerPassword('')
                    }}
                    style={{ padding: '0.5rem 1rem', background: '#e9c46a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Confirmer la remise à zéro
                  </button>
                  <button onClick={() => { setShowReset(false); setDangerPassword('') }} style={{ padding: '0.5rem 1rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Supprimer le compte */}
          <div style={{ ...sectionStyle, border: '1px solid #fce4ec' }}>
            <h3 style={{ color: '#e63946', marginBottom: '0.5rem' }}>🗑️ Supprimer mon compte</h3>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Action définitive et irréversible. Toutes tes données seront effacées.
            </p>
            <button onClick={handleDeleteAccount} style={{ padding: '0.6rem 1.2rem', background: 'white', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              Supprimer mon compte
            </button>
          </div>
        </>
      )}
    </div>
  )
}
