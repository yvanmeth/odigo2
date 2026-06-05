import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'

interface WordList {
  id: string
  name: string
}

interface Question {
  verbe: string
  temps: string
  personne: string
  reponse: string
}

type GameState = 'select' | 'loading' | 'playing' | 'result'

const TEMPS = [
  { id: 'indicatif présent',          label: 'Indicatif présent' },
  { id: 'indicatif imparfait',        label: 'Indicatif imparfait' },
  { id: 'indicatif futur simple',     label: 'Indicatif futur simple' },
  { id: 'indicatif passé composé',    label: 'Indicatif passé composé' },
  { id: 'indicatif plus-que-parfait', label: 'Indicatif plus-que-parfait' },
  { id: 'indicatif passé simple',     label: 'Indicatif passé simple' },
  { id: 'indicatif futur antérieur',  label: 'Indicatif futur antérieur' },
  { id: 'conditionnel présent',       label: 'Conditionnel présent' },
  { id: 'conditionnel passé',         label: 'Conditionnel passé' },
  { id: 'subjonctif présent',         label: 'Subjonctif présent' },
  { id: 'subjonctif passé',           label: 'Subjonctif passé' },
  { id: 'impératif présent',          label: 'Impératif présent' },
]

const NB_QUESTIONS = [5, 8, 10, 15]

// Pronoms attendus par personne (pour validation et affichage)
const PRONOMS: Record<string, string[]> = {
  'je':        ['je', "j'"],
  'tu':        ['tu'],
  'il/elle':   ['il', 'elle', 'on'],
  'nous':      ['nous'],
  'vous':      ['vous'],
  'ils/elles': ['ils', 'elles'],
}

// Extrait le pronom et la forme depuis la saisie
const parseReponse = (input: string): { pronom: string | null; forme: string } => {
  const trimmed = input.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { pronom: null, forme: parts[0] }

  const firstWord = parts[0].toLowerCase().replace(/'/g, "'")
  const allPronoms = Object.values(PRONOMS).flat()
  if (allPronoms.includes(firstWord)) {
    return { pronom: firstWord, forme: parts.slice(1).join(' ') }
  }
  // "j'ai" → pronom = "j'", forme = "ai" si passé composé — gérer la contraction
  if (firstWord.endsWith("'") || firstWord.includes("'")) {
    return { pronom: firstWord, forme: parts.slice(1).join(' ') }
  }
  return { pronom: null, forme: trimmed }
}

// Vérifie si le pronom saisi correspond à la personne attendue
const pronominCorrect = (pronomSaisi: string, personneAttendue: string): boolean => {
  const attendus = PRONOMS[personneAttendue] || []
  return attendus.includes(pronomSaisi.toLowerCase().replace(/'/g, "'"))
}

interface ValidationResult {
  correct: boolean
  erreurPronom: boolean
  pronomSaisi: string | null
  formeSaisie: string
  reponseComplete: string // pronom attendu + forme correcte
}

const validerReponse = (input: string, q: Question): ValidationResult => {
  const { pronom, forme } = parseReponse(input)
  const formeCorrecte = q.reponse.trim()

  // Pronom attendu (premier des synonymes)
  const pronomAttendu = PRONOMS[q.personne]?.[0] ?? ''
  const reponseComplete = q.personne === 'impératif présent' || !pronomAttendu
    ? formeCorrecte
    : `${pronomAttendu} ${formeCorrecte}`

  // Vérification de la forme (stricte, accents compris)
  const formeOk = forme.trim() === formeCorrecte

  // Vérification du pronom s'il a été saisi
  const erreurPronom = pronom !== null && !pronominCorrect(pronom, q.personne)

  const correct = formeOk && !erreurPronom

  return { correct, erreurPronom, pronomSaisi: pronom, formeSaisie: forme, reponseComplete }
}

export default function Conjugaison() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [nbQ, setNbQ] = useState(8)
  const [tempsChoisi, setTempsChoisi] = useState('tous')
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [reponse, setReponse] = useState('')
  const [feedback, setFeedback] = useState<{
    correct: boolean
    erreurPronom: boolean
    pronomSaisi: string | null
    reponseComplete: string
  } | null>(null)
  const [resultats, setResultats] = useState<{
    verbe: string; temps: string; personne: string
    correct: boolean; reponseComplete: string; donnee: string
  }[]>([])
  const [streak, setStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [digoosEarned, setDigoosEarned] = useState(0)
  const [error, setError] = useState('')
  const [highScores, setHighScores] = useState<{ score: number; date: string }[]>([])

  useEffect(() => { fetchLists() }, [])

  const fetchLists = async () => {
    const { data } = await supabase.from('word_lists').select('id, name').order('name')
    if (data) setLists(data)
  }

  const loadHighScores = (listId: string) => {
    const key = `conjugaison_scores_${listId}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    setHighScores(existing)
  }

  const genererQuestions = async () => {
    if (!selectedList) return
    setError('')
    setGameState('loading')

    const { data } = await supabase
      .from('word_items')
      .select('source_word')
      .eq('list_id', selectedList)

    const verbes = (data || [])
      .map((w: any) => w.source_word?.trim())
      .filter(Boolean)

    if (verbes.length === 0) {
      setError('Cette liste ne contient aucun verbe.')
      setGameState('select')
      return
    }

    const tempsList = tempsChoisi === 'tous'
      ? TEMPS.map(t => t.id)
      : [tempsChoisi]

    const prompt = `Tu es un générateur de questions de conjugaison française pour un élève de 11P (16-17 ans, Genève).

Génère exactement ${nbQ} questions à partir de ces verbes : ${verbes.join(', ')}.
Temps à utiliser : ${tempsList.join(', ')}.

Règles :
- Varie les personnes (je, tu, il/elle, nous, vous, ils/elles) — pour l'impératif : tu, nous, vous
- Varie les temps si plusieurs sont disponibles
- Si moins de verbes que de questions, réutilise certains verbes
- La valeur "reponse" doit être UNIQUEMENT la forme conjuguée, sans pronom (ex: "mangeons" et non "nous mangeons")
- La valeur "personne" doit être l'une de ces valeurs exactes : je, tu, il/elle, nous, vous, ils/elles (ou tu/nous/vous pour l'impératif)

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown :
[{"verbe":"infinitif","temps":"temps exact","personne":"personne","reponse":"forme conjuguée sans pronom"}]`

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
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data2 = await res.json()
      const txt = (data2.content?.find((b: any) => b.type === 'text')?.text || '')
        .replace(/```json|```/g, '').trim()
      const parsed: Question[] = JSON.parse(txt)
      setQuestions(parsed)
      setCurrent(0)
      setReponse('')
      setFeedback(null)
      setResultats([])
      setStreak(0)
      setScore(0)
      setDigoosEarned(0)
      setGameState('playing')
    } catch {
      setError("Erreur lors de la génération des questions. Vérifie ta connexion et réessaie.")
      setGameState('select')
    }
  }

  const valider = useCallback(() => {
    if (!reponse.trim() || feedback) return
    const q = questions[current]
    const result = validerReponse(reponse, q)

    const newStreak = result.correct ? streak + 1 : 0
    const points = result.correct ? 10 + (newStreak >= 3 ? 5 : 0) : 0
    const digoos = result.correct ? 1 : 0

    setStreak(newStreak)
    setScore(prev => prev + points)
    setDigoosEarned(prev => prev + digoos)
    setFeedback({
      correct: result.correct,
      erreurPronom: result.erreurPronom,
      pronomSaisi: result.pronomSaisi,
      reponseComplete: result.reponseComplete,
    })
    setResultats(prev => [...prev, {
      verbe: q.verbe,
      temps: q.temps,
      personne: q.personne,
      correct: result.correct,
      reponseComplete: result.reponseComplete,
      donnee: reponse.trim(),
    }])
  }, [reponse, feedback, questions, current, streak])

  const suivant = useCallback(() => {
    if (current + 1 >= questions.length) {
      finaliser()
    } else {
      setCurrent(prev => prev + 1)
      setReponse('')
      setFeedback(null)
    }
  }, [current, questions.length])

  const finaliser = async () => {
    await addDigoos(digoosEarned)
    const key = `conjugaison_scores_${selectedList}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const newEntry = { score, date: new Date().toLocaleDateString('fr-CH') }
    const updated = [...existing, newEntry].sort((a: any, b: any) => b.score - a.score).slice(0, 10)
    localStorage.setItem(key, JSON.stringify(updated))
    setHighScores(updated)
    setGameState('result')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!feedback) valider()
      else suivant()
    }
  }

  const q = questions[current]
  const correctCount = resultats.filter(r => r.correct).length

  const buildFeedbackMessage = () => {
    if (!feedback) return null
    if (feedback.correct) {
      return (
        <span>
          ✓ Correct ! <strong>{feedback.reponseComplete}</strong>
          {streak >= 3 ? ' 🔥' : ''}
        </span>
      )
    }
    if (feedback.erreurPronom && feedback.pronomSaisi) {
      return (
        <span>
          ✗ Pronom incorrect (<em>{feedback.pronomSaisi}</em>) — Réponse : <strong>{feedback.reponseComplete}</strong>
        </span>
      )
    }
    return (
      <span>
        ✗ Réponse : <strong>{feedback.reponseComplete}</strong>
      </span>
    )
  }

  // ---- ÉCRAN SÉLECTION ----
  if (gameState === 'select' || gameState === 'loading') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>✍️ Conjugaison</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '500px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste de verbes</label>
            <select
              value={selectedList}
              onChange={e => { setSelectedList(e.target.value); loadHighScores(e.target.value) }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            >
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nombre de questions</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {NB_QUESTIONS.map(n => (
                <button key={n} onClick={() => setNbQ(n)}
                  style={{ flex: 1, padding: '0.6rem', background: nbQ === n ? '#2a9d8f' : '#e0f0ee', color: nbQ === n ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: nbQ === n ? 'bold' : 'normal' }}
                >{n}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Temps</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button onClick={() => setTempsChoisi('tous')}
                style={{ padding: '0.4rem 0.8rem', background: tempsChoisi === 'tous' ? '#2a9d8f' : '#e0f0ee', color: tempsChoisi === 'tous' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tempsChoisi === 'tous' ? 'bold' : 'normal' }}
              >Tous</button>
              {TEMPS.map(t => (
                <button key={t.id} onClick={() => setTempsChoisi(t.id)}
                  style={{ padding: '0.4rem 0.8rem', background: tempsChoisi === t.id ? '#2a9d8f' : '#e0f0ee', color: tempsChoisi === t.id ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tempsChoisi === t.id ? 'bold' : 'normal' }}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

          <button onClick={genererQuestions} disabled={!selectedList || gameState === 'loading'}
            style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}
          >
            {gameState === 'loading' ? '⏳ Génération des questions...' : '🚀 Jouer'}
          </button>

          {highScores.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.5rem' }}>🏆 Meilleurs scores</h3>
              {highScores.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem' }}>
                  <span style={{ color: i === 0 ? '#e9c46a' : '#555' }}>#{i + 1} {i === 0 ? '🥇' : ''}</span>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>{s.score} pts</span>
                  <span style={{ color: '#aaa' }}>{s.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- ÉCRAN RÉSULTAT ----
  if (gameState === 'result') {
    const pct = Math.round((correctCount / questions.length) * 100)
    return (
      <div style={{ maxWidth: '560px' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '1.8rem', marginBottom: '0.25rem', textAlign: 'center' }}>Exercice terminé !</h2>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f' }}>{score} pts</div>
          <div style={{ color: '#888', fontSize: '0.9rem' }}>{correctCount}/{questions.length} correctes · {pct}%</div>
          <div style={{ color: '#e9c46a', fontWeight: 'bold', marginTop: '0.25rem' }}>+{digoosEarned} Digoos gagnés</div>
        </div>

        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
          {resultats.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem', gap: '0.5rem' }}>
              <span style={{ color: '#555', minWidth: '80px' }}><strong>{r.verbe}</strong></span>
              <span style={{ color: '#888', fontSize: '0.8rem', flex: 1 }}>{r.temps} · {r.personne}</span>
              <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
                {r.correct
                  ? `✓ ${r.reponseComplete}`
                  : `✗ ${r.donnee} → ${r.reponseComplete}`}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={() => { setGameState('select'); setQuestions([]) }}
            style={{ padding: '0.75rem 2rem', background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >Changer de liste</button>
          <button onClick={genererQuestions}
            style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >Recommencer</button>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN JEU ----
  return (
    <div style={{ maxWidth: '520px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>
          {current + 1} / {questions.length}
          {streak >= 3 && <span style={{ color: '#e9c46a', marginLeft: '0.5rem' }}>🔥 {streak}</span>}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#e9c46a', fontWeight: 'bold' }}>
          {score} pts · +{digoosEarned} Digoos
        </div>
      </div>

      <div style={{ background: '#e0f0ee', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ width: `${(current / questions.length) * 100}%`, background: '#2a9d8f', height: '100%', borderRadius: '1rem', transition: 'width 0.3s ease' }} />
      </div>

      {q && (
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: '#2a9d8f', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            {q.temps}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#333', marginBottom: '0.25rem' }}>
            {q.verbe}
          </div>
          <div style={{ fontSize: '1.1rem', color: '#888' }}>
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
          placeholder="Forme conjuguée (pronom facultatif)..."
          autoFocus
          style={{
            width: '100%', padding: '0.85rem 1rem',
            border: feedback ? `2px solid ${feedback.correct ? '#2a9d8f' : '#e63946'}` : '2px solid #e0f0ee',
            borderRadius: '0.75rem', fontSize: '1.1rem',
            outline: 'none', boxSizing: 'border-box',
            background: feedback ? (feedback.correct ? '#f0faf8' : '#fff5f5') : 'white',
            transition: 'border 0.2s',
          }}
        />
      </div>

      {feedback && (
        <div style={{
          textAlign: 'center', padding: '0.75rem', borderRadius: '0.75rem',
          background: feedback.correct ? '#f0faf8' : '#fff5f5',
          marginBottom: '1rem', fontSize: '1rem', fontWeight: 'bold',
          color: feedback.correct ? '#2a9d8f' : '#e63946',
        }}>
          {buildFeedbackMessage()}
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
