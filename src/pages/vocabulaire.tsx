import { useEffect, useState, useCallback } from 'react'
import { Delta } from '../components/Delta'
import { EmptyState } from '../components/EmptyState'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'
import { speak } from '../lib/speech'
import HighscoreModal from '../components/HighscoreModal'

interface GuestProps {
  guestMode?: boolean
  guestListId?: string
  onGameEnd?: () => void
  userId?: string
}

interface WordList {
  id: string
  name: string
}

interface Question {
  mot: string
  phrase: string
}

type GameState = 'select' | 'loading' | 'playing' | 'result'

const NB_QUESTIONS = [5, 8, 10, 15]

const normaliser = (s: string) => s.trim().toLowerCase()

const renderPhrase = (phrase: string, mot?: string, correct?: boolean) => {
  const parts = phrase.split('___')
  if (parts.length !== 2) return <span>{phrase}</span>
  const fill = mot ?? '___'
  const color = mot === undefined ? '#2a9d8f' : correct ? '#2a9d8f' : '#e63946'
  return (
    <span>
      {parts[0]}
      <strong style={{ color, textDecoration: mot ? 'underline' : 'none' }}>{fill}</strong>
      {parts[1]}
    </span>
  )
}

export default function Vocabulaire({ guestMode, guestListId, onGameEnd, userId }: GuestProps = {}) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [nbQ, setNbQ] = useState(8)

  // File de questions : queue[0] = question courante
  const [queue, setQueue] = useState<Question[]>([])
  const [questionNum, setQuestionNum] = useState(1)           // compteur affiché (croît toujours)
  const [totalQ, setTotalQ] = useState(0)                     // total affiché (+1 à chaque erreur)
  const [motsVus, setMotsVus] = useState<Set<string>>(new Set()) // pour n'enregistrer que le 1er essai

  const [reponse, setReponse] = useState('')
  const [feedback, setFeedback] = useState<{ correct: boolean } | null>(null)
  const [resultats, setResultats] = useState<{
    mot: string; phrase: string; correct: boolean; donnee: string
  }[]>([])
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [digoosEarned, setDigoosEarned] = useState(0)
  const [error, setError] = useState('')
  const [showHighscore, setShowHighscore] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [userInterests, setUserInterests] = useState<string[]>([])
  const [userFirstName, setUserFirstName] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('interests, first_name')
        .eq('id', user.id)
        .single()
      if (profile && profile.interests?.length > 0) setUserInterests(profile.interests)
      if (profile?.first_name) setUserFirstName(profile.first_name as string)
    }
    if (!guestMode) fetchProfile()
  }, [guestMode])

  useEffect(() => {
    if (guestMode && guestListId) {
      setSelectedList(guestListId)
    } else {
      fetchLists()
    }
  }, [])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('word_lists').select('id, name').eq('user_id', userId || user.id).in('list_type', ['dictée', 'vocabulaire']).eq('language', 'Français').order('name')
    if (data) setLists(data)
  }

  const checkHighscore = async (finalScore: number): Promise<boolean> => {
    if (localStorage.getItem('odigo_highscores') === 'off') return false
    if (!selectedList) return false
    const { data } = await supabase
      .from('highscores').select('score')
      .eq('exercise', 'vocabulaire').eq('list_id', selectedList)
      .order('score', { ascending: false }).limit(5)
    if (!data) return false
    if (data.length < 5) return true
    return finalScore > data[data.length - 1].score
  }

  const genererQuestions = async () => {
    if (!selectedList) return
    setError('')
    setGameState('loading')

    const { data } = await supabase
      .from('word_items')
      .select('source_word')
      .eq('list_id', selectedList)

    const mots = (data || [])
      .map((w: any) => w.source_word?.trim())
      .filter(Boolean)

    if (mots.length === 0) {
      setError('Cette liste ne contient aucun mot.')
      setGameState('select')
      return
    }

    const prenom = userFirstName || "l'élève"
    const interestsSection = userInterests.length > 0
      ? `Contexte pour personnaliser les phrases (utilise ces références comme contexte narratif, jamais comme mot à deviner) :\n${userInterests.join(', ')}.`
      : `Utilise des exemples simples et universels, adaptés à des élèves du primaire.`

    const intro = guestMode
      ? `Tu génères des exercices de vocabulaire français adaptés à des élèves du primaire (8-12 ans). Utilise des exemples simples, universels et engageants. Évite toute référence à des personnes ou contextes spécifiques.`
      : `Tu es un générateur d'exercices de phrases à trou pour ${prenom}, élève du primaire.\n\n${interestsSection}`

    const prompt = `${intro}

Génère exactement ${nbQ} phrases à trou à partir de cette liste de mots : ${mots.join(', ')}.
Si moins de mots que de questions, réutilise certains mots.

Règles STRICTES :
- Utilise UNIQUEMENT les mots de cette liste exacte, sans en inventer d'autres : ${mots.join(', ')}
- Le mot dans "mot" doit être copié exactement depuis la liste, sans modification
- La phrase doit contenir le mot EXACTEMENT tel quel (même forme, même orthographe, singulier ou pluriel exactement comme dans la liste)
- ___ remplace ce mot exact dans la phrase
- La phrase doit rendre le mot devinable grâce au contexte, sans ambiguïté sur la forme exacte du mot
- La phrase est naturelle, adaptée à un enfant de 8-12 ans, entre 8 et 20 mots

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown :
[{"mot":"le mot exact copié depuis la liste","phrase":"La phrase avec ___ à la place du mot."}]`

    try {
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
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data2 = await res.json()
      const txt = (data2.content?.find((b: any) => b.type === 'text')?.text || '')
        .replace(/```json|```/g, '').trim()
      const parsed: Question[] = JSON.parse(txt)
      setQueue(parsed)
      setQuestionNum(1)
      setTotalQ(parsed.length)
      setMotsVus(new Set())
      setReponse('')
      setFeedback(null)
      setResultats([])
      setStreak(0)
      setScore(0)
      setDigoosEarned(0)
      setGameState('playing')
    } catch {
      setError("Erreur lors de la génération des phrases. Vérifie ta connexion et réessaie.")
      setGameState('select')
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    if (guestMode && selectedList && gameState === 'select') genererQuestions()
  }, [selectedList])

  const valider = useCallback(() => {
    if (!reponse.trim() || feedback) return
    const q = queue[0]
    if (!q) return
    const correct = normaliser(reponse) === normaliser(q.mot)

    const newStreak = correct ? streak + 1 : 0
    const points = correct ? 10 + (newStreak >= 3 ? 5 : 0) : 0
    const digoos = correct ? 1 : 0

    setStreak(newStreak)
    setScore(prev => prev + points)
    setDigoosEarned(prev => prev + digoos)
    setFeedback({ correct })

    // N'enregistre que le premier passage de chaque mot
    if (!motsVus.has(q.mot)) {
      setResultats(prev => [...prev, { mot: q.mot, phrase: q.phrase, correct, donnee: reponse.trim() }])
      setMotsVus(prev => new Set(prev).add(q.mot))
    }
  }, [reponse, feedback, queue, streak, motsVus])

  const suivant = useCallback(() => {
    const q = queue[0]
    if (!q || !feedback) return

    const newQueue = queue.slice(1)
    if (!feedback.correct) {
      newQueue.push(q)          // remet en fin de file si raté
      setTotalQ(prev => prev + 1)
    }
    setQuestionNum(prev => prev + 1)

    if (newQueue.length === 0) {
      finaliser()
    } else {
      setQueue(newQueue)
      setReponse('')
      setFeedback(null)
    }
  }, [queue, feedback])

  const finaliser = async () => {
    if (guestMode) { onGameEnd?.(); return }
    await addDigoos(digoosEarned, 'exercise', userId)
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: resultats.length,
      questions_correct: resultats.filter(r => r.correct).length,
      metadata: { exercise: 'vocabulaire' },
    }, userId)
    const isTop = await checkHighscore(score)
    if (isTop) setShowHighscore(true)
    else setGameState('result')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!feedback) valider()
      else suivant()
    }
  }

  const q = queue[0]
  const correctCount = resultats.filter(r => r.correct).length
  // Mots encore à maîtriser : unique mots dans la file (hors mot courant si juste répondu)
  const motsRestants = new Set(
    (feedback?.correct ? queue.slice(1) : queue).map(item => item.mot)
  ).size
  // Le prochain "Suivant" terminera la session uniquement si la queue n'aura plus rien
  const isLastRound = queue.length === 1 && feedback?.correct === true

  // ---- ÉCRAN SÉLECTION ----
  if ((gameState === 'select' || gameState === 'loading') && guestMode) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '1rem' }}>
        ⏳ Génération des questions...
      </div>
    )
  }

  if (gameState === 'select' || gameState === 'loading') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>📝 Vocabulaire</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '520px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste de mots</label>
            {lists.length === 0 ? (
              <EmptyState
                emoji="📝"
                title="Aucune liste disponible"
                subtitle="Crée une liste de type Dictée ou Vocabulaire en français pour jouer à cet exercice."
              />
            ) : (
              <select
                value={selectedList}
                onChange={e => setSelectedList(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
              >
                <option value="">-- Sélectionner --</option>
                {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nombre de questions</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {NB_QUESTIONS.map(n => (
                <button key={n} onClick={() => setNbQ(n)}
                  style={{ flex: 1, padding: '0.6rem', background: nbQ === n ? '#2a9d8f' : 'var(--color-border)', color: nbQ === n ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: nbQ === n ? 'bold' : 'normal' }}
                >{n}</button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

          <button onClick={genererQuestions} disabled={!selectedList || gameState === 'loading'}
            style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}
          >
            {gameState === 'loading' ? '⏳ Génération des phrases...' : '🚀 Jouer'}
          </button>

          {selectedList && localStorage.getItem('odigo_highscores') !== 'off' && (
            <button onClick={() => setShowLeaderboard(true)} style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', background: 'none', color: '#aaa', border: '1px solid #eee', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              🏆 Voir le classement
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---- ÉCRAN RÉSULTAT ----
  if (gameState === 'result') {
    const pct = resultats.length > 0 ? Math.round((correctCount / resultats.length) * 100) : 0
    return (
      <div style={{ maxWidth: '600px' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '1.8rem', marginBottom: '0.25rem', textAlign: 'center' }}>Exercice terminé !</h2>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f' }}>{score} pts</div>
          <div style={{ color: '#888', fontSize: '0.9rem' }}>{correctCount}/{resultats.length} correctes · {pct}%</div>
          <div style={{ color: '#e9c46a', fontWeight: 'bold', marginTop: '0.25rem' }}>+{digoosEarned} <Delta size={20} /> gagnés</div>
        </div>

        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
          {resultats.map((r, i) => (
            <div key={i} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <div>{renderPhrase(r.phrase, r.mot, r.correct)}</div>
              {!r.correct && (
                <div style={{ color: '#e63946', fontSize: '0.8rem', marginTop: '0.1rem' }}>
                  Ta réponse : <em>{r.donnee}</em>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={() => { setGameState('select'); setQueue([]) }}
            style={{ padding: '0.75rem 2rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >Changer de liste</button>
          <button onClick={genererQuestions}
            style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >Recommencer</button>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN JEU ----
  const listName = lists.find(l => l.id === selectedList)?.name ?? ''

  return (
    <>
    {showHighscore && (
      <HighscoreModal
        exercise="vocabulaire"
        listId={selectedList}
        listName={listName}
        score={score}
        onClose={() => { setShowHighscore(false); setGameState('result') }}
        onDisable={() => { setShowHighscore(false); setGameState('result') }}
        onReplay={() => { setShowHighscore(false); genererQuestions() }}
        onQuit={() => { setShowHighscore(false); setGameState('select'); setQueue([]) }}
      />
    )}
    {showLeaderboard && (
      <HighscoreModal
        exercise="vocabulaire"
        listId={selectedList}
        listName={listName}
        score={0}
        initialPhase="leaderboard"
        onClose={() => setShowLeaderboard(false)}
        onDisable={() => setShowLeaderboard(false)}
        onReplay={() => { setShowLeaderboard(false); genererQuestions() }}
        onQuit={() => setShowLeaderboard(false)}
      />
    )}
    <div style={{ maxWidth: '520px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: '#888' }}>
            Question {questionNum} / {totalQ}
            {streak >= 3 && <span style={{ color: '#e9c46a', marginLeft: '0.5rem' }}>🔥 {streak}</span>}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#aaa' }}>
            {motsRestants} mot{motsRestants > 1 ? 's' : ''} à maîtriser
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#e9c46a', fontWeight: 'bold' }}>
          {score} pts · +{digoosEarned} <Delta size={20} />
        </div>
      </div>

      <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div className="progress-bar" style={{ width: `${((questionNum - 1) / totalQ) * 100}%`, background: '#2a9d8f', height: '100%', borderRadius: '1rem' }} />
      </div>

      {q && (
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#2a9d8f', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            Quel est le mot manquant ?
          </div>
          <div style={{ fontSize: '1.2rem', color: '#333', lineHeight: '1.8' }}>
            {feedback
              ? renderPhrase(q.phrase, q.mot, feedback.correct)
              : renderPhrase(q.phrase)
            }
          </div>
        </div>
      )}

      {q && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button
            onClick={() => speak(q.mot, 'fr-FR')}
            style={{ padding: '0.3rem 0.75rem', background: 'var(--color-border)', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            🔊 Écouter le mot
          </button>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={reponse}
          onChange={e => setReponse(e.target.value)}
          onKeyDown={handleKey}
          disabled={!!feedback}
          placeholder="Écris le mot manquant..."
          autoFocus
          style={{
            width: '100%', padding: '0.85rem 1rem',
            border: feedback ? `2px solid ${feedback.correct ? '#2a9d8f' : '#e63946'}` : '2px solid var(--color-border)',
            borderRadius: '0.75rem', fontSize: '1.1rem',
            outline: 'none', boxSizing: 'border-box',
            background: feedback ? (feedback.correct ? 'var(--color-background)' : '#fff5f5') : 'white',
            transition: 'border 0.2s',
          }}
        />
      </div>

      {feedback && (
        <div style={{
          textAlign: 'center', padding: '0.75rem', borderRadius: '0.75rem',
          background: feedback.correct ? 'var(--color-background)' : '#fff5f5',
          marginBottom: '1rem', fontSize: '1rem', fontWeight: 'bold',
          color: feedback.correct ? '#2a9d8f' : '#e63946',
        }}>
          {feedback.correct
            ? <span>✓ Correct !{streak >= 3 ? ' 🔥' : ''}</span>
            : <span>✗ Réponse : <strong>{q?.mot}</strong> — on réessaie !</span>
          }
        </div>
      )}

      <button
        onClick={feedback ? suivant : valider}
        disabled={!reponse.trim() && !feedback}
        style={{
          width: '100%', padding: '0.85rem',
          background: (reponse.trim() || feedback) ? '#2a9d8f' : '#ccc',
          color: 'white', border: 'none', borderRadius: '0.75rem',
          cursor: (reponse.trim() || feedback) ? 'pointer' : 'default',
          fontSize: '1rem', fontWeight: 'bold',
        }}
      >
        {feedback ? (isLastRound ? 'Voir les résultats →' : 'Suivant →') : 'Valider'}
      </button>

      <div style={{ marginTop: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#ccc' }}>
        Entrée pour valider · Entrée pour passer
      </div>
    </div>
    </>
  )
}
