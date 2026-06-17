import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

interface Profile {
  id: string
  first_name?: string
  birth_date?: string
  interests: string[]
  main_language: string
  gender?: 'M' | 'F' | 'X'
  dark_mode: boolean
}

const SUGGESTED_INTERESTS = [
  'Musique', 'Sport', 'Jeux vidéo', 'Lecture', 'Cinéma', 'Cuisine',
  'Dessin', 'Voyage', 'Nature', 'Sciences', 'Histoire', 'Manga',
  'Animé', 'Mode', 'Danse', 'Théâtre', 'Informatique', 'Animaux'
]

const LANGUAGES = ['Français', 'Anglais', 'Allemand', 'Espagnol', 'Grec', 'Arabe', 'Italien']

export default function Settings() {
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
  const [feedbackType, setFeedbackType] = useState<'bug' | 'idee' | 'autre'>('idee')
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles')
        .select('role').eq('id', user.id).single()
      if (data?.role === 'parent') setRole('parent')
    }
    fetchRole()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

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
      setProfile({
        id: user.id,
        first_name: '',
        birth_date: '',
        interests: [],
        main_language: 'Français',
        gender: 'X',
        dark_mode: false,
      })
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
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPasswordMsg('Erreur : ' + error.message)
    else {
      setPasswordMsg('Mot de passe modifié avec succès.')
      setNewPassword('')
      setConfirmPassword('')
    }
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
    const confirmed = window.confirm(
      'Es-tu sûr·e de vouloir supprimer ton compte ? ' +
      'Cette action est définitive et irréversible. ' +
      'Toutes tes données seront effacées.'
    )
    if (!confirmed) return

    const secondConfirm = window.confirm(
      'Dernière confirmation : supprimer définitivement ' +
      'ton compte ODIGO ?'
    )
    if (!secondConfirm) return

    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          }
        }
      )

      const result = await response.json()

      if (result.success) {
        await supabase.auth.signOut()
        window.location.href = '/'
      } else {
        showToast('Erreur lors de la suppression', 'error')
      }
    } catch {
      showToast('Erreur lors de la suppression', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleFeedback = async () => {
    if (!feedbackText.trim()) return
    setFeedbackLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Non connecté', 'error'); return }
      const { error } = await supabase.from('suggestions').insert({
        user_id: user.id,
        text: `[${feedbackType.toUpperCase()}] ${feedbackText.trim()}`,
        created_at: new Date().toISOString(),
      })
      if (!error) {
        setFeedbackSent(true)
        setFeedbackText('')
        setTimeout(() => setFeedbackSent(false), 4000)
      } else {
        showToast('Erreur lors de l\'envoi', 'error')
      }
    } catch {
      showToast('Erreur lors de l\'envoi', 'error')
    } finally {
      setFeedbackLoading(false)
    }
  }

  const handleSaveRole = async () => {
    setSavingRole(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({ role }).eq('id', user.id)
    }
    showToast('Rôle mis à jour')
    setTimeout(() => window.location.reload(), 1000)
  }

  const inputStyle = {
    width: '100%',
    padding: '0.6rem',
    borderRadius: '0.5rem',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    boxSizing: 'border-box' as const,
    marginBottom: '0.75rem',
  }

  const sectionStyle = {
    background: 'white',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    marginBottom: '1.5rem',
  }

  if (loading) return <p style={{ color: '#888' }}>Chargement...</p>
  if (!profile) return null

  return (
    <div style={{ maxWidth: '600px' }}>

      {/* Compte */}
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

        <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Langue principale</label>
        <select
          value={profile.main_language}
          onChange={e => setProfile({ ...profile, main_language: e.target.value })}
          style={inputStyle}
        >
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Tu es...</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {(['M', 'F', 'X'] as const).map((g, i) => (
            <button
              key={g}
              type="button"
              onClick={() => setProfile({ ...profile, gender: g })}
              style={{
                flex: 1, minWidth: '80px', padding: '0.6rem',
                background: (profile.gender || 'X') === g ? '#2a9d8f' : '#e0f0ee',
                color: (profile.gender || 'X') === g ? 'white' : '#2a9d8f',
                border: 'none', borderRadius: '0.5rem',
                cursor: 'pointer', fontSize: '0.82rem',
              }}
            >
              {['Garçon', 'Fille', 'Préférer ne pas préciser'][i]}
            </button>
          ))}
        </div>
      </div>

      {/* Rôle */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>🎭 Rôle</h3>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button
            onClick={() => setRole('student')}
            style={{ flex: 1, padding: '0.6rem', background: role === 'student' ? '#2a9d8f' : '#e0f0ee', color: role === 'student' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            👦 Élève
          </button>
          <button
            onClick={() => setRole('parent')}
            style={{ flex: 1, padding: '0.6rem', background: role === 'parent' ? '#2a9d8f' : '#e0f0ee', color: role === 'parent' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            👨‍👧 Parent
          </button>
        </div>

        {role === 'parent' && (
          <p style={{ background: '#fff8e0', border: '1px solid #e9c46a', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.85rem', marginTop: '0.5rem', color: '#555' }}>
            En mode parent, tu accèdes à l'espace de supervision de tes enfants. Tu peux revenir en mode élève à tout moment.
          </p>
        )}

        <button
          onClick={handleSaveRole}
          disabled={savingRole}
          style={{ marginTop: '1rem', padding: '0.6rem 1.2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          {savingRole ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* Centres d'intérêt */}
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
                padding: '0.3rem 0.8rem',
                borderRadius: '2rem',
                border: `1px solid ${profile.interests?.includes(interest) ? '#2a9d8f' : '#ddd'}`,
                background: profile.interests?.includes(interest) ? '#f0faf8' : 'white',
                color: profile.interests?.includes(interest) ? '#2a9d8f' : '#555',
                cursor: 'pointer',
                fontSize: '0.85rem',
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
          <button
            onClick={addCustomInterest}
            style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
          >
            +
          </button>
        </div>

        {profile.interests?.filter(i => !SUGGESTED_INTERESTS.includes(i)).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
            {profile.interests.filter(i => !SUGGESTED_INTERESTS.includes(i)).map(interest => (
              <span
                key={interest}
                style={{ padding: '0.3rem 0.8rem', borderRadius: '2rem', background: '#e0f0ee', color: '#2a9d8f', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                {interest}
                <button
                  onClick={() => toggleInterest(interest)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a9d8f', padding: 0, fontSize: '0.9rem' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Interface */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>🎨 Interface</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#555', fontSize: '0.9rem' }}>Mode nuit</span>
          <button
            onClick={() => setProfile({ ...profile, dark_mode: !profile.dark_mode })}
            style={{
              width: '48px',
              height: '26px',
              borderRadius: '13px',
              background: profile.dark_mode ? '#2a9d8f' : '#ddd',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: '3px',
              left: profile.dark_mode ? '25px' : '3px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
        <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Le mode nuit sera disponible prochainement.
        </p>
        {avatarCardId && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f0f0f0' }}>
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

      {/* Bouton sauvegarder */}
      <button
        onClick={saveProfile}
        disabled={saving}
        style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem' }}
      >
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>

      {/* Mot de passe */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '1rem' }}>🔒 Modifier le mot de passe</h3>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="Nouveau mot de passe"
          style={inputStyle}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirmer le mot de passe"
          style={inputStyle}
        />
        {passwordMsg && (
          <p style={{ color: passwordMsg.includes('succès') ? '#2a9d8f' : '#e63946', fontSize: '0.85rem' }}>
            {passwordMsg}
          </p>
        )}
        <button
          onClick={handleChangePassword}
          style={{ padding: '0.6rem 1.2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          Modifier
        </button>
      </div>

      {/* Compte parent */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>👨‍👧 Compte parent</h3>
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Entre le code fourni par ton parent pour lier les comptes.
        </p>
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
          <button
            onClick={async () => {
              if (!parentCode || parentCode.length < 6) {
                alert('Entre un code valide à 6 caractères.')
                return
              }
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return

              // Vérifier le code
              const { data: invite } = await supabase
                .from('invite_codes')
                .select('*')
                .eq('code', parentCode)
                .eq('used', false)
                .gte('expires_at', new Date().toISOString())
                .single()

              if (!invite) {
                alert('Code invalide ou expiré.')
                return
              }

              if (invite.parent_id === user.id) {
                alert('Tu ne peux pas te lier à ton propre compte.')
                return
              }

              // Vérifier max 2 parents
              const { data: existing } = await supabase
                .from('parent_child')
                .select('*')
                .eq('child_id', user.id)

              if (existing && existing.length >= 2) {
                alert('Tu as déjà 2 parents liés. Maximum atteint.')
                return
              }

              // Créer le lien
              await supabase.from('parent_child').insert({
                parent_id: invite.parent_id,
                child_id: user.id,
                relationship: 'parent',
              })

              // Marquer le code comme utilisé
              await supabase.from('invite_codes').update({ used: true }).eq('id', invite.id)

              // Mettre à jour le profil enfant
              await supabase.from('profiles').upsert({ id: user.id, role: 'child' })

              setParentCode('')
              alert('Compte parent lié avec succès !')
            }}
            style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
          >
            Lier
          </button>
        </div>
      </div>

      {/* Supprimer / Reset */}
      <div style={{ ...sectionStyle, border: '1px solid #eee' }}>
        <h3 style={{ color: '#555', marginBottom: '0.5rem' }}>Supprimer le compte ou repartir de zéro</h3>
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Ces actions sont irréversibles. Ton mot de passe sera demandé pour confirmer.
        </p>

        {!showReset && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowReset(true)}
              style={{ padding: '0.6rem 1.2rem', background: 'white', color: '#e9c46a', border: '1px solid #e9c46a', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Repartir de zéro
            </button>
            <button
              onClick={handleDeleteAccount}
              style={{ padding: '0.6rem 1.2rem', background: 'white', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              Supprimer le compte
            </button>
          </div>
        )}

        {showReset && (
          <div style={{ background: '#fffbf0', borderRadius: '0.5rem', padding: '1rem' }}>
            <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              <strong>Repartir de zéro</strong> supprime toutes tes données : évaluations, révisions, événements, listes de mots et Digoos. Ton compte reste actif mais vide.
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
                  const { error } = await supabase.auth.signInWithPassword({
                    email: user?.email || '',
                    password: dangerPassword,
                  })
                  if (error) {
                    alert('Mot de passe incorrect.')
                    return
                  }
                  await handleReset()
                  setDangerPassword('')
                }}
                style={{ padding: '0.5rem 1rem', background: '#e9c46a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Confirmer la remise à zéro
              </button>
              <button
                onClick={() => { setShowReset(false); setDangerPassword('') }}
                style={{ padding: '0.5rem 1rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Feedback */}
      <div style={sectionStyle}>
        <h3 style={{ color: '#2a9d8f', marginBottom: '0.25rem' }}>💬 Signaler ou suggérer</h3>
        <p style={{ color: '#aaa', fontSize: '0.82rem', marginBottom: '1rem' }}>
          Tu as trouvé un bug ou tu as une idée pour améliorer ODIGO ? Dis-le nous !
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0' }}>
          {([
            { value: 'bug', label: '🐛 Bug' },
            { value: 'idee', label: '💡 Idée' },
            { value: 'autre', label: '💬 Autre' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFeedbackType(value)}
              style={{
                flex: 1, padding: '0.6rem',
                background: feedbackType === value ? '#2a9d8f' : '#e0f0ee',
                color: feedbackType === value ? 'white' : '#2a9d8f',
                border: 'none', borderRadius: '0.5rem',
                cursor: 'pointer', fontSize: '0.82rem',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={feedbackText}
          onChange={e => setFeedbackText(e.target.value)}
          placeholder={
            feedbackType === 'bug'
              ? "Décris le problème : que s'est-il passé ?"
              : feedbackType === 'idee'
              ? "Décris ton idée d'amélioration..."
              : "Ton message..."
          }
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #e0f0ee',
            fontSize: '0.9rem',
            fontFamily: 'Nunito, sans-serif',
            resize: 'vertical',
            marginTop: '0.75rem',
            boxSizing: 'border-box',
          }}
        />

        {feedbackSent ? (
          <div style={{ color: '#2a9d8f', fontWeight: 'bold', textAlign: 'center', padding: '0.5rem' }}>
            ✓ Message envoyé, merci !
          </div>
        ) : (
          <button
            onClick={handleFeedback}
            disabled={!feedbackText.trim() || feedbackLoading}
            style={{
              background: feedbackText.trim() ? '#2a9d8f' : '#e0f0ee',
              color: feedbackText.trim() ? 'white' : '#aaa',
              border: 'none', borderRadius: '0.5rem',
              padding: '0.6rem 1.5rem', cursor: feedbackText.trim() ? 'pointer' : 'default',
              fontWeight: 'bold', marginTop: '0.75rem',
              width: '100%', fontSize: '0.9rem',
            }}
          >
            {feedbackLoading ? 'Envoi...' : 'Envoyer'}
          </button>
        )}
      </div>

    </div>
  )
}