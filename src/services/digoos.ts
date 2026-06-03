import { supabase } from '../lib/supabase'

export const addDigoos = async (amount: number) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('progress')
    .select('digoos, digoos_this_week')
    .eq('user_id', user.id)
    .single()

  if (data) {
    await supabase.from('progress').update({
      digoos: (data.digoos || 0) + amount,
      digoos_this_week: (data.digoos_this_week || 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
  } else {
    await supabase.from('progress').insert({
      user_id: user.id,
      digoos: amount,
      digoos_this_week: amount,
      active_weeks: [],
      week_streak: 0,
      badges: [],
      last_week_reset: '',
    })
  }
}