import { supabase } from '../../lib/supabase'
import type { Child } from './types'

interface ChildSelectorProps {
  children: Child[]
}

export default function ChildSelector({ children }: ChildSelectorProps) {
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

      if (!result.access_token) {
        console.error('Erreur get-child-session:', result.error)
        return
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      })

      if (sessionError) {
        console.error('Erreur setSession:', sessionError)
        return
      }

      window.location.reload()
    } catch (err) {
      console.error('Erreur switchToChildSession:', err)
    }
  }

  const handleChildSelect = async (value: string) => {
    if (value !== '') {
      await switchToChildSession(value)
    }
  }

  return (
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', background: '#f9f9f9' }}>
      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.4rem' }}>Profil actif</div>
      <select
        value=""
        onChange={e => handleChildSelect(e.target.value)}
        style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #ddd', fontSize: '0.85rem', color: '#333' }}
      >
        <option value="">👤 Mon espace</option>
        {children.map(c => (
          <option key={c.id} value={c.id}>👧 {c.first_name}</option>
        ))}
      </select>
    </div>
  )
}
