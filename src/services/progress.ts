import { supabase } from '../lib/supabase'

export const updateStreakRecords = async (
  dayStreak: number,
  weekStreak: number,
  monthStreak: number,
  currentRecords: { record_days?: number; record_weeks?: number; record_months?: number }
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const updates: Record<string, number> = {}
  if (dayStreak > (currentRecords.record_days || 0)) updates.record_days = dayStreak
  if (weekStreak > (currentRecords.record_weeks || 0)) updates.record_weeks = weekStreak
  if (monthStreak > (currentRecords.record_months || 0)) updates.record_months = monthStreak
  if (Object.keys(updates).length > 0) {
    await supabase.from('progress').update(updates).eq('user_id', user.id)
  }
}
