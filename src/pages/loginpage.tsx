import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0faf8', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', padding: '2.5rem', borderRadius: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '380px' }}>
        <h1 style={{ color: '#2a9d8f', marginBottom: '0.25rem' }}>ODIGO</h1>
        <p style={{ color: '#2a9d8f', fontSize: '0.85rem', marginBottom: '0.25rem', fontStyle: 'italic' }}>Planifier, apprendre, s'amuser</p>
        <p style={{ color: '#666', marginBottom: '2rem' }}>{isSignUp ? 'Créer un compte' : 'Connexion'}</p>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '1rem', boxSizing: 'border-box' }} />
        <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '1rem', boxSizing: 'border-box' }} />
        {error && <p style={{ color: 'red', fontSize: '0.85rem' }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}>
          {loading ? 'Chargement...' : isSignUp ? 'Créer le compte' : 'Se connecter'}
        </button>
        <p onClick={() => setIsSignUp(!isSignUp)} style={{ textAlign: 'center', color: '#2a9d8f', cursor: 'pointer', marginTop: '1rem', fontSize: '0.9rem' }}>
          {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
        </p>
      </div>
    </div>
  )
}