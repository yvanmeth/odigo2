import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { OdigoAvatar } from './OdigoAvatar'
import { formatDateDMY } from '../lib/dates'

interface CompanionProps {
  userId: string
  currentPage?: string
  hasNotification?: boolean
  notificationMessages?: string[]
  onNotificationRead?: () => void
}

interface Message {
  role: 'odi' | 'user'
  text: string
  isCommand?: boolean
  isWelcome?: boolean
}

const SLASH_COMMANDS = [
  { cmd: '/liste', desc: 'Affiche toutes les commandes disponibles' },
  { cmd: '/aide', desc: 'Explique la page actuelle' },
  { cmd: '/rappels', desc: 'Tes rappels et évaluations à venir' },
  { cmd: '/digoos', desc: 'Ton solde et comment en gagner' },
  { cmd: '/semaine', desc: 'Résumé de ta semaine' },
  { cmd: '/cartes', desc: 'Ta collection de cartes' },
  { cmd: '/missions', desc: 'Tes missions en cours' },
]

const getPageHelp = (page: string): string => {
  const helps: Record<string, string> = {
    dashboard: '⚡ Le Tableau de bord résume ta semaine : évaluations à venir, révisions, événements, rappels, et tes séries de jours/semaines/mois actifs.',
    planner: '⚡ Le Planificateur te permet d\'ajouter tes évaluations, révisions, événements et rappels. Tu peux basculer entre vue Liste et vue Calendrier.',
    subjects: '⚡ Dans Matières, tu retrouves tes notes de cours, post-its, listes de mots et évaluations par matière.',
    wordlists: '⚡ Crée et gère tes listes de vocabulaire, conjugaison ou dictée. Elles servent dans les exercices.',
    exercises: '⚡ Choisis un exercice pour t\'entraîner et gagner des Δ : QCM, épellation, flashcards, conjugaison, puzzle de phrases, maths...',
    rewards: '⚡ Dépense tes Δ dans la Boutique, consulte ton Portefeuille, réclame tes récompenses de régularité dans Progrès et récompenses.',
    settings: '⚡ Gère ton profil, ton rôle et tes préférences ici.',
  }
  return helps[page] || '⚡ Utilise /liste pour voir toutes les commandes disponibles.'
}

export default function Companion({ userId, currentPage, hasNotification, notificationMessages, onNotificationRead }: CompanionProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
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
    const { data: profileData } = await supabase
      .from('profiles').select('has_met_odigo').eq('id', userId).single()

    await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)

    setMessages([{
      role: 'odi',
      text: "Salut, je peux t'aider avec des commandes rapides. Tape /liste pour voir lesquelles !",
      isWelcome: true,
    }])

    if (profileData && !profileData.has_met_odigo) {
      await supabase.from('profiles').update({ has_met_odigo: true }).eq('id', userId)
    }
  }

  const handleSlashCommand = async (raw: string) => {
    const [cmd] = raw.split(' ')
    let response = ''

    switch (cmd) {
      case '/liste':
        response = '⚡ Commandes disponibles :\n\n' +
          SLASH_COMMANDS.map(c => `${c.cmd} — ${c.desc}`).join('\n')
        break

      case '/aide':
        response = getPageHelp(currentPage || 'dashboard')
        break

      case '/rappels': {
        const today = new Date().toISOString().split('T')[0]
        const [remRes, evalRes] = await Promise.all([
          supabase.from('reminders').select('title, deadline_date')
            .eq('user_id', userId).eq('completed', false).order('deadline_date'),
          supabase.from('evaluations').select('topic, evaluation_date')
            .eq('user_id', userId).gte('evaluation_date', today)
            .order('evaluation_date').limit(3),
        ])
        response = '⚡ Tes rappels et évaluations :\n\n'
        if (remRes.data && remRes.data.length > 0) {
          response += '🔔 Rappels :\n' +
            remRes.data.map(r => `• ${r.title} (${formatDateDMY(r.deadline_date)})`).join('\n')
        } else {
          response += '🔔 Aucun rappel en cours.'
        }
        response += '\n\n📅 Prochaines évaluations :\n'
        if (evalRes.data && evalRes.data.length > 0) {
          response += evalRes.data.map(e => `• ${e.topic} (${formatDateDMY(e.evaluation_date)})`).join('\n')
        } else {
          response += 'Aucune évaluation planifiée.'
        }
        break
      }

      case '/digoos': {
        const { data: prog } = await supabase
          .from('progress').select('digoos, digoos_this_week')
          .eq('user_id', userId).single()
        response = `⚡ Ton solde : ${prog?.digoos || 0} Δ\n` +
          `Cette semaine : ${prog?.digoos_this_week || 0} Δ\n\n` +
          `Pour en gagner plus : fais des exercices, utilise le planificateur, ou réclame tes récompenses de jours/semaines/mois actifs dans Progrès et récompenses !`
        break
      }

      case '/semaine': {
        const today = new Date()
        const monday = new Date(today)
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        const mondayStr = monday.toISOString().split('T')[0]
        const sundayStr = sunday.toISOString().split('T')[0]
        const [actRes, progRes] = await Promise.all([
          supabase.from('daily_activity').select('*', { count: 'exact', head: true })
            .eq('user_id', userId).eq('action_type', 'exercise_completed')
            .gte('date', mondayStr).lte('date', sundayStr),
          supabase.from('progress').select('digoos_this_week').eq('user_id', userId).single(),
        ])
        response = `⚡ Ta semaine :\n\n` +
          `🎯 ${actRes.count || 0} exercice(s) complété(s)\n` +
          `💰 ${progRes.data?.digoos_this_week || 0} Δ gagnés\n\n` +
          `Continue comme ça !`
        break
      }

      case '/cartes': {
        const [cardsRes, totalRes] = await Promise.all([
          supabase.from('user_cards').select('quantity').eq('user_id', userId),
          supabase.from('cards').select('*', { count: 'exact', head: true }),
        ])
        const owned = cardsRes.data?.length || 0
        response = `⚡ Ta collection :\n\n` +
          `🎴 ${owned} / ${totalRes.count || 0} cartes différentes\n\n` +
          `Rends-toi dans la Boutique pour tenter ta chance au tirage au sort !`
        break
      }

      case '/missions': {
        const { data: missions } = await supabase
          .from('missions').select('name, deadline')
          .eq('child_id', userId).eq('status', 'pending').order('deadline')
        response = '⚡ Tes missions en cours :\n\n'
        if (missions && missions.length > 0) {
          response += missions.map((m: { name: string; deadline: string }) => {
            const d = new Date(m.deadline)
            const dateStr = d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
            const timeStr = d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
            return `• ${m.name} — jusqu'au ${dateStr} à ${timeStr}`
          }).join('\n')
        } else {
          response += 'Aucune mission en cours pour le moment.'
        }
        break
      }

      default:
        response = `Commande inconnue "${cmd}". Tape /liste pour voir toutes les commandes disponibles.`
    }

    setMessages(prev => [...prev, { role: 'odi', text: response, isCommand: true }])
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    if (userMsg.startsWith('/')) {
      setMessages(prev => [...prev, { role: 'user', text: userMsg }])
      await handleSlashCommand(userMsg)
      setLoading(false)
      return
    }

    setMessages(prev => [
      ...prev,
      { role: 'user', text: userMsg },
      { role: 'odi', text: 'Je suis limité aux commandes slash. Tape /liste pour voir tout ce que je peux faire !', isCommand: true },
    ])
    setLoading(false)
  }

  const handleOpen = () => {
    if (!open && hasNotification && notificationMessages && notificationMessages.length > 0) {
      const notifMsgs = notificationMessages.map(text => ({
        role: 'odi' as const,
        text,
        isCommand: true,
      }))
      setMessages(prev => [...notifMsgs, ...prev])
      onNotificationRead?.()
    }
    setOpen(prev => !prev)
  }

  return (
    <>
      {/* Bulle flottante */}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000 }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            onClick={handleOpen}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#2a9d8f',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(42,157,143,0.4)',
              fontSize: '1.5rem',
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
          {hasNotification && !open && (
            <div style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#e63946',
              border: '2px solid white',
              zIndex: 1,
            }} />
          )}
        </div>
      </div>

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
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>Assistant — commandes uniquement</div>
            </div>
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
                    background: msg.role === 'user' ? '#2a9d8f' : 'var(--color-background)',
                    color: msg.role === 'user' ? 'white' : '#333',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    ...(msg.isCommand ? { borderLeft: '3px solid #2a9d8f', whiteSpace: 'pre-line' as const } : {}),
                  }}>
                    {msg.isWelcome ? (
                      <span>
                        Salut, je peux t'aider avec des commandes rapides. Tape{' '}
                        <strong style={{ color: '#2a9d8f' }}>/liste</strong>
                        {' '}pour voir lesquelles !
                      </span>
                    ) : cleanText}
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
                <div style={{ background: 'var(--color-background)', borderRadius: '1rem 1rem 1rem 0.25rem', padding: '0.6rem 0.9rem', color: '#888', fontSize: '0.85rem' }}>
                  ...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', position: 'relative' }}>
            {input.startsWith('/') && input.length > 0 && (() => {
              const matches = SLASH_COMMANDS.filter(c => c.cmd.startsWith(input.split(' ')[0]))
              return matches.length > 0 ? (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '0.75rem',
                  right: '0.75rem',
                  background: 'white',
                  border: '1px solid var(--color-border)',
                  borderRadius: '0.5rem',
                  marginBottom: '0.25rem',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
                  zIndex: 10,
                }}>
                  {matches.map(c => (
                    <div
                      key={c.cmd}
                      onClick={() => setInput(c.cmd + ' ')}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        borderBottom: '1px solid #f5f5f5',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <strong style={{ color: '#2a9d8f' }}>{c.cmd}</strong>
                      <span style={{ color: '#888' }}> — {c.desc}</span>
                    </div>
                  ))}
                </div>
              ) : null
            })()}
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Tape / pour voir les commandes..."
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
