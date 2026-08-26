import { supabase } from './supabase'

export const getParentProtection = () =>
  localStorage.getItem('odigo_parent_protection') || 'none'

export const verifyParentPin = (input: string): boolean => {
  const savedPin = localStorage.getItem('odigo_parent_pin')
  return input === savedPin
}

export const restoreParentSession = async () => {
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
