import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Profile {
  id: string
  first_name?: string
  birth_date?: string
  interests: string[]
  main_language: string
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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newInterest, setNewInterest] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [parentCode, setParentCode] = useState('')

  useEffect(() => {
    fetchProfile()
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
        dark_mode: data.dark_mode || false,
      })
    } else {
      setProfile({
        id: user.id,
        first_name: '',
        birth_date: '',
        interests: [],
        main_language: 'Français',
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
      dark_mode: profile.dark_mode,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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

  const handleDelete = async () => {
    await handleReset()
    await supabase.auth.signOut()
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
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
          />
          <button
            onClick={addCustomInterest}
            style={{ padding: '0.6rem 1rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
          >
            +
          </button>
        </div>

        {/* Intérêts personnalisés ajoutés */}
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
      </div>

      {/* Bouton sauvegarder */}
      <button
        onClick={saveProfile}
        disabled={saving}
        style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', marginBottom: '1.5rem' }}
      >
        {saving ? 'Sauvegarde...' : saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
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
        {passwordMsg && <p style={{ color: passwordMsg.includes('succès') ? '#2a9d8f' : '#e63946', fontSize: '0.85rem' }}>{passwordMsg}</p>}
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
            onChange={e => setParentCode(e.target.value)}
            placeholder="Code parent"
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
          />
          <button
            onClick={() => alert('Fonctionnalité compte parent à venir.')}
            style={{ padding: '0.6rem 1rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
          >
            Lier
          </button>
        </div>
      </div>

      {/* Zone danger */}
      <div style={{ ...sectionStyle, border: '1px solid #ffe0e0' }}>
        <h3 style={{ color: '#e63946', marginBottom: '1rem' }}>⚠️ Zone dangereuse</h3>

        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            style={{ padding: '0.6rem 1.2rem', background: 'white', color: '#e63946', border: '1px solid #e63946', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', marginRight: '0.75rem' }}
          >
            Remettre à zéro
          </button>
        ) : (
          <div style={{ background: '#fff5f5', borderRadius: '0.5rem', padding: '1rem', marginBottom: '0.75rem' }}>
            <p style={{ color: '#e63946', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              ⚠️ Cette action supprime toutes tes données (évaluations, révisions, listes, Digoos). Irréversible.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleReset} style={{ padding: '0.5rem 1rem', background: '#e63946', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Confirmer
              </button>
              <button onClick={() => setShowReset(false)} style={{ padding: '0.5rem 1rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            style={{ padding: '0.6rem 1.2rem', background: '#e63946', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Supprimer le compte
          </button>
        ) : (
          <div style={{ background: '#fff5f5', borderRadius: '0.5rem', padding: '1rem' }}>
            <p style={{ color: '#e63946', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              ⚠️ Cette action supprime définitivement ton compte et toutes tes données.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleDelete} style={{ padding: '0.5rem 1rem', background: '#e63946', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Supprimer définitivement
              </button>
              <button onClick={() => setShowDelete(false)} style={{ padding: '0.5rem 1rem', background: '#eee', color: '#555', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}