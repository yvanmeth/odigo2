import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [gender, setGender] = useState<'M' | 'F' | 'X'>('X')
  const [role, setRole] = useState<'student' | 'parent'>('student')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, gender, role })
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
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
        {isSignUp && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Tu es...</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(['M', 'F', 'X'] as const).map((g, i) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  style={{
                    flex: 1, minWidth: '80px', padding: '0.6rem',
                    background: gender === g ? '#2a9d8f' : '#e0f0ee',
                    color: gender === g ? 'white' : '#2a9d8f',
                    border: 'none', borderRadius: '0.5rem',
                    cursor: 'pointer', fontSize: '0.82rem',
                  }}
                >
                  {['Garçon', 'Fille', 'Préférer ne pas préciser'][i]}
                </button>
              ))}
            </div>
          </div>
        )}
        {isSignUp && (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Tu es...</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setRole('student')}
                style={{
                  flex: 1, padding: '0.6rem',
                  background: role === 'student' ? '#2a9d8f' : '#e0f0ee',
                  color: role === 'student' ? 'white' : '#2a9d8f',
                  border: 'none', borderRadius: '0.5rem',
                  cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                👦 Élève
              </button>
              <button
                type="button"
                onClick={() => setRole('parent')}
                style={{
                  flex: 1, padding: '0.6rem',
                  background: role === 'parent' ? '#2a9d8f' : '#e0f0ee',
                  color: role === 'parent' ? 'white' : '#2a9d8f',
                  border: 'none', borderRadius: '0.5rem',
                  cursor: 'pointer', fontSize: '0.85rem',
                }}
              >
                👨‍👧 Parent
              </button>
            </div>
          </div>
        )}
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