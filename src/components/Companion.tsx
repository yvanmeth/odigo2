import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface CompanionProps {
  userId: string
}

interface Profile {
  first_name?: string
  birth_date?: string
  has_met_odigo: boolean
  last_seen_at?: string
  interests?: string[]
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

const ODIGO_AVATAR = '🟢'

export default function Companion({ userId }: CompanionProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'odigo' | 'user'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [upcomingEvals, setUpcomingEvals] = useState<Evaluation[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
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
      supabase.from('profiles').select('first_name, birth_date, has_met_odigo, last_seen_at, interests').eq('id', userId).single(),
      supabase.from('evaluations').select('evaluation_date, topic, subject_id').eq('user_id', userId).gte('evaluation_date', new Date().toISOString().split('T')[0]).order('evaluation_date').limit(3),
      supabase.from('progress').select('digoos_this_week, week_streak').eq('user_id', userId).single(),
    ])

    if (profileRes.data) setProfile(profileRes.data)
    if (evalsRes.data) setUpcomingEvals(evalsRes.data)
    if (progressRes.data) setProgress(progressRes.data)

    // Mettre à jour last_seen_at
    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)

    // Générer le message d'accueil
    if (profileRes.data) {
      const welcomeMsg = generateWelcomeMessage(profileRes.data, evalsRes.data || [], progressRes.data)
      setMessages([{ role: 'odigo', text: welcomeMsg }])

      // Marquer la présentation comme faite
      if (!profileRes.data.has_met_odigo) {
        await supabase.from('profiles').update({ has_met_odigo: true }).eq('id', userId)
      }
    }
  }

  const generateWelcomeMessage = (p: Profile, evals: Evaluation[], prog: Progress | null) => {
    const now = new Date()
    const hour = now.getHours()
    const firstName = p.first_name || 'toi'
    const daysSinceLastSeen = p.last_seen_at
      ? Math.floor((now.getTime() - new Date(p.last_seen_at).getTime()) / (1000 * 60 * 60 * 24))
      : 99

    // Première rencontre
    if (!p.has_met_odigo) {
        return `Bonjour ${firstName} ! Je m'appelle Odigo, mais tu peux aussi m'appeler Odi, Digo, ou juste O. Je suis ton compagnon d'apprentissage : je suis là pour t'encourager, te rappeler tes évaluations, et te tenir compagnie. On va bien s'entendre !`
    }

    // Soir — conseil sommeil
    if (hour >= 21) {
      return `Bonsoir ${firstName} ! Il se fait tard... N'oublie pas qu'une bonne nuit de sommeil, c'est souvent plus utile que réviser à cette heure-ci. Ton cerveau consolide ce que tu as appris pendant que tu dors. 🌙`
    }

    // Retour après plusieurs jours
    if (daysSinceLastSeen >= 3) {
      return `Hé ${firstName}, ça fait ${daysSinceLastSeen} jours qu'on ne s'est pas vus ! Content de te retrouver. 😊 On reprend ?`
    }

    // Évaluation très proche (demain ou après-demain)
    if (evals.length > 0) {
      const nextEval = evals[0]
      const daysUntil = Math.ceil((new Date(nextEval.evaluation_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysUntil <= 2) {
        const when = daysUntil <= 1 ? "demain" : "dans 2 jours"
        return `${hour < 12 ? 'Bonjour' : 'Salut'} ${firstName} ! Tu as une évaluation de ${nextEval.topic} ${when}. Tu te sens prêt·e ? Je suis là si tu veux réviser. 💪`
      }
    }

    // Bonne semaine en cours
    if (prog && prog.digoos_this_week >= 50) {
      return `${hour < 12 ? 'Bonjour' : 'Salut'} ${firstName} ! Super semaine jusqu'ici — tu as déjà ${prog.digoos_this_week} Digoos cette semaine. Continue comme ça ! 🔥`
    }

    // Message par défaut selon l'heure
    if (hour < 12) return `Bonjour ${firstName} ! Prêt·e pour une bonne session de travail ? 📚`
    if (hour < 18) return `Salut ${firstName} ! Comment se passe ta journée ? Je suis là si tu as besoin de moi.`
    return `Bonsoir ${firstName} ! Une petite révision avant de se détendre ? Je suis là. 😊`
  }

  const buildSystemPrompt = () => {
    const firstName = profile?.first_name || 'l\'élève'
    const evalInfo = upcomingEvals.length > 0
      ? `Évaluations à venir : ${upcomingEvals.map(e => `${e.topic} le ${e.evaluation_date}`).join(', ')}.`
      : 'Aucune évaluation à venir.'
    const digoosInfo = progress ? `${progress.digoos_this_week} Digoos cette semaine, ${progress.week_streak} semaines consécutives actives.` : ''

    return `Tu es Odigo, le compagnon bienveillant de l'application ODIGO. Tu t'adresses à ${firstName}.

Ton caractère : toujours encourageant, bienveillant, jamais réprimandant. Tu valorises l'effort et la régularité, pas seulement les résultats.

Contexte : ${evalInfo} ${digoosInfo}

Règles importantes :
- Ne JAMAIS commencer un message par le prénom de l'utilisateur — c'est une conversation naturelle, pas un email
- Réponses courtes : 1 à 3 phrases maximum
- Pas de mise en forme markdown (pas de gras, pas de listes)
- Quand on te pose une question générale sur ODIGO (comment ça marche, etc.), réponds brièvement et propose 3 sujets cliquables sous forme de liste JSON à la fin de ton message, comme ceci : [SUGGESTIONS: "Le tableau de bord", "Le planificateur", "Les exercices"]
- Toujours encourageant, jamais de reproches
- Tu connais l'importance du sommeil pour l'apprentissage, surtout le soir
- Tu t'adresses à un enfant ou adolescent. Si la conversation dérive vers des sujets inappropriés (violence, sexualité, drogues, idées extrémistes), refuse poliment et redirige vers les sujets scolaires ou le bien-être`
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

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
          max_tokens: 300,
          system: buildSystemPrompt(),
          messages: [
            ...messages.filter(m => m.role === 'user').map(m => ({ role: 'user', content: m.text })),
            { role: 'user', content: userMsg }
          ]
        })
      })

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Je suis là ! 😊'
      setMessages(prev => [...prev, { role: 'odigo', text: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'odigo', text: 'Oups, je n\'arrive pas à répondre là. Réessaie dans un moment ! 😊' }])
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
        title="Odigo — ton compagnon"
      >
        {open ? '✕' : ODIGO_AVATAR}
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
            <span style={{ fontSize: '1.2rem' }}>🟢</span>
            <div>
              <div style={{ color: 'white', fontWeight: 'bold', fontSize: '0.95rem' }}>Odigo</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>ton compagnon</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((msg, i) => {
              const hasSuggestions = msg.role === 'odigo' && msg.text.includes('[SUGGESTIONS:')
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
              placeholder="Écris à Odigo..."
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