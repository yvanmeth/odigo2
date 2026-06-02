export interface Profile {
  id: string
  email: string
  full_name?: string
  created_at: string
}

export interface Subject {
  id: number
  name: string
}

export interface Evaluation {
  id: string
  user_id: string
  subject_id: number
  topic: string
  evaluation_date: string
  start_time?: string
  end_time?: string
  readiness?: number | null
  grade?: number | null
  created_at: string
}

export interface Revision {
  id: string
  user_id: string
  evaluation_id?: string | null
  revision_date: string
  start_time?: string
  end_time?: string
  completed: boolean
  details?: string | null
  created_at: string
}

export interface Event {
  id: string
  user_id: string
  title: string
  event_date: string
  start_time?: string
  end_time?: string
  details?: string | null
  created_at: string
}

export interface WordList {
  id: string
  user_id: string
  subject_id: number
  name: string
  list_type: string
  created_at: string
}

export interface WordItem {
  id: string
  list_id: string
  source_word: string
  target_word?: string | null
  context?: string | null
  created_at: string
}

export interface Progress {
  id: string
  user_id: string
  xp: number
  streak: number
  last_activity: string
  created_at: string
}