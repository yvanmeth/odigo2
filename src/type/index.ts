export interface Profile {
  id: string
  email: string
  full_name?: string
  created_at: string
}

export interface Subject {
  id: string
  user_id: string
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
  readiness?: number
  grade?: number
  created_at: string
}

export interface Revision {
  id: string
  user_id: string
  evaluation_id?: string
  revision_date: string
  start_time?: string
  end_time?: string
  completed: boolean
  details?: string
  created_at: string
}

export interface Event {
  id: string
  user_id: string
  title: string
  event_date: string
  start_time?: string
  end_time?: string
  details?: string
  created_at: string
}

export interface WordList {
  id: string
  user_id: string
  name: string
  subject_id: string
  created_at: string
}

export interface WordItem {
  id: string
  word_list_id: string
  source_word: string
  target_word: string
}

export interface Progress {
  id: string
  user_id: string
  xp: number
  streak: number
  last_activity: string
  created_at: string
}