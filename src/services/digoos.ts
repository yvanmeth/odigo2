import { supabase } from '../lib/supabase'

const getMultiplier = (exercisesToday: number): number => {
  if (exercisesToday <= 10) return 1.0
  if (exercisesToday <= 20) return 0.8
  return 0.6
}

export const addDigoos = async (
  amount: number,
  source: 'exercise' | 'planner' | 'badge' | 'reward',
  label: string,
): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  let finalAmount = amount

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
    .maybeSingle()

  let balanceAfter: number
  if (data) {
    balanceAfter = (data.digoos || 0) + finalAmount
    await supabase.from('progress').update({
      digoos: balanceAfter,
      digoos_this_week: (data.digoos_this_week || 0) + finalAmount,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)
  } else {
    balanceAfter = finalAmount
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

  await supabase.from('digoos_transactions').insert({
    user_id: user.id,
    amount: finalAmount,
    balance_after: balanceAfter,
    source,
    label,
  })

  const w = window as Window & { triggerDigoosAnimation?: (n: number) => void }
  if (typeof window !== 'undefined' && w.triggerDigoosAnimation) {
    w.triggerDigoosAnimation(finalAmount)
  }

  return finalAmount
}

export const deductDigoos = async (amount: number, source: 'exercise' | 'planner' | 'badge' | 'reward', label: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('progress')
    .select('digoos, digoos_this_week')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return

  const balanceAfter = Math.max(0, (data.digoos || 0) - amount)
  await supabase.from('progress').update({
    digoos: balanceAfter,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)

  await supabase.from('digoos_transactions').insert({
    user_id: user.id,
    amount: -amount,
    balance_after: balanceAfter,
    source,
    label,
  })
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

  const { count } = await supabase
    .from('daily_activity')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('action_type', 'planner_' + actionType)
    .eq('date', today)

  if ((count || 0) > 0) return 0

  await supabase.from('daily_activity').insert({
    user_id: user.id,
    action_type: 'planner_' + actionType,
    date: today,
    metadata: { actionType },
  })

  const LABELS: Record<string, string> = {
    eval_added: 'Planificateur — évaluation ajoutée',
    grade_received: 'Planificateur — note saisie',
    revision_checked: 'Planificateur — révision cochée',
    event_added: 'Planificateur — événement ajouté',
    reminder_added: 'Planificateur — rappel ajouté',
  }

  return await addDigoos(amount, 'planner', LABELS[actionType])
}
