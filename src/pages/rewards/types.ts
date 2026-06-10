export type RewardTab = 'rewards' | 'wallet' | 'progression' | 'howto'

export interface ActiveWeek {
  week: string
  digoos: number
}

export interface Progress {
  user_id: string
  digoos: number
  digoos_this_week: number
  active_weeks: ActiveWeek[]
  week_streak: number
  claimed_badges: string[]
  claimed_days: string[]
  claimed_weeks: string[]
  claimed_months: string[]
  last_week_reset: string
  updated_at: string
}

export interface IrlReward {
  id: string
  parent_id: string
  name: string
  cost: number
  description?: string | null
  stock: number
  valid_until?: string | null
}

export interface IrlPurchase {
  id: string
  child_id: string
  reward_id: string
  reward_name: string
  cost: number
  status: 'valid' | 'used'
  purchased_at: string
  used_at?: string | null
}

export interface ShopItem {
  id: string
  type: 'theme' | 'title'
  name: string
  name_masculine?: string | null
  name_feminine?: string | null
  description?: string | null
  price: number
  color?: string | null
  duration_days?: number | null
}

export interface UserPurchase {
  id: string
  user_id: string
  item_id: string
  purchased_at: string
  expires_at?: string | null
  active: boolean
}

export interface Badge {
  id: string
  label: string
  description: string
  icon: string
  condition: (p: Progress) => boolean
  progressLabel: (p: Progress) => string
}
