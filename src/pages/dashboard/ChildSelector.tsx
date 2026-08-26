import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Child } from './types'

interface ChildSelectorProps {
  children: Child[]
  viewingChildId: string | null
  onSelectChild: (id: string | null) => void
}

export default function ChildSelector({ children, viewingChildId, onSelectChild: _onSelectChild }: ChildSelectorProps) {
  const [showProtectionModal, setShowProtectionModal] = useState(false)
  const [protectionInput, setProtectionInput] = useState('')
  const [protectionError, setProtectionError] = useState('')

  const switchToChildSession = async (childId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      localStorage.setItem('odigo_parent_access_token', session.access_token)
      localStorage.setItem('odigo_parent_refresh_token', session.refresh_token)

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-child-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ childId }),
        }
      )

      const result = await response.json()
      console.log('get-child-session result:', result)
      console.log('access_token exists:', !!result.access_token)
      console.log('error:', result.error)

      if (!result.access_token) {
        console.error('Erreur get-child-session:', result.error)
        return
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      })

      console.log('setSession error:', sessionError)

      if (sessionError) {
        console.error('Erreur setSession:', sessionError)
        return
      }

      window.location.reload()
    } catch (err) {
      console.error('Erreur switchToChildSession:', err)
    }
  }

  const restoreParentSession = async () => {
    const parentAccessToken = localStorage.getItem('odigo_parent_access_token')
    const parentRefreshToken = localStorage.getItem('odigo_parent_refresh_token')

    if (!parentAccessToken || !parentRefreshToken) {
      await supabase.auth.signOut()
      window.location.reload()
      return
    }

    const { error } = await supabase.auth.setSession({
      access_token: parentAccessToken,
      refresh_token: parentRefreshToken,
    })

    if (error) {
      console.error('Erreur restore session:', error)
      await supabase.auth.signOut()
    }

    localStorage.removeItem('odigo_parent_access_token')
    localStorage.removeItem('odigo_parent_refresh_token')

    window.location.reload()
  }

  const handleChildSelect = async (value: string) => {
    if (value === '' && viewingChildId !== null) {
      const protection = localStorage.getItem('odigo_parent_protection') || 'none'
      if (protection !== 'none') {
        setShowProtectionModal(true)
        setProtectionInput('')
        setProtectionError('')
        return
      }
      await restoreParentSession()
      return
    }
    if (value !== '') {
      await switchToChildSession(value)
    }
  }

  const handleProtectionSubmit = async () => {
    const protection = localStorage.getItem('odigo_parent_protection')

    if (protection === 'pin') {
      const savedPin = localStorage.getItem('odigo_parent_pin')
      if (protectionInput === savedPin) {
        setShowProtectionModal(false)
        await restoreParentSession()
      } else {
        setProtectionError('Code PIN incorrect')
      }
    } else if (protection === 'password') {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: protectionInput,
      })
      if (!error) {
        setShowProtectionModal(false)
        await restoreParentSession()
      } else {
        setProtectionError('Mot de passe incorrect')
      }
    }
  }

  const isPin = localStorage.getItem('odigo_parent_protection') === 'pin'

  return (
    <>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', background: '#f9f9f9' }}>
        <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.4rem' }}>Profil actif</div>
        <select
          value={viewingChildId || ''}
          onChange={e => handleChildSelect(e.target.value)}
          style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #ddd', fontSize: '0.85rem', color: '#333' }}
        >
          <option value="">👤 Mon espace</option>
          {children.map(c => (
            <option key={c.id} value={c.id}>👧 {c.first_name}</option>
          ))}
        </select>
      </div>

      {showProtectionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '320px', width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔒</div>
            <h3 style={{ color: '#2a9d8f', marginBottom: '0.5rem' }}>Retour au compte parent</h3>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
              {isPin ? 'Saisis ton code PIN à 4 chiffres' : 'Saisis ton mot de passe'}
            </p>

            <input
              type="password"
              value={protectionInput}
              onChange={e => setProtectionInput(e.target.value)}
              maxLength={isPin ? 4 : 100}
              placeholder={isPin ? '••••' : 'Mot de passe'}
              autoFocus
              style={{
                width: '100%', padding: '0.75rem',
                borderRadius: '0.5rem', border: '1px solid #e0f0ee',
                fontSize: '1rem', textAlign: 'center', boxSizing: 'border-box',
              }}
              onKeyDown={e => e.key === 'Enter' && handleProtectionSubmit()}
            />

            {protectionError && (
              <div style={{ color: '#e63946', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                {protectionError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                onClick={() => setShowProtectionModal(false)}
                style={{ flex: 1, padding: '0.6rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={handleProtectionSubmit}
                style={{ flex: 1, padding: '0.6rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
