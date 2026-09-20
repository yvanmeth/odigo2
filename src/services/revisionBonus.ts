import { supabase } from '../lib/supabase'
import { toDateStr } from '../lib/dates'

export const hasRevisionBonusForList = async (listId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const today = toDateStr(new Date())
    const { data } = await supabase
      .from('evaluations')
      .select('id')
      .eq('user_id', user.id)
      .eq('list_id', listId)
      .gte('evaluation_date', today)
      .limit(1)
    return (data?.length ?? 0) > 0
  } catch {
    return false
  }
}
