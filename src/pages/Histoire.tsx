import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addDigoos, deductDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'
import { Delta } from '../components/Delta'

const HEROS = [
  'la magicienne', "l'aventurière", 'le hérisson',
  'le cuisinier', 'la géante', 'le pirate', 'la tortue',
  'le dragon', 'la sorcière', "l'inventeur", 'la danseuse',
  'le loup', 'la princesse', 'le robot', "l'astronaute",
  'le renard', 'la fée', 'le chevalier', 'le fantôme',
  'la détective'
]

const PAIRES_OBJET = [
  { verbe: 'cherchait', contexte: 'un trésor oublié' },
  { verbe: 'collectionnait', contexte: 'des secrets' },
  { verbe: 'gardait', contexte: 'une recette magique' },
  { verbe: 'cuisinait', contexte: 'des étoiles filantes' },
  { verbe: 'fabriquait', contexte: 'un ami invisible' },
  { verbe: 'inventait', contexte: 'des couleurs inconnues' },
  { verbe: 'protégeait', contexte: 'un dragon miniature' },
  { verbe: 'volait', contexte: 'des rêves' },
  { verbe: 'apprenait', contexte: 'la langue des arbres' },
  { verbe: 'dessinait', contexte: 'des portes vers ailleurs' },
  { verbe: 'cachait', contexte: 'un animal extraordinaire' },
  { verbe: 'soignait', contexte: 'des souvenirs perdus' },
  { verbe: 'comptait', contexte: 'les instants de bonheur' },
  { verbe: 'construisait', contexte: 'un monde à l\'envers' },
  { verbe: 'échangeait', contexte: 'des mots contre des étoiles' },
]

const PAIRES_LIEU = [
  { verbe: 'vivait', contexte: 'au fond de l\'eau' },
  { verbe: 'voyageait', contexte: 'dans les nuages' },
  { verbe: 'rêvait', contexte: 'sur la lune' },
  { verbe: 'chantait', contexte: 'sous la pluie' },
  { verbe: 'dansait', contexte: 'en silence' },
  { verbe: 'dormait', contexte: 'depuis toujours' },
  { verbe: 'flottait', contexte: 'entre deux mondes' },
  { verbe: 'disparaissait', contexte: 'sans laisser de traces' },
  { verbe: 'grandissait', contexte: 'à l\'envers' },
  { verbe: 'marchait', contexte: 'au bord du monde' },
  { verbe: 'brillait', contexte: 'la nuit seulement' },
  { verbe: 'attendait', contexte: 'depuis cent ans' },
  { verbe: 'jouait', contexte: 'là où personne n\'allait' },
  { verbe: 'riait', contexte: 'quand tout allait mal' },
  { verbe: 'existait', contexte: 'juste un peu autrement' },
]

const pickRandom = <T,>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]

interface StoryTitle {
  heros: string
  verbe: string
  contexte: string
  full: string
}

const generateTitle = (): StoryTitle => {
  const heros = pickRandom(HEROS)
  const useObjet = Math.random() < 0.5
  const paire = useObjet
    ? pickRandom(PAIRES_OBJET)
    : pickRandom(PAIRES_LIEU)
  return {
    heros,
    verbe: paire.verbe,
    contexte: paire.contexte,
    full: `${heros} qui ${paire.verbe} ${paire.contexte}`
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface StoryNode {
  text: string
  choices: string[]
  choiceIndex?: number
}

interface EndQuestion {
  question: string
  answer: string
  answerDisplay: string
  context: string
}

type GameState = 'select' | 'playing' | 'ending' | 'end' | 'question' | 'question_done'

const MAX_NODES = 6

const buildSystemPrompt = (
  title: string,
  interests: string[]
) => `
Tu es un narrateur d'histoires interactives pour enfants de 10 ans.
Tu racontes : "${title}".

Style :
- Phrases vivantes, claires, adaptées à 10 ans
- Ton aventurier, humoristique, bienveillant
- Valeurs : amitié, entraide, respect, tolérance,
  persévérance, courage, estime de soi
- JAMAIS de violence, peur intense, sexualisation
- 2-4 emojis par nœud, intégrés naturellement

Centres d'intérêt à intégrer quand naturel :
${interests.length > 0 ? interests.join(', ') : 'aventure, nature, amitié'}

L'histoire dure exactement ${MAX_NODES} nœuds puis un épilogue.

Réponds UNIQUEMENT en JSON valide :
{"text": "texte (3-5 phrases avec emojis)",
 "choices": ["choix 1", "choix 2", "choix 3"]}
Pour l'épilogue : "choices" = []
`

const buildUserPrompt = (
  nodes: StoryNode[],
  nodeIndex: number
): string => {
  if (nodeIndex === 0) {
    return `Commence l'histoire. Plante le décor en
    3-5 phrases et propose 3 choix pour la suite.`
  }
  const history = nodes
    .filter(n => n.choiceIndex !== undefined)
    .map((n, i) =>
      `Nœud ${i + 1}: ${n.text}\n` +
      `Choix: ${n.choices[n.choiceIndex!]}`
    ).join('\n\n')

  const isLast = nodeIndex === MAX_NODES
  return `Historique:\n${history}\n\n${
    isLast
      ? 'Écris l\'épilogue final (4-6 phrases). ' +
        'Termine de façon satisfaisante. "choices": []'
      : `Continue (nœud ${nodeIndex + 1}/${MAX_NODES}). ` +
        '3-5 phrases puis 3 choix.'
  }`
}

const buildQuestionPrompt = (nodes: StoryNode[]): string => {
  const fullStory = nodes
    .map((n, i) => `Nœud ${i + 1}: ${n.text}`)
    .join('\n\n')

  return `Voici l'histoire :\n${fullStory}\n\n
Génère une question de compréhension simple sur cette histoire.
La réponse doit être 1-3 mots maximum.
Réponds UNIQUEMENT en JSON :
{
  "question": "Question courte et claire ?",
  "answer": "réponse courte",
  "answerDisplay": "la réponse telle qu'elle sera affichée en gras",
  "context": "C'est bien [answerDisplay] qui/que/qu'... (phrase complète de confirmation)"
}`
}

const buildValidationPrompt = (
  question: string,
  expectedAnswer: string,
  userAnswer: string
): string => `
Question : "${question}"
Réponse attendue : "${expectedAnswer}"
Réponse de l'utilisateur : "${userAnswer}"

Est-ce que la réponse de l'utilisateur est correcte ?
Elle peut être formulée différemment, avoir des fautes
d'orthographe mineures, avoir des mots supplémentaires
(articles, "c'est", "je pense que"...) — l'essentiel
est que le sens soit correct.

Réponds UNIQUEMENT : {"correct": true} ou {"correct": false}
`

const callAPI = async (
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 500
): Promise<string> => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    })
  })
  const data = await res.json()
  return data.content?.[0]?.text
    ?.replace(/```json|```/g, '').trim() || ''
}

const removeEmojis = (str: string) => str
  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
  .replace(/[\u{2600}-\u{26FF}]/gu, '')
  .replace(/[\u{2700}-\u{27BF}]/gu, '')
  .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
  .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
  // eslint-disable-next-line no-control-regex -- plage ASCII volontaire pour ne garder que le texte latin
  .replace(/[^\x00-\x7FÀ-ɏ]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const renderHighlighted = (context: string, highlight: string) => {
  const idx = context.indexOf(highlight)
  if (idx === -1) return context
  return (
    <>
      {context.slice(0, idx)}
      <strong>{context.slice(idx, idx + highlight.length)}</strong>
      {context.slice(idx + highlight.length)}
    </>
  )
}

const choiceBaseStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'white', border: '2px solid var(--color-border)',
  borderRadius: '0.75rem', padding: '0.85rem',
  fontSize: '0.95rem', color: '#333',
  cursor: 'pointer', marginBottom: '0.75rem',
}

const choiceSelectedStyle: React.CSSProperties = {
  background: '#2a9d8f', color: 'white', borderColor: '#2a9d8f',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', background: '#2a9d8f', color: 'white',
  border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
  fontSize: '0.95rem', fontWeight: 'bold',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem', background: 'var(--color-border)', color: '#2a9d8f',
  border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
  fontSize: '0.95rem', fontWeight: 'bold',
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

export default function Histoire({ userId }: { userId?: string } = {}) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [currentTitle, setCurrentTitle] = useState<StoryTitle>(() => generateTitle())
  const [digoos, setDigoos] = useState(0)
  const [interests, setInterests] = useState<string[]>([])
  const [nodes, setNodes] = useState<StoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [spent, setSpent] = useState(0)
  const [retryParams, setRetryParams] = useState<{ nodesForFetch: StoryNode[]; nodeIndex: number; isLast: boolean } | null>(null)

  const [question, setQuestion] = useState<EndQuestion | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [questionLoading, setQuestionLoading] = useState(false)
  const [questionError, setQuestionError] = useState('')
  const [earnedDigoos, setEarnedDigoos] = useState(0)

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

      if (profile?.interests) setInterests(profile.interests)

      const { data: progress } = await supabase
        .from('progress')
        .select('digoos')
        .eq('user_id', user.id)
        .single()

      if (progress) setDigoos(progress.digoos || 0)
    }
    init()
  }, [])

  const loadNode = async (nodesForFetch: StoryNode[], nodeIndex: number, isLast: boolean) => {
    setLoading(true)
    setError('')
    if (isLast) setGameState('ending')
    try {
      const txt = await callAPI(
        buildSystemPrompt(currentTitle.full, interests),
        buildUserPrompt(nodesForFetch, nodeIndex)
      )
      const node: StoryNode = JSON.parse(txt)
      setNodes([...nodesForFetch, node])
      setRetryParams(null)
      if (isLast) {
        setGameState('end')
        await logActivity({ action_type: 'exercise_completed', metadata: { exercise: 'histoire' } }, userId)
      }
    } catch {
      setError("Erreur lors de la génération de l'histoire. Réessaie.")
      setRetryParams({ nodesForFetch, nodeIndex, isLast })
    } finally {
      setLoading(false)
    }
  }

  const handleNewTitle = async () => {
    if (digoos < 1) return
    await deductDigoos(1)
    setDigoos(prev => Math.max(0, prev - 1))
    setCurrentTitle(generateTitle())
  }

  const handleStart = () => {
    setGameState('playing')
    setNodes([])
    setSpent(0)
    setError('')
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

  const resetStory = () => {
    setNodes([])
    setSpent(0)
    setError('')
    setQuestion(null)
    setUserAnswer('')
    setAttempts(0)
    setQuestionError('')
    setEarnedDigoos(0)
  }

  const handleNewStory = () => {
    resetStory()
    setCurrentTitle(generateTitle())
    setGameState('select')
  }

  const handleQuit = () => {
    resetStory()
    setGameState('select')
  }

  const retry = () => {
    if (retryParams) loadNode(retryParams.nodesForFetch, retryParams.nodeIndex, retryParams.isLast)
  }

  const fetchQuestion = async () => {
    setQuestionLoading(true)
    setQuestionError('')
    try {
      const txt = await callAPI(
        "Tu es un assistant pédagogique pour enfants de 10 ans. Réponds UNIQUEMENT en JSON valide, sans aucun texte autour.",
        buildQuestionPrompt(nodes)
      )
      const parsed: EndQuestion = JSON.parse(txt)
      setQuestion(parsed)
    } catch {
      setQuestionError("Erreur lors de la génération de la question. Réessaie.")
    } finally {
      setQuestionLoading(false)
    }
  }

  const handleStartQuestion = () => {
    setAttempts(0)
    setUserAnswer('')
    setQuestionError('')
    setQuestion(null)
    setGameState('question')
    fetchQuestion()
  }

  const handleValidate = async () => {
    if (!question || !userAnswer.trim() || questionLoading) return
    setQuestionLoading(true)
    setQuestionError('')
    try {
      const txt = await callAPI(
        "Tu es un assistant qui valide des réponses d'enfants de 10 ans. Réponds UNIQUEMENT en JSON valide.",
        buildValidationPrompt(question.question, question.answer, userAnswer)
      )
      const { correct } = JSON.parse(txt)
      if (correct) {
        const reward = attempts === 0 ? 3 : attempts === 1 ? 2 : 1
        await addDigoos(reward, 'reward', userId)
        setDigoos(prev => prev + reward)
        setEarnedDigoos(reward)
        setGameState('question_done')
      } else if (attempts < 2) {
        setAttempts(prev => prev + 1)
        setUserAnswer('')
        setQuestionError('Pas tout à fait... réessaie !')
      } else {
        setEarnedDigoos(0)
        setGameState('question_done')
      }
    } catch {
      setQuestionError("Erreur lors de la validation. Réessaie.")
    } finally {
      setQuestionLoading(false)
    }
  }

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()

    const titleText = capitalize(currentTitle.full)
    const margin = 25
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = pageWidth - margin * 2
    const lineHeight = 7
    let y = 60

    const checkNewPage = (neededSpace: number) => {
      if (y + neededSpace > pageHeight - 20) {
        doc.addPage()
        y = 25
      }
    }

    // Page de titre
    doc.setFillColor('#2a9d8f')
    doc.rect(0, 0, pageWidth, 45, 'F')

    doc.setFontSize(20)
    doc.setTextColor('#ffffff')
    doc.setFont('helvetica', 'bold')
    doc.text(titleText, pageWidth / 2, 22, { align: 'center', maxWidth: contentWidth })

    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('Une histoire créée avec ODIGO', pageWidth / 2, 34, { align: 'center' })

    nodes.forEach((node, i) => {
      // Numéro de chapitre
      checkNewPage(20)
      doc.setFontSize(9)
      doc.setTextColor('#2a9d8f')
      doc.setFont('helvetica', 'bold')
      doc.text(`CHAPITRE ${i + 1}`, margin, y)
      y += 6

      // Ligne décorative
      doc.setDrawColor('var(--color-border)')
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6

      // Texte du nœud
      const cleanText = removeEmojis(node.text)
      doc.setFontSize(11)
      doc.setTextColor('#333333')
      doc.setFont('helvetica', 'normal')
      const lines: string[] = doc.splitTextToSize(cleanText, contentWidth)
      lines.forEach((line: string) => {
        checkNewPage(lineHeight)
        doc.text(line, margin, y, { maxWidth: contentWidth })
        y += lineHeight
      })
      y += 4

      // Choix fait — encadré
      if (node.choiceIndex !== undefined) {
        const choiceText = removeEmojis(node.choices[node.choiceIndex])
        const choiceLines: string[] = doc.splitTextToSize(`→ ${choiceText}`, contentWidth - 10)
        checkNewPage(choiceLines.length * 6 + 8)

        doc.setFillColor('var(--color-background)')
        doc.roundedRect(margin, y - 4, contentWidth, choiceLines.length * 6 + 6, 2, 2, 'F')

        doc.setFontSize(10)
        doc.setTextColor('#2a9d8f')
        doc.setFont('helvetica', 'italic')
        choiceLines.forEach((line: string) => {
          doc.text(line, margin + 4, y + 2)
          y += 6
        })
        y += 8
      }
    })

    // Pied de page sur chaque page
    const totalPages = doc.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setFontSize(8)
      doc.setTextColor('#cccccc')
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Histoire créée avec ODIGO — ${new Date().toLocaleDateString('fr-CH')} — Page ${p}/${totalPages}`,
        pageWidth / 2, pageHeight - 8, { align: 'center' }
      )
      doc.setDrawColor('#eeeeee')
      doc.setLineWidth(0.2)
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)
    }

    doc.save(`${titleText.replace(/\s+/g, '_')}.pdf`)
  }

  // ---- ÉCRAN SÉLECTION ----
  if (gameState === 'select') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>📖 Histoire interactive</h2>

        <div style={{ background: 'var(--color-background)', borderRadius: '1rem', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontStyle: 'italic', color: '#333' }}>
            {capitalize(currentTitle.full)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.5rem' }}>
            Histoire unique et éphémère — si tu quittes, elle disparaît ✨
          </div>
        </div>

        {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>}

        <div style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#e9c46a', fontWeight: 'bold' }}>
          Ton solde : {digoos} <Delta size={16} />
        </div>
        <p style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
          Le premier titre est gratuit. Regénérer coûte 1 <Delta size={16} />.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleNewTitle}
            disabled={digoos < 1}
            style={{ ...secondaryButtonStyle, flex: 1 }}
          >
            🎲 Nouveau titre — 1 <Delta size={16} />
          </button>
          <button
            onClick={handleStart}
            style={{ ...primaryButtonStyle, flex: 1 }}
          >
            📖 Commencer
          </button>
        </div>

        <div style={{
          marginTop: '0.75rem',
          background: '#fff8e0',
          border: '1px solid #e9c46a',
          borderRadius: '0.5rem',
          padding: '0.6rem 0.75rem',
          fontSize: '0.82rem',
          color: '#b8860b',
          lineHeight: '1.5',
          textAlign: 'center',
        }}>
          💡 À la fin de l'histoire, une question t'attend !
          Réponds correctement pour récupérer jusqu'à 3 <Delta size={14} />.
          Sois attentif·ve en lisant 👀
        </div>
      </div>
    )
  }

  // ---- ÉCRAN ÉPILOGUE EN COURS ----
  if (gameState === 'ending') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {capitalize(currentTitle.full)}
        </div>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', color: '#888', fontStyle: 'italic' }}>
          ✨ La fin approche{dots}
        </div>
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#e63946', fontSize: '0.85rem' }}>{error}</p>
            <button onClick={retry} style={primaryButtonStyle}>
              Réessayer
            </button>
          </div>
        )}
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
          {capitalize(currentTitle.full)}
        </div>

        <div className="page-enter" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem', fontSize: '1rem', lineHeight: '1.8', color: '#333' }}>
          {epilogue?.text}
        </div>

        <div style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {MAX_NODES} choix · {spent} <Delta size={16} /> dépensés
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button onClick={exportPDF} style={secondaryButtonStyle}>
            📄 Télécharger mon histoire
          </button>
          <button onClick={handleStartQuestion} style={primaryButtonStyle}>
            🎯 Répondre à une question — gagner jusqu'à 3 <Delta size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={handleNewStory} style={primaryButtonStyle}>
            🎲 Nouvelle histoire
          </button>
          <button onClick={handleQuit} style={secondaryButtonStyle}>
            Quitter
          </button>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN QUESTION ----
  if (gameState === 'question') {
    const remainingLabel = attempts === 0 ? '💎 3' : attempts === 1 ? '⭐ 2' : '🔸 1'
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>🎯 Question</h2>

        <div className="page-enter" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {!question ? (
            <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
              {questionError ? (
                <>
                  <p style={{ color: '#e63946', fontSize: '0.85rem' }}>{questionError}</p>
                  <button onClick={fetchQuestion} style={primaryButtonStyle}>Réessayer</button>
                </>
              ) : (
                <>Odigo prépare une question{dots}</>
              )}
            </div>
          ) : (
            <>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333', marginBottom: '1rem', textAlign: 'center' }}>
                {question.question}
              </div>
              <input
                type="text"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder="Ta réponse..."
                disabled={questionLoading}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '2px solid var(--color-border)', fontSize: '1rem', marginBottom: '1rem', boxSizing: 'border-box' }}
              />
              {questionError && (
                <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' }}>{questionError}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: '#e9c46a', fontWeight: 'bold' }}>
                  {remainingLabel} <Delta size={16} />
                </span>
                <button
                  onClick={handleValidate}
                  disabled={questionLoading || !userAnswer.trim()}
                  style={primaryButtonStyle}
                >
                  Valider
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ---- ÉCRAN QUESTION TERMINÉE ----
  if (gameState === 'question_done') {
    const success = earnedDigoos > 0
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
        {success ? (
          <>
            <h2 style={{ color: '#2a9d8f', fontSize: '1.8rem', marginBottom: '1rem' }}>✓ Bravo !</h2>
            <div className="page-enter" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1rem', fontSize: '1rem', color: '#333' }}>
              {question && renderHighlighted(question.context, question.answerDisplay)}
            </div>
            <div style={{ fontSize: '1rem', color: '#e9c46a', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              +{earnedDigoos} <Delta size={20} /> récupérés !
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: '#888', fontSize: '1.5rem', marginBottom: '1rem' }}>La réponse était...</h2>
            <div className="page-enter" style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem', fontSize: '1rem', color: '#333' }}>
              <div style={{ marginBottom: '0.5rem' }}><strong>{question?.answerDisplay}</strong></div>
              <div style={{ color: '#888', fontSize: '0.9rem' }}>{question?.context}</div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={handleNewStory} style={primaryButtonStyle}>
            🎲 Nouvelle histoire
          </button>
          <button onClick={handleQuit} style={secondaryButtonStyle}>
            Quitter
          </button>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN JEU ----
  const currentNode = nodes[nodes.length - 1]
  const chapterNum = nodes.length

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div style={{ fontStyle: 'italic', color: '#888', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.5rem' }}>
        {capitalize(currentTitle.full)}
      </div>

      <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '0.5rem' }}>
        Chapitre {Math.min(chapterNum, MAX_NODES)} / {MAX_NODES}
      </div>

      <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
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
          <button onClick={retry} style={primaryButtonStyle}>
            Réessayer
          </button>
        </div>
      )}
    </div>
  )
}
