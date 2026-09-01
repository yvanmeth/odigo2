import { supabase } from './supabase'

export async function switchToChildSession(childId: string): Promise<void> {
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
