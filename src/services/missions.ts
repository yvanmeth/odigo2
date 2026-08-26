import { supabase } from '../lib/supabase'

export interface Mission {
  id: string
  name: string
  description?: string
  deadline: string
  reward_type?: 'digoos' | 'irl_reward'
  reward_amount?: number | null
  reward_irl_id?: string
  status: 'pending' | 'claimed' | 'completed'
  claimed_at?: string
  completed_at?: string
}

export const fetchMissions = async (
  statusFilter?: ('pending' | 'claimed' | 'completed')[]
): Promise<Mission[]> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  let query = supabase.from('missions').select('*').eq('child_id', user.id).order('deadline')
  if (statusFilter && statusFilter.length > 0) {
    query = query.in('status', statusFilter)
  }
  const { data } = await query
  return (data as Mission[]) || []
}

export const claimMission = async (missionId: string): Promise<void> => {
  await supabase.from('missions')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('id', missionId)
}
