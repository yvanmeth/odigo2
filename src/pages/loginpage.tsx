import { useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import GuestMode from './GuestMode'

type AuthStep = 'login' | 'signup-1' | 'signup-2' | 'signup-3' | 'confirm'

export default function LoginPage() {
  const [guestMode, setGuestMode] = useState(false)
  const [step, setStep] = useState<AuthStep>('login')

  // Champs communs
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Champs inscription
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'M' | 'F' | 'X'>('X')
  const [selectedRole, setSelectedRole] = useState<'student' | 'parent'>('student')

  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const [showChildLogin, setShowChildLogin] = useState(false)
  const [childFirstName, setChildFirstName] = useState('')
  const [childPassword, setChildPassword] = useState('')

  const isSignupStep = step === 'signup-1' || step === 'signup-2' || step === 'signup-3'
  const stepNum = step === 'signup-1' ? 1 : step === 'signup-2' ? 2 : step === 'signup-3' ? 3 : 0
  const progressWidth = stepNum === 1 ? '33%' : stepNum === 2 ? '66%' : '100%'

  const step1Valid = email.trim() !== '' && password.length >= 6 && password === confirmPassword
  const step2Valid = firstName.trim() !== '' && birthDate !== ''

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) console.error('Reset password error:', error)
    setForgotSent(true)
    setForgotLoading(false)
  }

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  const handleCreateAccount = async () => {
    setLoading(true)
    setError('')
    localStorage.setItem('odigo_pending_profile', JSON.stringify({
      first_name: firstName,
      birth_date: birthDate,
      gender: gender,
      role: selectedRole,
    }))
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        first_name: firstName,
        birth_date: birthDate,
        gender,
        role: selectedRole,
        has_met_odigo: false,
      })
    }
    setLoading(false)
    setStep('confirm')
  }

  const goTo = (s: AuthStep) => { setError(''); setStep(s) }

  const handleChildLogin = async () => {
    if (!childFirstName.trim() || !childPassword) return
    setLoading(true)
    setError('')
    const { data: emailData } = await supabase.rpc(
      'get_child_email_by_name',
      { child_first_name: childFirstName.trim() }
    )
    if (!emailData) {
      setError('Prénom introuvable')
      setLoading(false)
      return
    }
    const { error: err } = await supabase.auth.signInWithPassword({
      email: emailData,
      password: childPassword,
    })
    if (err) setError('Mot de passe incorrect')
    setLoading(false)
  }

  if (guestMode) return <GuestMode onExit={() => setGuestMode(false)} />

  // ==================== STYLES ====================

  const containerStyle: CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'var(--color-background)', fontFamily: 'sans-serif',
  }

  const cardStyle: CSSProperties = {
    background: 'white', padding: '2.5rem', borderRadius: '1rem',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%',
    maxWidth: isSignupStep ? '420px' : '380px',
    boxSizing: 'border-box',
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '0.75rem', marginBottom: '1rem',
    borderRadius: '0.5rem', border: '1px solid #ddd',
    fontSize: '1rem', boxSizing: 'border-box',
  }

  const btnPrimary: CSSProperties = {
    flex: 1, padding: '0.75rem', background: '#2a9d8f',
    color: 'white', border: 'none', borderRadius: '0.5rem',
    fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold',
  }

  const btnSecondary: CSSProperties = {
    padding: '0.75rem 1.25rem', background: 'var(--color-border)',
    color: '#2a9d8f', border: 'none', borderRadius: '0.5rem',
    fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold',
  }

  const linkStyle: CSSProperties = {
    textAlign: 'center', color: '#2a9d8f', cursor: 'pointer',
    marginTop: '1rem', fontSize: '0.9rem',
  }

  // ==================== BLOCS PARTAGÉS ====================

  const logo = (
    <div style={{ marginBottom: '0.5rem' }}>
      <img src="/logo-full.svg" alt="ODIGO" style={{ width: '180px', marginBottom: '0.5rem' }} />
    </div>
  )

  const progressBar = isSignupStep && (
    <div style={{ height: '4px', background: 'var(--color-border)', borderRadius: '2px', marginBottom: '1.5rem' }}>
      <div style={{ height: '100%', background: '#2a9d8f', borderRadius: '2px', width: progressWidth, transition: 'width 0.3s ease' }} />
    </div>
  )

  const stepHeader = isSignupStep && (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
      <h2 style={{ margin: 0, color: '#333', fontSize: '1.2rem' }}>
        {step === 'signup-1' ? 'Créer un compte' : step === 'signup-2' ? 'Qui es-tu ?' : 'Ton profil'}
      </h2>
      <span style={{ fontSize: '0.85rem', color: '#aaa', fontWeight: 'bold' }}>{stepNum} / 3</span>
    </div>
  )

  // ==================== CHILD LOGIN ====================

  if (step === 'login' && showChildLogin) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {logo}
          <p style={{ color: '#5c6bc0', margin: '0 0 1.5rem', fontWeight: 'bold' }}>Connexion enfant</p>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
            Entre ton prénom et le mot de passe que ton parent a créé pour toi.
          </p>
          <input
            type="text" placeholder="Ton prénom" value={childFirstName}
            onChange={e => setChildFirstName(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Mot de passe" value={childPassword}
            onChange={e => setChildPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleChildLogin() }}
            style={inputStyle}
          />
          {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
          <button onClick={handleChildLogin} disabled={loading || !childFirstName.trim() || !childPassword} style={{ ...btnPrimary, width: '100%', background: '#5c6bc0' }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          <p onClick={() => { setShowChildLogin(false); setError('') }} style={{ ...linkStyle, color: '#888' }}>
            ← Retour
          </p>
        </div>
      </div>
    )
  }

  // ==================== LOGIN ====================

  if (step === 'login') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {logo}
          <p style={{ color: '#666', margin: '0 0 1.5rem', fontSize: '1rem' }}>Connexion</p>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Mot de passe" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
            style={inputStyle}
          />
          <button
            onClick={() => { setForgotEmail(email); setShowForgotPassword(true) }}
            style={{ background: 'none', border: 'none', color: '#2a9d8f', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', padding: 0, marginTop: '0.25rem', display: 'block', textAlign: 'right', width: '100%' }}
          >
            Mot de passe oublié ?
          </button>
          {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '0.75rem', marginTop: '0.75rem' }}>{error}</p>}
          <button onClick={handleLogin} disabled={loading} style={{ ...btnPrimary, width: '100%', marginTop: '1rem' }}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
          <p onClick={() => goTo('signup-1')} style={linkStyle}>
            Pas de compte ? S'inscrire
          </p>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setGuestMode(true)}
              style={{
                background: 'none', border: '2px solid #2a9d8f', color: '#2a9d8f',
                borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
                cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', width: '100%',
              }}
            >
              🔍 Découvrir sans compte
            </button>
            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem', lineHeight: 1.4 }}>
              En tant qu'invité·e, tu auras accès à quelques exercices pour découvrir ODIGO. Aucune inscription requise.
            </p>
          </div>

          <div style={{ textAlign: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={() => { setShowChildLogin(true); setError('') }}
              style={{ background: 'none', border: '2px solid #5c6bc0', color: '#5c6bc0', borderRadius: '0.75rem', padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', width: '100%' }}
            >
              👶 Se connecter sans email (compte enfant)
            </button>
            <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.4rem' }}>
              Pour les enfants qui n'ont pas d'adresse email
            </p>
          </div>
        </div>

        {/* Modal mot de passe oublié */}
        {showForgotPassword && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', width: '90%' }}>
              {forgotSent ? (
                <>
                  <p style={{ fontSize: '1.1rem', color: '#2a9d8f', fontWeight: 'bold', marginBottom: '0.75rem' }}>✅ Email envoyé !</p>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Vérifie ta boîte mail (et tes spams si besoin).
                  </p>
                  <button
                    onClick={() => { setShowForgotPassword(false); setForgotSent(false) }}
                    style={{ ...btnPrimary, width: '100%' }}
                  >
                    Fermer
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333', marginBottom: '0.5rem' }}>Réinitialiser le mot de passe</p>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                    Saisis ton adresse email. Tu recevras un lien pour choisir un nouveau mot de passe.
                  </p>
                  <input
                    type="email"
                    placeholder="Email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleForgotPassword() }}
                    style={{ ...inputStyle, marginBottom: '1rem' }}
                    autoFocus
                  />
                  <button
                    onClick={handleForgotPassword}
                    disabled={forgotLoading || !forgotEmail.trim()}
                    style={{ ...btnPrimary, width: '100%', marginBottom: '0.5rem', opacity: forgotEmail.trim() ? 1 : 0.5 }}
                  >
                    {forgotLoading ? 'Envoi...' : 'Envoyer le lien'}
                  </button>
                  <button
                    onClick={() => setShowForgotPassword(false)}
                    style={{ width: '100%', padding: '0.75rem', background: 'none', border: '1px solid #ddd', borderRadius: '0.5rem', cursor: 'pointer', color: '#888', fontSize: '0.95rem' }}
                  >
                    Annuler
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==================== ÉTAPE 1 — EMAIL + MDP ====================

  if (step === 'signup-1') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {logo}
          {progressBar}
          {stepHeader}
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Mot de passe (min. 6 caractères)" value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Confirmer le mot de passe" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={{ ...inputStyle, marginBottom: confirmPassword && password !== confirmPassword ? '0.5rem' : '1.5rem' }}
          />
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Les mots de passe ne correspondent pas.
            </p>
          )}
          <button
            onClick={() => goTo('signup-2')}
            disabled={!step1Valid}
            style={{ ...btnPrimary, width: '100%', opacity: step1Valid ? 1 : 0.5, cursor: step1Valid ? 'pointer' : 'default' }}
          >
            Suivant →
          </button>
          <p onClick={() => goTo('login')} style={linkStyle}>
            Déjà un compte ? Se connecter
          </p>
        </div>
      </div>
    )
  }

  // ==================== ÉTAPE 2 — INFOS PERSONNELLES ====================

  if (step === 'signup-2') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {logo}
          {progressBar}
          {stepHeader}
          <input
            type="text" placeholder="Prénom" value={firstName}
            onChange={e => setFirstName(e.target.value)}
            style={inputStyle}
          />
          <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
            Date de naissance
          </label>
          <input
            type="date" value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            style={{ ...inputStyle, marginBottom: '1rem' }}
          />
          <label style={{ display: 'block', color: '#555', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Tu es...
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {(['M', 'F', 'X'] as const).map((g, i) => (
              <button
                key={g} type="button" onClick={() => setGender(g)}
                style={{
                  flex: 1, minWidth: '80px', padding: '0.6rem',
                  background: gender === g ? '#2a9d8f' : 'var(--color-border)',
                  color: gender === g ? 'white' : '#2a9d8f',
                  border: 'none', borderRadius: '0.5rem',
                  cursor: 'pointer', fontSize: '0.82rem',
                }}
              >
                {['Garçon', 'Fille', 'Préférer ne pas préciser'][i]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => goTo('signup-1')} style={btnSecondary}>← Retour</button>
            <button
              onClick={() => goTo('signup-3')}
              disabled={!step2Valid}
              style={{ ...btnPrimary, opacity: step2Valid ? 1 : 0.5, cursor: step2Valid ? 'pointer' : 'default' }}
            >
              Suivant →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== ÉTAPE 3 — PROFIL ====================

  if (step === 'signup-3') {
    const roleCard = (value: 'student' | 'parent', emoji: string, title: string, desc: string) => (
      <div
        key={value}
        onClick={() => setSelectedRole(value)}
        style={{
          border: `2px solid ${selectedRole === value ? '#2a9d8f' : 'var(--color-border)'}`,
          background: selectedRole === value ? 'var(--color-background)' : 'white',
          borderRadius: '0.75rem', padding: '1.25rem', cursor: 'pointer',
          marginBottom: '0.75rem', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{emoji}</div>
        <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '0.25rem' }}>{title}</div>
        <div style={{ fontSize: '0.85rem', color: '#888', lineHeight: '1.4' }}>{desc}</div>
      </div>
    )

    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          {logo}
          {progressBar}
          {stepHeader}
          <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
            Choisis comment tu vas utiliser ODIGO
          </p>
          {roleCard('student', '🎓', 'Je suis élève', "J'utilise ODIGO pour organiser mon travail et réviser mes leçons.")}
          {roleCard('parent', '👨‍👧', 'Je suis parent', "Je supervise le compte de mon enfant et crée ses listes de mots.")}
          {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button onClick={() => goTo('signup-2')} style={btnSecondary}>← Retour</button>
            <button onClick={handleCreateAccount} disabled={loading} style={btnPrimary}>
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==================== CONFIRMATION ====================

  return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, textAlign: 'center', maxWidth: '420px' }}>
        {logo}
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✉️</div>
        <h2 style={{ color: '#333', margin: '0 0 0.75rem' }}>Vérifie ta messagerie !</h2>
        <p style={{ color: '#555', lineHeight: '1.6', margin: '0 0 1.5rem' }}>
          Un email de confirmation a été envoyé à{' '}
          <strong style={{ color: '#2a9d8f' }}>{email}</strong>.
          {' '}Clique sur le lien dans l'email pour activer ton compte et accéder à ODIGO.
        </p>
        <button onClick={() => goTo('login')} style={{ ...btnPrimary, width: '100%' }}>
          ← Retour à la connexion
        </button>
        <p style={{ color: '#bbb', fontSize: '0.82rem', marginTop: '1rem' }}>
          Tu ne vois pas l'email ? Vérifie tes spams.
        </p>
      </div>
    </div>
  )
}
