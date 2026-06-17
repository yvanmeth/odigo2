import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { OdigoAvatar } from './OdigoAvatar'
import { findFAQ } from '../lib/faq'
import { submitSuggestion } from '../services/suggestions'

interface CompanionProps {
  userId: string
}

interface Profile {
  first_name?: string
  birth_date?: string
  has_met_odigo: boolean
  last_seen_at?: string
  interests?: string[]
  role?: string
}

interface Evaluation {
  evaluation_date: string
  topic: string
  subject_id: number
}

interface Progress {
  digoos_this_week: number
  week_streak: number
}

const SUGGESTION_KEYWORDS = [
  'idée', 'suggestion', 'amélioration', 'ajouter',
  'pourrait', 'serait bien', 'j\'aimerais',
  'fonctionnalité', 'souhaite', 'propose'
]

const isSuggestion = (msg: string): boolean => {
  const q = msg.toLowerCase()
  return SUGGESTION_KEYWORDS.some(k => q.includes(k))
}

const CONFIRMATION_WORDS = ['oui', 'ouais', 'yes', 'ok', "d'accord", 'daccord', 'vas-y', 'carrement', 'carrément']

const isConfirmation = (msg: string): boolean => {
  const q = msg.toLowerCase().trim()
  return CONFIRMATION_WORDS.some(w => q === w || q.startsWith(w + ' ') || q.startsWith(w + ','))
}

const SAFETY_PATTERNS = [
  'mourir', 'disparaître', 'me tuer', 'suicide',
  'me faire du mal', 'me blesser', 'en danger',
  'quelqu\'un me fait', 'violence', 'abus',
  'maltraitance', 'j\'ai peur de rentrer',
  'frapper', 'me bat', 'me touche',
]

const isSafetyAlert = (msg: string): boolean => {
  const lower = msg.toLowerCase()
  return SAFETY_PATTERNS.some(p => lower.includes(p))
}

export default function Companion({ userId }: CompanionProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'odi' | 'user'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [upcomingEvals, setUpcomingEvals] = useState<Evaluation[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [role, setRole] = useState<'child' | 'parent'>('child')
  const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchContext()
  }, [userId])

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const fetchContext = async () => {
    const [profileRes, evalsRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('first_name, birth_date, has_met_odigo, last_seen_at, interests, role').eq('id', userId).single(),
      supabase.from('evaluations').select('evaluation_date, topic, subject_id').eq('user_id', userId).gte('evaluation_date', new Date().toISOString().split('T')[0]).order('evaluation_date').limit(3),
      supabase.from('progress').select('digoos_this_week, week_streak').eq('user_id', userId).single(),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (evalsRes.data) setUpcomingEvals(evalsRes.data)
    if (progressRes.data) setProgress(progressRes.data)
    setRole(profileRes.data?.role === 'parent' ? 'parent' : 'child')

    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)

    if (profileRes.data) {
      setMessages([{
        role: 'odi',
        text: "Bonjour ! Je suis Odi, un chatbot assistant d'apprentissage. Je peux t'aider à comprendre une notion, préparer une évaluation ou organiser tes révisions. Je peux me tromper — vérifie les choses importantes avec un adulte ou ton enseignant."
      }])

      if (!profileRes.data.has_met_odigo) {
        await supabase.from('profiles').update({ has_met_odigo: true }).eq('id', userId)
      }
    }
  }

  const buildSystemPrompt = () => {
    const firstName = profile?.first_name || 'l\'élève'
    const interests = profile?.interests || []
    const evalInfo = upcomingEvals.length > 0
      ? `Évaluations à venir : ${upcomingEvals.map(e => `${e.topic} le ${e.evaluation_date}`).join(', ')}.`
      : 'Aucune évaluation à venir.'
    const progressInfo = progress
      ? `${progress.digoos_this_week} Δ cette semaine, ${progress.week_streak} semaines consécutives actives.`
      : ''

    return `Tu es Odi, un assistant d'apprentissage intégré à ODIGO, une plateforme scolaire pour enfants et adolescents.

IDENTITÉ ET RÔLE :
- Tu es un outil d'apprentissage, pas un ami ni un confident
- Tu es chaleureux et encourageant, mais toujours dans un cadre pédagogique clair
- Tu te présentes comme "Odi, assistant d'apprentissage" et non comme un ami ou compagnon

CE QUE TU PEUX FAIRE :
- Expliquer une notion scolaire
- Aider à préparer une évaluation
- Reformuler une consigne
- Proposer une méthode de travail
- Encourager après un effort
- Aider à planifier des révisions
- Poser des questions de compréhension
- Générer des exercices simples

CE QUE TU NE DOIS PAS FAIRE :
- Faire les devoirs à la place de l'élève
- Donner des conseils médicaux, psychologiques ou juridiques
- Devenir un confident émotionnel
- Poser des questions personnelles inutiles
- Demander ou stocker des données sensibles (adresse, école exacte, téléphone, photo, informations médicales, informations familiales sensibles)
- Discuter de sexualité, violence, automutilation, drogues — sauf pour rediriger vers un adulte
- Utiliser des phrases comme "je serai toujours là pour toi", "tu peux tout me dire", "notre secret", "je te comprends mieux que les autres"
- Faire de la flatterie excessive ("tu es incroyable", "tu es exceptionnel")

STYLE DE RÉPONSE :
- Réponses courtes par défaut (3-5 phrases maximum)
- Vocabulaire adapté à un enfant de 10-15 ans
- Une seule question à la fois si tu en poses une
- Valoriser l'effort, la méthode et la régularité, pas l'identité ("bonne méthode !" plutôt que "tu es brillant !")
- Toujours proposer une action concrète
- Encouragement bref et sincère, pas excessif
- Pas de mise en forme markdown (pas de gras, pas de listes)
- Ne JAMAIS commencer un message par le prénom de l'utilisateur
- Ne JAMAIS commencer par "Super !", "Super question !", "Excellent !" ou toute autre exclamation enthousiaste
- Ne pas toujours terminer par une question — parfois une réponse directe suffit
- Si l'utilisateur répond "oui" plusieurs fois, donner l'information directement sans redemander
- Varier les formulations, éviter la répétition
- Quand on te pose une question générale sur ODIGO (comment ça marche, etc.), réponds brièvement et propose 3 sujets cliquables sous forme de liste JSON à la fin de ton message, comme ceci : [SUGGESTIONS: "Le tableau de bord", "Le planificateur", "Les exercices"]

SITUATIONS DE SÉCURITÉ — réponses obligatoires :
Si l'élève exprime une détresse grave, mentionne vouloir disparaître, signale une situation de danger, de violence ou d'abus :
Répondre UNIQUEMENT : "Ce que tu décris est sérieux et important. Je suis un outil d'apprentissage — je ne suis pas en mesure de t'aider pour ça. Parle tout de suite à un adulte de confiance : un parent, un enseignant, ou appelle les services d'urgence si tu es en danger."

Si l'élève demande de faire ses devoirs à sa place :
"Je ne peux pas faire le travail à ta place — ce ne serait pas t'aider vraiment. Par contre, je peux t'aider à comprendre la consigne, faire un plan ou vérifier ton raisonnement."

Si l'élève demande de garder un secret :
"Je suis un outil informatique — je ne garde pas de secrets. Tout ce qui est important doit être partagé avec un adulte de confiance."

ANTI-PERSONNIFICATION :
Ne jamais utiliser : "ton ami", "ton confident", "je suis toujours là", "tu peux tout me dire", "notre secret", "je te comprends mieux que les autres".
Préférer : "je peux t'aider à...", "en tant qu'assistant...", "demande à un parent ou enseignant pour..."

Contexte de l'utilisateur :
- Prénom : ${firstName}
- Rôle : ${role === 'parent' ? 'parent' : 'élève'}
- Niveau : primaire / collège
${interests.length > 0 ? `- Centres d'intérêt : ${interests.join(', ')}` : ''}
${progressInfo ? `- Progression : ${progressInfo}` : ''}

Contexte scolaire : ${evalInfo}`
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    // Confirmation d'une suggestion en attente de transmission
    if (pendingSuggestion && isConfirmation(userMsg)) {
      const ok = await submitSuggestion(pendingSuggestion)
      setMessages(prev => [...prev, {
        role: 'odi',
        text: ok
          ? "C'est noté ! Ton idée a été transmise. Merci de contribuer à améliorer ODIGO 🙏"
          : "Oups, je n'ai pas réussi à transmettre ton idée. Réessaie plus tard."
      }])
      setPendingSuggestion(null)
      setLoading(false)
      return
    }
    setPendingSuggestion(null)

    // Pré-filtre de sécurité — court-circuite l'appel API
    if (isSafetyAlert(userMsg)) {
      setMessages(prev => [...prev, {
        role: 'odi',
        text: "Ce que tu décris est sérieux et important. Je suis un outil d'apprentissage — je ne suis pas en mesure de t'aider pour ça. Parle tout de suite à un adulte de confiance : un parent, un enseignant, ou appelle les services d'urgence si tu es en danger (numéro d'urgence : 117 en Suisse, 15 ou 18 en France)."
      }])
      ;(async () => {
        try {
          await supabase.from('safety_logs').insert({
            user_id: userId,
            trigger_pattern: SAFETY_PATTERNS.find(p => userMsg.toLowerCase().includes(p)),
            created_at: new Date().toISOString()
          })
        } catch {}
      })()
      setLoading(false)
      return
    }

    // Réponse directe via la FAQ si la question correspond
    const faqResult = findFAQ(userMsg, role)
    if (faqResult) {
      setMessages(prev => [...prev, { role: 'odi', text: faqResult.answer }])
      setLoading(false)
      return
    }

    try {
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
          max_tokens: 350,
          system: buildSystemPrompt(),
          messages: [
            ...messages.filter(m => m.role === 'user').map(m => ({ role: 'user', content: m.text })),
            { role: 'user', content: userMsg }
          ]
        })
      })

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Je suis là !'
      setMessages(prev => [...prev, { role: 'odi', text: reply }])

      if (isSuggestion(userMsg)) {
        setMessages(prev => [...prev, { role: 'odi', text: "Tu sembles avoir une idée d'amélioration pour ODIGO ! Tu veux que je la transmette à l'équipe ?" }])
        setPendingSuggestion(userMsg)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'odi', text: "Oups, je n'arrive pas à répondre là. Réessaie dans un moment !" }])
    }

    setLoading(false)
  }

  return (
    <>
      {/* Bulle flottante */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#2a9d8f',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(42,157,143,0.4)',
          fontSize: '1.5rem',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        title="Odi — assistant d'apprentissage"
      >
        {open ? '✕' : <OdigoAvatar size={32} />}
      </button>

      {/* Fenêtre de chat */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '5rem',
          right: '1.5rem',
          width: '320px',
          maxHeight: '480px',
          background: 'white',
          borderRadius: '1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ background: '#2a9d8f', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <OdigoAvatar size={24} />
            <div>
              <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Odi</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>Chatbot assistant d'apprentissage</div>
            </div>
          </div>

          {/* Bandeau de transparence */}
          <div style={{
            background: '#fff8e0',
            border: '1px solid #e9c46a',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            color: '#b8860b',
            lineHeight: '1.4',
            margin: '0.5rem 0',
          }}>
            ⚠️ Je suis un chatbot IA. Je peux me tromper. Pour toute question importante, personnelle ou médicale, parle à un adulte de confiance.
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((msg, i) => {
              const hasSuggestions = msg.role === 'odi' && msg.text.includes('[SUGGESTIONS:')
              const cleanText = msg.text.replace(/\[SUGGESTIONS:.*?\]/s, '').trim()
              const suggMatch = msg.text.match(/\[SUGGESTIONS:(.*?)\]/s)
              const suggList = suggMatch
                ? suggMatch[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''))
                : []

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.4rem' }}>
                  <div style={{
                    maxWidth: '85%',
                    padding: '0.6rem 0.9rem',
                    borderRadius: msg.role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                    background: msg.role === 'user' ? '#2a9d8f' : '#f0faf8',
                    color: msg.role === 'user' ? 'white' : '#333',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                  }}>
                    {cleanText}
                  </div>
                  {hasSuggestions && i === messages.length - 1 && suggList.map((s, j) => (
                    <button
                      key={j}
                      onClick={() => {
                        setInput(s)
                        setTimeout(() => sendMessage(), 100)
                      }}
                      style={{ padding: '0.35rem 0.8rem', background: 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '2rem', cursor: 'pointer', fontSize: '0.82rem', alignSelf: 'flex-start' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )
            })}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f0faf8', borderRadius: '1rem 1rem 1rem 0.25rem', padding: '0.6rem 0.9rem', color: '#888', fontSize: '0.9rem' }}>
                  ...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '0.75rem', borderTop: '1px solid #e0f0ee', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Poser une question..."
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '2rem', border: '1px solid #ddd', fontSize: '0.9rem', outline: 'none' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{ padding: '0.5rem 0.75rem', background: input.trim() ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '2rem', cursor: input.trim() ? 'pointer' : 'default', fontSize: '0.9rem' }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
