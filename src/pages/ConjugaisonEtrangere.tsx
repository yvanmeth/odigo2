import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../services/activity'
import { EmptyState } from '../components/EmptyState'
import HighscoreModal from '../components/HighscoreModal'
import ExerciseBilan from '../components/ExerciseBilan'
import { hasRevisionBonusForList } from '../services/revisionBonus'
import { callClaude } from '../lib/claude'

interface WordList {
  id: string
  name: string
  language: string
}

interface Question {
  verbe: string
  temps: string
  personne: string
  reponses: string[]
}

type GameState = 'select' | 'loading' | 'playing' | 'result' | 'highscore'

const CONJUGAISON_CONFIG: Record<string, { tenses: string[]; pronouns: boolean }> = {
  'Anglais':  { tenses: ['Present simple', 'Past simple', 'Future (will)', 'Present continuous'], pronouns: true },
  'Allemand': { tenses: ['Präsens', 'Präteritum', 'Perfekt', 'Futur I'], pronouns: true },
  'Grec':     { tenses: ['Présent', 'Passé simple (αόριστος)', 'Imparfait (παρατατικός)', 'Futur simple'], pronouns: false },
  'Italien':  { tenses: ['Presente', 'Passato prossimo', 'Imperfetto', 'Futuro semplice'], pronouns: false },
  'Espagnol': { tenses: ['Presente', 'Pretérito indefinido', 'Imperfecto', 'Futuro simple'], pronouns: false },
  'Arabe':    { tenses: ['Présent (المضارع)', 'Passé (الماضي)', 'Futur (المستقبل)'], pronouns: false },
}
const DEFAULT_CONFIG = { tenses: ['Présent', 'Passé', 'Futur'], pronouns: true }

const PRONOUNS = [
  'i ', 'you ', 'he ', 'she ', 'it ', 'we ', 'they ',
  'ich ', 'du ', 'er ', 'sie ', 'es ', 'wir ', 'ihr ',
]

// "ß" et "ss" sont traités comme équivalents (allemand) — sans risque pour les autres
// langues gérées, qui n'utilisent pas "ß". Appliqué aux deux côtés de la comparaison,
// donc symétrique : "aßen" accepte "assen" et inversement.
const normalizeAnswer = (answer: string): string =>
  answer.trim().toLowerCase().replace(/ß/g, 'ss').replace(/\s+/g, ' ')

const matchesExpected = (normalUser: string, normalExpected: string): boolean => {
  if (normalUser === normalExpected) return true

  if (normalExpected.includes('/')) {
    const variants = normalExpected.split('/').map(v => normalizeAnswer(v))
    if (variants.includes(normalUser)) return true
    const formsWithoutPronouns = variants.map(v => {
      for (const p of PRONOUNS) {
        if (v.startsWith(p)) return v.slice(p.length).trim()
      }
      return v
    })
    if (formsWithoutPronouns.includes(normalUser)) return true
  }

  for (const p of PRONOUNS) {
    if (normalExpected.startsWith(p)) {
      if (normalUser === normalExpected.slice(p.length).trim()) return true
    }
  }

  return false
}

const checkAnswer = (userAnswer: string, q: Question): boolean => {
  const normalUser = normalizeAnswer(userAnswer)
  return q.reponses.some(r => matchesExpected(normalUser, normalizeAnswer(r)))
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface GuestProps {
  guestMode?: boolean
  guestListId?: string
  guestLanguage?: string
  onGameEnd?: () => void
}

export default function ConjugaisonEtrangere({ guestMode, guestListId, guestLanguage: initialLanguage, onGameEnd }: GuestProps) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [selectedList, setSelectedList] = useState('')
  const [listLanguage, setListLanguage] = useState('')
  const [listName, setListName] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [reponse, setReponse] = useState('')
  const [feedback, setFeedback] = useState<{ correct: boolean; reponsesAffichage: string } | null>(null)
  const [resultats, setResultats] = useState<{ verbe: string; temps: string; personne: string; correct: boolean; reponsesAffichage: string; donnee: string }[]>([])
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedTenses, setSelectedTenses] = useState<string[]>([])
  const [error, setError] = useState('')
  const [showHighscore, setShowHighscore] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [hasRevisionBonus, setHasRevisionBonus] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (guestMode && guestListId) {
      setSelectedList(guestListId)
      if (initialLanguage) setListLanguage(initialLanguage)
      setLoadingLists(false)
    } else {
      fetchLists()
    }
  }, [])

  useEffect(() => {
    if (listLanguage) {
      const config = CONJUGAISON_CONFIG[listLanguage] || DEFAULT_CONFIG
      setSelectedTenses(config.tenses)
    }
  }, [listLanguage])

  useEffect(() => {
    if (guestMode && selectedList && selectedTenses.length > 0 && gameState === 'select') {
      genererQuestions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenses])

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [current, gameState])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('word_lists').select('id, name, language').eq('user_id', user.id).eq('list_type', 'conjugaison').neq('language', 'Français').order('name')
    if (data) setLists(data)
    setLoadingLists(false)
  }

  const checkHighscore = async (finalScore: number): Promise<boolean> => {
    if (localStorage.getItem('odigo_highscores') === 'off') return false
    if (!selectedList) return false
    const { data } = await supabase
      .from('highscores').select('score')
      .eq('exercise', 'conjugaison-etrangere').eq('list_id', selectedList)
      .order('score', { ascending: false }).limit(5)
    if (!data) return false
    if (data.length < 5) return true
    return finalScore > data[data.length - 1].score
  }

  const genererQuestions = async () => {
    if (!selectedList) return
    setError('')
    setGameState('loading')

    const [revBonus, { data }] = await Promise.all([
      hasRevisionBonusForList(selectedList),
      supabase.from('word_items').select('source_word').eq('list_id', selectedList),
    ])
    setHasRevisionBonus(revBonus)

    const verbes = (data || []).map((w: any) => w.source_word?.trim()).filter(Boolean)

    if (verbes.length === 0) {
      setError('Cette liste ne contient aucun verbe.')
      setGameState('select')
      return
    }

    const config = CONJUGAISON_CONFIG[listLanguage] || DEFAULT_CONFIG
    const tensesStr = selectedTenses.join(', ')
    const pronounInfo = config.pronouns
      ? 'Inclure le pronom sujet dans les "reponses" (ex: ["I go", "he goes"] pour anglais, inclure toutes les personnes).'
      : 'Ne pas inclure de pronom dans "reponses", seulement la forme conjuguée.'

    const prompt = `Tu génères des questions de conjugaison en ${listLanguage} pour un élève de 11 ans (7P, Genève).

Génère exactement 10 questions à partir de ces verbes : ${verbes.join(', ')}.
Temps à utiliser : ${tensesStr}.

Règles :
- Varie les personnes et les temps
- ${pronounInfo}
- Pour chaque question, fournis TOUTES les formes acceptables dans "reponses"
- La valeur "personne" doit être la personne grammaticale dans la langue cible (ex: "I", "you", "he/she" pour anglais; "io", "tu", "lui/lei" pour italien; ou un numéro 1/2/3 + singulier/pluriel si la langue le demande)
- Si la langue n'a pas de pronom obligatoire, "personne" peut être "1ère pers. sing." etc. en français
- IMPORTANT : mélange les questions dans un ordre totalement imprévisible — ne regroupe pas les verbes ensemble, ne suis pas l'ordre des temps.

Réponds UNIQUEMENT en JSON valide :
[{"verbe":"infinitif","temps":"temps","personne":"personne","reponses":["forme1","forme2"]}]`

    try {
      const txt = await callClaude(prompt, 2000)
      const parsed: Question[] = JSON.parse(txt)
      setQuestions(shuffle(parsed))
      setCurrent(0)
      setReponse('')
      setFeedback(null)
      setResultats([])
      setStreak(0)
      setScore(0)
      setGameState('playing')
    } catch {
      setError('Erreur lors de la génération des questions. Vérifie ta connexion et réessaie.')
      setGameState('select')
    }
  }

  const valider = useCallback(() => {
    if (!reponse.trim() || feedback) return
    const q = questions[current]
    const correct = checkAnswer(reponse, q)
    const newStreak = correct ? streak + 1 : 0
    const points = correct ? 10 + (newStreak >= 3 ? 5 : 0) : 0
    setStreak(newStreak)
    setScore(prev => prev + points)
    const reponsesAffichage = q.reponses.join(' / ')
    setFeedback({ correct, reponsesAffichage })
    setResultats(prev => [...prev, { verbe: q.verbe, temps: q.temps, personne: q.personne, correct, reponsesAffichage, donnee: reponse.trim() }])
  }, [reponse, feedback, questions, current, streak])

  const suivant = useCallback(() => {
    if (!feedback) return
    if (current + 1 >= questions.length) {
      // eslint-disable-next-line react-hooks/immutability
      finaliser()
    } else {
      setCurrent(prev => prev + 1)
      setReponse('')
      setFeedback(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, questions.length, feedback])

  const finaliser = async () => {
    if (guestMode) {
      onGameEnd?.()
      return
    }
    setShowHighscore(false)
    setGameState('result')
    const [, isTop] = await Promise.all([
      logActivity({
        action_type: 'exercise_completed',
        questions_total: questions.length,
        questions_correct: resultats.filter(r => r.correct).length,
        metadata: { exercise: 'conjugaison-etrangere', language: listLanguage },
      }),
      checkHighscore(score),
    ])
    setShowHighscore(isTop)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.stopPropagation()
      if (!feedback) valider()
      else suivant()
    }
  }

  // Quand le feedback est affiché, l'input est disabled — Enter ne remonte plus depuis lui.
  // On écoute directement sur document pour que Entrée déclenche "Suivant".
  useEffect(() => {
    if (!feedback) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Enter') suivant() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [feedback, suivant])

  const q = questions[current]
  const correctCount = resultats.filter(r => r.correct).length

  if (gameState === 'select' || gameState === 'loading') {
    if (guestMode) {
      return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Génération des questions...</div>
    }
    if (!loadingLists && lists.length === 0) {
      return (
        <div>
          <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>✍️ Conjugaison — Langues étrangères</h2>
          <EmptyState
            emoji="📝"
            title="Aucune liste de conjugaison"
            subtitle="Crée une liste de type Conjugaison en langue étrangère dans la page Listes de mots."
          />
        </div>
      )
    }

    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>✍️ Conjugaison — Langues étrangères</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '520px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste de verbes</label>
            <select
              value={selectedList}
              onChange={e => {
                setSelectedList(e.target.value)
                const l = lists.find(x => x.id === e.target.value)
                if (l) { setListLanguage(l.language); setListName(l.name) }
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            >
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name} — {l.language}</option>)}
            </select>
          </div>

          {listLanguage && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#888' }}>Temps à pratiquer :</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                {(CONJUGAISON_CONFIG[listLanguage] || DEFAULT_CONFIG).tenses.map(tense => (
                  <button key={tense}
                    onClick={() => setSelectedTenses(prev =>
                      prev.includes(tense) ? prev.filter(t => t !== tense) : [...prev, tense]
                    )}
                    style={{
                      padding: '0.3rem 0.75rem', borderRadius: '1rem',
                      border: '1px solid #2a9d8f',
                      background: selectedTenses.includes(tense) ? '#2a9d8f' : 'white',
                      color: selectedTenses.includes(tense) ? 'white' : '#2a9d8f',
                      cursor: 'pointer', fontSize: '0.8rem',
                    }}
                  >
                    {tense}
                  </button>
                ))}
              </div>
              {selectedTenses.length === 0 && (
                <div style={{ color: '#e63946', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                  Sélectionne au moins un temps
                </div>
              )}
            </div>
          )}

          {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

          <button onClick={genererQuestions} disabled={!selectedList || selectedTenses.length === 0 || gameState === 'loading'}
            style={{ width: '100%', padding: '0.75rem', background: (selectedList && selectedTenses.length > 0) ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: (selectedList && selectedTenses.length > 0) ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}
          >
            {gameState === 'loading' ? '⏳ Génération des questions...' : '🚀 Jouer'}
          </button>

          {selectedList && localStorage.getItem('odigo_highscores') !== 'off' && (
            <button onClick={() => setShowLeaderboard(true)} style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', background: 'none', color: '#aaa', border: '1px solid #eee', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              🏆 Voir le classement
            </button>
          )}
        </div>
        {showLeaderboard && (
          <HighscoreModal
            exercise="conjugaison-etrangere"
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
      </div>
    )
  }

  if (gameState === 'result' && !guestMode) {
    return (
      <div>
        <ExerciseBilan
          exercise="conjugaison-etrangere"
          errors={questions.length - correctCount}
          difficulty="moyen"
          hasRevisionBonus={hasRevisionBonus}
          listName={listName || undefined}
          onDone={() => {
            if (showHighscore) setGameState('highscore')
            else { setGameState('select'); setQuestions([]) }
          }}
        />
        <div style={{ maxWidth: '560px', margin: '0 auto', marginTop: '1.5rem', paddingBottom: '2rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
            {resultats.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem', gap: '0.5rem' }}>
                <span style={{ color: '#555', minWidth: '70px' }}><strong>{r.verbe}</strong></span>
                <span style={{ color: '#888', fontSize: '0.78rem', flex: 1 }}>{r.temps} · {r.personne}</span>
                <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold', textAlign: 'right' }}>
                  {r.correct ? `✓ ${r.reponsesAffichage}` : `✗ ${r.donnee} → ${r.reponsesAffichage}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (gameState === 'highscore') {
    return (
      <HighscoreModal
        exercise="conjugaison-etrangere"
        listId={selectedList}
        listName={listName}
        score={score}
        onClose={() => { setShowHighscore(false); setGameState('select'); setQuestions([]) }}
        onDisable={() => { setShowHighscore(false); setGameState('select'); setQuestions([]) }}
        onReplay={() => { setShowHighscore(false); setGameState('select'); genererQuestions() }}
        onQuit={() => { setShowHighscore(false); setGameState('select'); setQuestions([]) }}
      />
    )
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>
          {current + 1} / {questions.length}
          {streak >= 3 && <span style={{ color: '#e9c46a', marginLeft: '0.5rem' }}>🔥 {streak}</span>}
        </div>
      </div>

      <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div className="progress-bar" style={{ width: `${((current + 1) / questions.length) * 100}%`, background: '#2a9d8f', height: '100%', borderRadius: '1rem' }} />
      </div>

      {q && (
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#2a9d8f', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            {q.temps}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#333', marginBottom: '0.25rem' }}>
            {q.verbe}
          </div>
          <div style={{ fontSize: '1rem', color: '#888' }}>
            {q.personne}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={reponse}
          onChange={e => setReponse(e.target.value)}
          onKeyDown={handleKey}
          disabled={!!feedback}
          placeholder="Forme conjuguée..."
          ref={inputRef}
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
            : <span>✗ Réponse : <strong>{feedback.reponsesAffichage}</strong></span>
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
        {feedback ? (current + 1 >= questions.length ? 'Voir les résultats →' : 'Suivant →') : 'Valider'}
      </button>

      <div style={{ marginTop: '0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#ccc' }}>
        Entrée pour valider · Entrée pour passer
      </div>
    </div>
  )
}
