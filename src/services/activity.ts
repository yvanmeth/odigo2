import { supabase } from '../lib/supabase'

export const logActivity = async (params: {
  action_type: 'exercise_completed' | 'planner_entry' | 'revision_checked' | 'grade_updated'
  questions_total?: number
  questions_correct?: number
  metadata?: Record<string, unknown>
}, targetUserId?: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const userId = targetUserId || user.id

  if (userId !== user.id) {
    await supabase.rpc('log_activity_for_user', {
      target_user_id: userId,
      p_action_type: params.action_type,
      p_date: new Date().toISOString().split('T')[0],
      p_questions_total: params.questions_total ?? null,
      p_questions_correct: params.questions_correct ?? null,
      p_metadata: params.metadata ?? null,
    })
    return
  }

  await supabase.from('daily_activity').insert({
    user_id: userId,
    action_type: params.action_type,
    questions_total: params.questions_total || 0,
    questions_correct: params.questions_correct || 0,
    metadata: params.metadata || {},
    date: new Date().toISOString().split('T')[0],
  })
}
