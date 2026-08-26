import { supabase } from '../lib/supabase'

export const updateLastSeen = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id)
}

export const logActivity = async (params: {
  action_type: 'exercise_completed' | 'planner_entry' | 'revision_checked' | 'grade_updated'
  questions_total?: number
  questions_correct?: number
  metadata?: Record<string, unknown>
}) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('daily_activity').insert({
    user_id: user.id,
    action_type: params.action_type,
    questions_total: params.questions_total || 0,
    questions_correct: params.questions_correct || 0,
    metadata: params.metadata || {},
    date: new Date().toISOString().split('T')[0],
  })
}
