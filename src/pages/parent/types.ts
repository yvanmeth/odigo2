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
