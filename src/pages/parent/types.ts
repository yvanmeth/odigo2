export interface Child {
  id: string
  first_name: string
  email: string
  relationship: string
}

export interface InviteCode {
  code: string
  expires_at: string
  used: boolean
  relationship?: string
}

export interface IrlReward {
  id: string
  parent_id: string
  name: string
  cost: number
  description?: string | null
  stock: number
  valid_until?: string | null
  created_at: string
}

export interface PendingPurchase {
  id: string
  child_id: string
  reward_id: string
  reward_name: string
  cost: number
  status: 'valid' | 'used'
  purchased_at: string
  used_at?: string | null
  profiles?: { first_name: string | null } | null
}
