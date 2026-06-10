import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { deductDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'

const HEROS = [
  'la magicienne', "l'aventurière", 'le hérisson',
  'le cuisinier', 'la géante', 'le pirate', 'la tortue',
  'le dragon', 'la sorcière', "l'inventeur", 'la danseuse',
  'le loup', 'la princesse', 'le robot', "l'astronaute",
  'le renard', 'la fée', 'le chevalier'
]

const VERBES = [
  'avait peur', 'aimait', 'cuisinait', 'chantait',
  'fabriquait', 'osait', 'apprenait', 'cherchait',
  'rêvait', 'gardait', 'oubliait', 'découvrait',
  'protégeait', 'collectionnait', 'inventait'
]

const CONTEXTES = [
  'des araignées', 'sous la pluie', 'des cailloux',
  'tous les jours', 'dans le désert', 'sur la lune',
  'des secrets', 'au fond de l\'eau', 'dans une forêt enchantée',
  'sans le dire à personne', 'depuis toujours',
  'dans les nuages', "d'une vieille carte",
  'avec ses amis', 'en silence'
]

const pickRandom = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

interface GeneratedTitle {
  heros: string
  verbe: string
  contexte: string
}

const generateTitle = (): GeneratedTitle => ({
  heros: pickRandom(HEROS),
  verbe: pickRandom(VERBES),
  contexte: pickRandom(CONTEXTES),
})

const formatTitle = (t: GeneratedTitle): string => {
  const raw = `${t.heros} qui ${t.verbe} ${t.contexte}`
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

interface StoryNode {
  text: string
  choices: string[]
  choiceIndex?: number
}

type GameState = 'select' | 'playing' | 'ending' | 'end'

const MAX_NODES = 6

const buildSystemPrompt = (
  title: string,
  firstName: string,
  interests: string[],
  gender: 'M' | 'F' | 'X' | null
) => `
Tu es un narrateur d'histoires interactives pour enfants.
Tu racontes l'histoire : "${title}".

Ton style :
- Adapté à un enfant de 10 ans, phrases claires et vivantes
- Ton aventurier, humoristique et bienveillant
- Valeurs positives : amitié, entraide, respect, tolérance,
  ambition, persévérance, courage, estime de soi
- JAMAIS de violence, de peur intense, ni de sexualisation
- Utilise des emojis pour illustrer les moments clés
  (2-4 par nœud, intégrés naturellement dans le texte)

Le lecteur s'appelle ${firstName || 'l\'aventurier'}.
${gender === 'F'
  ? "Le lecteur est une fille : si tu le décris, utilise les accords féminins (ex: \"tu es ravie\")."
  : gender === 'M'
  ? "Le lecteur est un garçon : si tu le décris, utilise les accords masculins (ex: \"tu es ravi\")."
  : ''}

Centres d'intérêt du lecteur à intégrer quand c'est naturel :
${interests.length > 0 ? interests.join(', ') : 'aventure, nature, amitié'}

L'histoire dure exactement ${MAX_NODES} nœuds de choix,
puis un épilogue final.

Format de réponse — UNIQUEMENT ce JSON valide :
{
  "text": "texte narratif du nœud (3-5 phrases avec emojis)",
  "choices": ["choix 1", "choix 2", "choix 3"]
}

Pour l'épilogue final (nœud ${MAX_NODES + 1}),
"choices" doit être un tableau vide [].
`

const buildUserPrompt = (nodes: StoryNode[], nodeIndex: number) => {
  if (nodeIndex === 0) {
    return `Commence l'histoire. Plante le décor en 3-5 phrases
et propose 3 choix pour la suite.`
  }

  const history = nodes
    .filter(n => n.choiceIndex !== undefined)
    .map((n, i) => `Nœud ${i + 1}: ${n.text}\nChoix fait: ${n.choices[n.choiceIndex!]}`)
    .join('\n\n')

  const isLast = nodeIndex === MAX_NODES

  return `Historique des choix :
${history}

${isLast
    ? 'Écris maintenant l\'épilogue final (4-6 phrases). Termine l\'histoire de façon satisfaisante selon les choix faits. "choices" doit être [].'
    : `Continue l'histoire (nœud ${nodeIndex + 1}/${MAX_NODES}). 3-5 phrases puis 3 nouveaux choix.`
  }`
}

const choiceBaseStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'white', border: '2px solid #e0f0ee',
  borderRadius: '0.75rem', padding: '0.85rem',
  fontSize: '0.95rem', color: '#333',
  cursor: 'pointer', marginBottom: '0.75rem',
}

const choiceSelectedStyle: React.CSSProperties = {
  background: '#2a9d8f', color: 'white', borderColor: '#2a9d8f',
}

function useDots(): string {
  const [dots, setDots] = useState('.')
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '.' : prev + '.'))
    }, 400)
    return () => clearInterval(interval)
  }, [])
  return dots
}

export default function Histoire() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [title, setTitle] = useState<GeneratedTitle>(() => generateTitle())
  const [digoos, setDigoos] = useState(0)
  const [firstName, setFirstName] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [gender, setGender] = useState<'M' | 'F' | 'X' | null>(null)
  const [nodes, setNodes] = useState<StoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [spent, setSpent] = useState(0)
  const [retryParams, setRetryParams] = useState<{ nodesForFetch: StoryNode[]; nodeIndex: number; isLast: boolean } | null>(null)
  const dots = useDots()

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, interests, gender')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFirstName(profile.first_name || '')
        setInterests(profile.interests || [])
        setGender(profile.gender || null)
      }

      const { data: progress } = await supabase
        .from('progress')
        .select('digoos')
        .eq('user_id', user.id)
        .single()

      if (progress) setDigoos(progress.digoos || 0)
    }
    init()
  }, [])

  const fetchNode = async (nodesForFetch: StoryNode[], nodeIndex: number): Promise<StoryNode> => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        system: buildSystemPrompt(formatTitle(title), firstName, interests, gender),
        messages: [{ role: 'user', content: buildUserPrompt(nodesForFetch, nodeIndex) }],
      }),
    })
    const data = await response.json()
    const txt = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim()
    return JSON.parse(txt)
  }

  const loadNode = async (nodesForFetch: StoryNode[], nodeIndex: number, isLast: boolean) => {
    setLoading(true)
    setError('')
    if (isLast) setGameState('ending')
    try {
      const node = await fetchNode(nodesForFetch, nodeIndex)
      setNodes([...nodesForFetch, node])
      setRetryParams(null)
      if (isLast) {
        setGameState('end')
        await logActivity({ action_type: 'exercise_completed', metadata: { exercise: 'histoire' } })
      }
    } catch {
      setError("Erreur lors de la génération de l'histoire. Réessaie.")
      setRetryParams({ nodesForFetch, nodeIndex, isLast })
      if (isLast) setGameState('playing')
    } finally {
      setLoading(false)
    }
  }

  const handleNewTitle = async () => {
    if (digoos < 1) return
    await deductDigoos(1)
    setDigoos(prev => Math.max(0, prev - 1))
    setTitle(generateTitle())
  }

  const handleStart = () => {
    setGameState('playing')
    setNodes([])
    setSpent(0)
    loadNode([], 0, false)
  }

  const handleChoice = async (choiceIndex: number) => {
    if (loading) return
    await deductDigoos(1)
    setDigoos(prev => Math.max(0, prev - 1))
    setSpent(prev => prev + 1)

    const updated = nodes.map((n, i) =>
      i === nodes.length - 1 ? { ...n, choiceIndex } : n
    )
    setNodes(updated)

    const nodeIndex = updated.length
    loadNode(updated, nodeIndex, nodeIndex === MAX_NODES)
  }

  const handleNewStory = () => {
    setTitle(generateTitle())
    setNodes([])
    setSpent(0)
    setError('')
    setGameState('select')
  }

  const handleQuit = () => {
    setNodes([])
    setSpent(0)
    setError('')
    setGameState('select')
  }

  const retry = () => {
    if (retryParams) loadNode(retryParams.nodesForFetch, retryParams.nodeIndex, retryParams.isLast)
  }

  // ---- ÉCRAN SÉLECTION ----
  if (gameState === 'select') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>📖 Histoire interactive</h2>

        <div style={{ background: '#f0faf8', borderRadius: '1rem', padding: '1.5rem' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
            {formatTitle(title)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', textAlign: 'center', marginTop: '0.5rem' }}>
            Une histoire unique et éphémère — si tu quittes, elle disparaît !
          </div>
        </div>

        {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            onClick={handleNewTitle}
            disabled={digoos < 1}
            style={{ flex: 1, padding: '0.75rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            🎲 Nouveau titre — 1 Δ
          </button>
          <button
            onClick={handleStart}
            style={{ flex: 1, padding: '0.75rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            📖 Commencer — 1 Δ par choix
          </button>
        </div>

        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#e9c46a', fontWeight: 'bold' }}>
          Ton solde : {digoos} Δ
        </div>

        <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
          Le premier titre est gratuit. Changer de titre coûte 1 Δ à chaque fois.
        </p>
      </div>
    )
  }

  // ---- ÉCRAN FIN ----
  if (gameState === 'end') {
    const epilogue = nodes[nodes.length - 1]
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '1.8rem', textAlign: 'center', marginBottom: '0.25rem' }}>✨ Fin de l'histoire</h2>
        <div style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem', textAlign: 'center', marginBottom: '1rem' }}>
          {formatTitle(title)}
        </div>

        <div className="page-enter" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem', fontSize: '1rem', lineHeight: '1.8', color: '#333' }}>
          {epilogue?.text}
        </div>

        <div style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Tu as fait {MAX_NODES} choix · {spent} Δ dépensés
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={handleNewStory}
            style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
          >
            🎲 Nouvelle histoire
          </button>
          <button
            onClick={handleQuit}
            style={{ padding: '0.75rem 2rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            Quitter
          </button>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN ÉPILOGUE EN COURS ----
  if (gameState === 'ending' && nodes.length === MAX_NODES) {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {formatTitle(title)}
        </div>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', color: '#888', fontStyle: 'italic' }}>
          La fin approche{dots}
        </div>
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#e63946', fontSize: '0.85rem' }}>{error}</p>
            <button
              onClick={retry}
              style={{ padding: '0.6rem 1.5rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    )
  }

  // ---- ÉCRAN JEU ----
  const currentNode = nodes[nodes.length - 1]
  const chapterNum = nodes.length

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' }}>
        {formatTitle(title)}
      </div>

      <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '0.5rem' }}>
        Chapitre {Math.min(chapterNum, MAX_NODES)} / {MAX_NODES}
      </div>

      <div style={{ background: '#e0f0ee', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div className="progress-bar" style={{ width: `${(Math.min(chapterNum, MAX_NODES) / MAX_NODES) * 100}%`, background: '#2a9d8f', height: '100%', borderRadius: '1rem' }} />
      </div>

      {currentNode && (
        <div key={chapterNum} className="page-enter" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem', fontSize: '1rem', lineHeight: '1.8', color: '#333' }}>
          {currentNode.text}
        </div>
      )}

      {currentNode && currentNode.choices.length > 0 && currentNode.choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => handleChoice(i)}
          disabled={loading || currentNode.choiceIndex !== undefined}
          className="story-choice"
          style={{
            ...choiceBaseStyle,
            ...(currentNode.choiceIndex === i ? choiceSelectedStyle : {}),
          }}
        >
          {choice}
        </button>
      ))}

      {loading && (
        <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', marginTop: '0.5rem' }}>
          Odigo écrit la suite{dots}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <p style={{ color: '#e63946', fontSize: '0.85rem' }}>{error}</p>
          <button
            onClick={retry}
            style={{ padding: '0.6rem 1.5rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}
