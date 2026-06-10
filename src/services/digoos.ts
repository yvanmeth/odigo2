import { supabase } from '../lib/supabase'

const getMultiplier = (exercisesToday: number): number => {
  if (exercisesToday <= 10) return 1.0
  if (exercisesToday <= 20) return 0.8
  return 0.6
}

export const addDigoos = async (
  amount: number,
  source: 'exercise' | 'planner' | 'badge' | 'reward' = 'exercise'
): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  let finalAmount = amount

  // Appliquer dégressivité uniquement pour les exercices
  if (source === 'exercise') {
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('daily_activity')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action_type', 'exercise_completed')
      .eq('date', today)

    const exercisesToday = count || 0
    const multiplier = getMultiplier(exercisesToday)
    finalAmount = Math.round(amount * multiplier)
  }

  if (finalAmount <= 0) return 0

  const { data } = await supabase
    .from('progress')
    .select('digoos, digoos_this_week')
    .eq('user_id', user.id)
    .single()

  if (data) {
    await supabase.from('progress').update({
      digoos: (data.digoos || 0) + finalAmount,
      digoos_this_week: (data.digoos_this_week || 0) + finalAmount,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
  } else {
    await supabase.from('progress').insert({
      user_id: user.id,
      digoos: finalAmount,
      digoos_this_week: finalAmount,
      active_weeks: [],
      week_streak: 0,
      badges: [],
      last_week_reset: '',
    })
  }

  if (typeof window !== 'undefined' && (window as any).triggerDigoosAnimation) {
    (window as any).triggerDigoosAnimation(finalAmount)
  }

  return finalAmount
}

export const deductDigoos = async (amount: number) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('progress')
    .select('digoos, digoos_this_week')
    .eq('user_id', user.id)
    .single()

  if (!data) return

  await supabase.from('progress').update({
    digoos: Math.max(0, (data.digoos || 0) - amount),
    digoos_this_week: Math.max(0, (data.digoos_this_week || 0) - amount),
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)
}

export const addPlannerDigoos = async (
  actionType: 'eval_added' | 'grade_received' | 'revision_checked' | 'event_added' | 'reminder_added'
): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const AMOUNTS: Record<string, number> = {
    eval_added: 2,
    grade_received: 2,
    revision_checked: 2,
    event_added: 1,
    reminder_added: 1,
  }

  const amount = AMOUNTS[actionType]
  const today = new Date().toISOString().split('T')[0]

  // Vérifier si cette action a déjà été récompensée aujourd'hui
  const { count } = await supabase
    .from('daily_activity')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('action_type', 'planner_' + actionType)
    .eq('date', today)

  if ((count || 0) > 0) return 0 // Déjà récompensé aujourd'hui

  // Logger l'action
  await supabase.from('daily_activity').insert({
    user_id: user.id,
    action_type: 'planner_' + actionType,
    date: today,
    metadata: { actionType },
  })

  // Ajouter les Digoos
  return await addDigoos(amount, 'planner')
}
