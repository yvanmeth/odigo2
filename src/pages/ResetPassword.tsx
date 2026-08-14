import { useState } from 'react'
import { supabase } from '../lib/supabase'

const PRIMARY = '#2a9d8f'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem 1rem',
  border: '1px solid #ddd', borderRadius: '0.5rem',
  fontSize: '0.95rem', marginBottom: '1rem',
  boxSizing: 'border-box', outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  padding: '0.75rem 1.5rem', background: PRIMARY,
  color: 'white', border: 'none', borderRadius: '0.5rem',
  cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold',
}

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleReset = async () => {
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) {
      setError('Erreur : ' + err.message)
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
    setTimeout(() => { window.location.href = '/' }, 3000)
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f0faf8', padding: '1rem',
  }

  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '1rem', padding: '2rem',
    maxWidth: '400px', width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  }

  if (done) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: PRIMARY, marginBottom: '0.5rem' }}>
            Mot de passe mis à jour !
          </p>
          <p style={{ color: '#888', fontSize: '0.9rem' }}>
            Tu vas être redirigé vers la page de connexion...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img src="/odigo-logo.svg" alt="Odigo" style={{ height: '48px', marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333', margin: 0 }}>
            Nouveau mot de passe
          </p>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.4rem' }}>
            Choisis un nouveau mot de passe pour ton compte ODIGO.
          </p>
        </div>
        <input
          type="password"
          placeholder="Nouveau mot de passe (min. 6 caractères)"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          style={inputStyle}
          autoFocus
        />
        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleReset() }}
          style={inputStyle}
        />
        {error && (
          <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>
        )}
        <button
          onClick={handleReset}
          disabled={loading || !newPassword || !confirmPassword}
          style={{ ...btnPrimary, width: '100%', opacity: (newPassword && confirmPassword) ? 1 : 0.5, cursor: (newPassword && confirmPassword) ? 'pointer' : 'default' }}
        >
          {loading ? 'Mise à jour...' : 'Enregistrer le mot de passe'}
        </button>
      </div>
    </div>
  )
}
