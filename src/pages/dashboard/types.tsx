import type { ReactNode } from 'react'
import { Home as HomeIcon, Calendar, BookOpen, List as ListIcon, Target, Trophy, Settings as SettingsIcon, Info as InfoIcon, CheckSquare } from 'lucide-react'

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
  { id: 'missions', label: 'Missions', icon: <CheckSquare size={18} /> },
  { id: 'rewards', label: 'Récompenses', icon: <Trophy size={18} /> },
  { id: 'settings', label: 'Paramètres', icon: <SettingsIcon size={18} /> },
  { id: 'apropos', label: 'À propos', icon: <InfoIcon size={18} /> },
]

export interface ExerciseCard {
  id: string
  label: string
  icon: string
  description: string
  color: string
  category: 'langues' | 'francais' | 'maths' | 'histoire' | 'defi'
  isAI?: boolean
}

export const exerciseCards: ExerciseCard[] = [
  {
    id: 'worddrop',
    label: 'Word Drop',
    icon: '🎮',
    description: 'Aligne le mot sur la bonne traduction avant qu\'il touche le sol !',
    color: PRIMARY,
    category: 'langues',
  },
  {
    id: 'qcm',
    label: 'QCM',
    icon: '🧠',
    description: 'Choisis la bonne réponse parmi 2, 4 ou 8 propositions.',
    color: '#e9c46a',
    category: 'langues',
    isAI: true,
  },
  {
    id: 'spelling',
    label: 'Épellation',
    icon: '✍️',
    description: 'Écoute ou lis le mot et écris sa traduction correctement.',
    color: '#e76f51',
    category: 'langues',
  },
  {
    id: 'flashcards',
    label: 'Flashcards',
    icon: '🃏',
    description: 'Retourne les cartes et swipe selon si tu fais juste ou pas.',
    color: PRIMARY,
    category: 'langues',
  },
  {
    id: 'puzzlephrases',
    label: 'Puzzle de phrases',
    icon: '🧩',
    description: 'Reconstruis la traduction dans le bon ordre !',
    color: '#5c6bc0',
    category: 'langues',
    isAI: true,
  },
  {
    id: 'vocabulaire',
    label: 'Vocabulaire',
    icon: '📝',
    description: 'Complète les phrases à trou avec le bon mot.',
    color: '#4CAF50',
    category: 'francais',
    isAI: true,
  },
  {
    id: 'conjugaison',
    label: 'Conjugaison',
    icon: '✍️',
    description: 'Conjugue les verbes au bon temps et à la bonne personne.',
    color: '#e76f51',
    category: 'francais',
    isAI: true,
  },
  {
    id: 'anagramme',
    label: 'Anagramme',
    icon: '🔤',
    description: 'Remets les lettres dans le bon ordre !',
    color: '#e9c46a',
    category: 'langues',
    isAI: false,
  },
  {
    id: 'conjugaison-etrangere',
    label: 'Conjugaison',
    icon: '✍️',
    description: 'Conjugue des verbes en langue étrangère',
    color: '#5c6bc0',
    category: 'langues',
    isAI: true,
  },
  {
    id: 'anagramme-francais',
    label: 'Anagramme',
    icon: '🔤',
    description: 'Remets les lettres dans le bon ordre !',
    color: '#e9c46a',
    category: 'francais',
    isAI: false,
  },
  {
    id: 'maths-calcul',
    label: 'Calcul mental',
    icon: '🧮',
    description: 'Additions et soustractions',
    color: '#2a9d8f',
    category: 'maths',
    isAI: false,
  },
  {
    id: 'maths-multiplication',
    label: 'Multiplications',
    icon: '✖️',
    description: 'Les tables de multiplication',
    color: '#e76f51',
    category: 'maths',
    isAI: false,
  },
  {
    id: 'maths-division',
    label: 'Divisions',
    icon: '➗',
    description: 'Divisions simples et avec reste',
    color: '#5c6bc0',
    category: 'maths',
    isAI: false,
  },
  {
    id: 'maths-equation',
    label: 'Équations',
    icon: '🔢',
    description: 'Trouve la valeur de x',
    color: '#e9c46a',
    category: 'maths',
    isAI: false,
  },
  {
    id: 'defi-parents',
    label: 'Défi parents',
    icon: '🏆',
    description: 'Culture générale — réponds vite !',
    color: '#e9c46a',
    category: 'defi',
    isAI: false,
  },
  {
    id: 'carte-suisse',
    label: 'Trouve le canton',
    icon: '🗺️',
    description: 'Trouve les cantons suisses sur la carte !',
    color: '#2a9d8f',
    category: 'histoire',
    isAI: false,
  },
  {
    id: 'histoire-geo',
    label: 'Histoire & Géo',
    icon: '📚',
    description: 'Teste tes connaissances en histoire et géographie !',
    color: '#5c6bc0',
    category: 'histoire',
    isAI: false,
  },
]
