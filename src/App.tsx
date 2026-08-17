import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import LoginPage from './pages/loginpage'
import Dashboard from './pages/dashboard/index'
import ResetPassword from './pages/ResetPassword'
import { ToastProvider } from './components/Toast'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{ padding: '2rem' }}>Chargement...</div>

  const path = window.location.pathname
  console.log('Path detected:', path)
  const inviteMatch = path.match(/^\/invite\/([A-Z0-9]+)$/i)
  console.log('Invite match:', inviteMatch)
  if (inviteMatch) {
    const code = inviteMatch[1].toUpperCase()
    localStorage.setItem('odigo_pending_invite', code)
    window.history.replaceState({}, '', '/')
  }

  if (path === '/reset-password') {
    return <ResetPassword />
  }

  return (
    <ToastProvider>
      {session ? <Dashboard session={session} /> : <LoginPage />}
    </ToastProvider>
  )
}

export default App