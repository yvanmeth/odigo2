import { supabase } from '../lib/supabase'

export const submitSuggestion = async (text: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('suggestions')
    .insert({
      user_id: user.id,
      text: text.trim(),
      created_at: new Date().toISOString()
    })

  return !error
}
