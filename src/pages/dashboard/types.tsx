import type { ReactNode } from 'react'
import { Home as HomeIcon, Calendar, BookOpen, List as ListIcon, Target, Trophy, Settings as SettingsIcon } from 'lucide-react'

const PRIMARY = 'var(--color-primary)'

export interface Child {
  id: string
  first_name: string
}

export interface NavItem { id: string; label: string; icon: ReactNode }

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <HomeIcon size={18} /> },
  { id: 'planner', label: 'Planificateur', icon: <Calendar size={18} /> },
  { id: 'subjects', label: 'Matières', icon: <BookOpen size={18} /> },
  { id: 'wordlists', label: 'Listes de mots', icon: <ListIcon size={18} /> },
  { id: 'exercises', label: 'Exercices', icon: <Target size={18} /> },
  { id: 'rewards', label: 'Récompenses', icon: <Trophy size={18} /> },
  { id: 'settings', label: 'Paramètres', icon: <SettingsIcon size={18} /> },
]

export const exerciseCards = [
  {
    id: 'worddrop',
    label: 'Word Drop',
    icon: '🎮',
    description: 'Aligne le mot sur la bonne traduction avant qu\'il touche le sol !',
    color: PRIMARY,
  },
  {
    id: 'qcm',
    label: 'QCM',
    icon: '🧠',
    description: 'Choisis la bonne réponse parmi 2, 4 ou 8 propositions.',
    color: '#e9c46a',
  },
  {
    id: 'spelling',
    label: 'Épellation',
    icon: '✍️',
    description: 'Écoute ou lis le mot et écris sa traduction correctement.',
    color: '#e76f51',
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    icon: '🃏',
    description: 'Retourne les cartes et swipe selon si tu fais juste ou pas.',
    color: PRIMARY,
  },
  {
    id: 'conjugaison',
    label: 'Conjugaison',
    icon: '✍️',
    description: 'Conjugue les verbes au bon temps et à la bonne personne.',
    color: '#e76f51',
  },
  {
    id: 'vocabulaire',
    label: 'Vocabulaire',
    icon: '📝',
    description: 'Complète les phrases à trou avec le bon mot.',
    color: '#4CAF50',
  },
]
