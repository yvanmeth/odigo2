import { useEffect, useState, useCallback } from 'react'
import { Delta } from '../components/Delta'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'

interface WordList {
  id: string
  name: string
}

interface Question {
  verbe: string
  temps: string
  personne: string
  reponses: string[] // toutes les variantes acceptables
}

type GameState = 'select' | 'loading' | 'playing' | 'result'

const TEMPS = [
  { id: 'indicatif présent',          label: 'Indicatif présent' },
  { id: 'indicatif imparfait',        label: 'Indicatif imparfait' },
  { id: 'indicatif futur simple',     label: 'Indicatif futur simple' },
  { id: 'indicatif passé composé',    label: 'Indicatif passé composé' },
  { id: 'indicatif plus-que-parfait', label: 'Ind. plus-que-parfait' },
  { id: 'indicatif passé simple',     label: 'Indicatif passé simple' },
  { id: 'indicatif futur antérieur',  label: 'Ind. futur antérieur' },
  { id: 'conditionnel présent',       label: 'Conditionnel présent' },
  { id: 'conditionnel passé',         label: 'Conditionnel passé' },
  { id: 'subjonctif présent',         label: 'Subjonctif présent' },
  { id: 'subjonctif passé',           label: 'Subjonctif passé' },
  { id: 'impératif présent',          label: 'Impératif présent' },
]

const NB_QUESTIONS = [5, 8, 10, 15]

// Affichage lisible de la personne
const PERSONNE_LABEL: Record<string, string> = {
  'je':        '1ère pers. sing.',
  'tu':        '2è pers. sing.',
  'il/elle':   '3è pers. sing.',
  'nous':      '1ère pers. plu.',
  'vous':      '2è pers. plu.',
  'ils/elles': '3è pers. plu.',
}

// Pronoms attendus par personne
const PRONOMS: Record<string, string[]> = {
  'je':        ['je', "j'"],
  'tu':        ['tu'],
  'il/elle':   ['il', 'elle', 'on'],
  'nous':      ['nous'],
  'vous':      ['vous'],
  'ils/elles': ['ils', 'elles'],
}

const pronominCorrect = (pronomSaisi: string, personneAttendue: string): boolean => {
  const attendus = PRONOMS[personneAttendue] || []
  return attendus.includes(pronomSaisi.toLowerCase().replace(/'/g, "'"))
}

const parseReponse = (input: string): { pronom: string | null; forme: string } => {
  const trimmed = input.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { pronom: null, forme: parts[0] }
  const firstWord = parts[0].toLowerCase().replace(/'/g, "'")
  const allPronoms = Object.values(PRONOMS).flat()
  if (allPronoms.includes(firstWord) || firstWord.endsWith("'")) {
    return { pronom: firstWord, forme: parts.slice(1).join(' ') }
  }
  return { pronom: null, forme: trimmed }
}

interface ValidationResult {
  correct: boolean
  erreurPronom: boolean
  pronomSaisi: string | null
  formeSaisie: string
  reponsesAffichage: string // ex: "suis allé(e)" ou "as mangé"
}

const validerReponse = (input: string, q: Question): ValidationResult => {
  const { pronom, forme } = parseReponse(input)
  const erreurPronom = pronom !== null && !pronominCorrect(pronom, q.personne)

  // La forme saisie correspond-elle à l'une des variantes ?
  const formeOk = q.reponses.some(r => forme.trim() === r.trim())
  const correct = formeOk && !erreurPronom

  // Affichage condensé des variantes : "suis allé(e)(s)"
  const reponsesAffichage = buildReponsesAffichage(q.reponses, q.personne)

  return { correct, erreurPronom, pronomSaisi: pronom, formeSaisie: forme, reponsesAffichage }
}

// Construit un affichage compact des variantes ex: ["suis allé","suis allée"] → "suis allé(e)"
const buildReponsesAffichage = (reponses: string[], personne: string): string => {
  if (reponses.length === 0) return ''
  if (reponses.length === 1) {
    const pronomAttendu = PRONOMS[personne]?.[0] ?? ''
    return pronomAttendu ? `${pronomAttendu} ${reponses[0]}` : reponses[0]
  }
  // Trouver la base commune et les suffixes variables
  const base = reponses[0]
  const pronomAttendu = PRONOMS[personne]?.[0] ?? ''
  const suffixes = reponses.map(r => r.slice(base.length))
  const uniqueSuffixes = [...new Set(suffixes)].filter(s => s !== '')
  const compact = uniqueSuffixes.length > 0
    ? `${base}(${uniqueSuffixes.join('/').replace(/^\(/, '')})`
    : base
  return pronomAttendu ? `${pronomAttendu} ${compact}` : compact
}

export default function Conjugaison() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [nbQ, setNbQ] = useState(8)
  const [tempsChoisis, setTempsChoisis] = useState<string[]>(TEMPS.map(t => t.id)) // tous par défaut
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [reponse, setReponse] = useState('')
  const [feedback, setFeedback] = useState<{
    correct: boolean
    erreurPronom: boolean
    pronomSaisi: string | null
    reponsesAffichage: string
  } | null>(null)
  const [resultats, setResultats] = useState<{
    verbe: string; temps: string; personne: string
    correct: boolean; reponsesAffichage: string; donnee: string
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

  const toggleTemps = (id: string) => {
    setTempsChoisis(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const toggleTous = () => {
    setTempsChoisis(prev =>
      prev.length === TEMPS.length ? [] : TEMPS.map(t => t.id)
    )
  }

  const genererQuestions = async () => {
    if (!selectedList || tempsChoisis.length === 0) return
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

    const prompt = `Tu es un générateur de questions de conjugaison française pour un élève de 11P (16-17 ans, Genève).

Génère exactement ${nbQ} questions à partir de ces verbes : ${verbes.join(', ')}.
Temps à utiliser : ${tempsChoisis.join(', ')}.

Règles :
- Varie les personnes (je, tu, il/elle, nous, vous, ils/elles) — pour l'impératif : tu, nous, vous uniquement
- Varie les temps si plusieurs sont disponibles
- Si moins de verbes que de questions, réutilise certains verbes
- Pour chaque question, fournis TOUTES les formes acceptables dans le tableau "reponses" (sans pronom)
  - Ex passé composé "aller" à "je" : ["suis allé", "suis allée"]
  - Ex passé composé "aller" à "vous" : ["êtes allé", "êtes allée", "êtes allés", "êtes allées"]
  - Ex présent "manger" à "je" : ["mange"] (une seule forme, pas d'accord)
  - Pour les temps composés avec "être", inclure les variantes masculin/féminin/pluriel selon la personne
  - Pour "vous" : inclure singulier et pluriel (allé, allée, allés, allées)
  - Pour "nous" : inclure masculin et féminin (allés, allées)
  - Pour "je/tu" : inclure masculin et féminin (allé, allée)
  - Pour "il" → allé, "elle" → allée, "ils" → allés, "elles" → allées (mais personne = "il/elle" ou "ils/elles")
    → donc inclure les deux genres
- La valeur "personne" doit être l'une de ces valeurs exactes : je, tu, il/elle, nous, vous, ils/elles (ou tu/nous/vous pour l'impératif)

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown :
[{"verbe":"infinitif","temps":"temps exact","personne":"personne","reponses":["forme1","forme2"]}]`

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
      reponsesAffichage: result.reponsesAffichage,
    })
    setResultats(prev => [...prev, {
      verbe: q.verbe,
      temps: q.temps,
      personne: q.personne,
      correct: result.correct,
      reponsesAffichage: result.reponsesAffichage,
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
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: questions.length,
      questions_correct: resultats.filter(r => r.correct).length,
      metadata: { exercise: 'conjugaison' },
    })
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
  const tousCoches = tempsChoisis.length === TEMPS.length

  const buildFeedbackMessage = () => {
    if (!feedback) return null
    if (feedback.correct) {
      return <span>✓ Correct ! <strong>{feedback.reponsesAffichage}</strong>{streak >= 3 ? ' 🔥' : ''}</span>
    }
    if (feedback.erreurPronom && feedback.pronomSaisi) {
      return <span>✗ Pronom incorrect (<em>{feedback.pronomSaisi}</em>) — Réponse : <strong>{feedback.reponsesAffichage}</strong></span>
    }
    return <span>✗ Réponse : <strong>{feedback.reponsesAffichage}</strong></span>
  }

  // ---- ÉCRAN SÉLECTION ----
  if (gameState === 'select' || gameState === 'loading') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>✍️ Conjugaison</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '520px' }}>

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
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Temps <span style={{ color: '#aaa', fontWeight: 'normal' }}>({tempsChoisis.length}/{TEMPS.length} sélectionné{tempsChoisis.length > 1 ? 's' : ''})</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button onClick={toggleTous}
                style={{ padding: '0.4rem 0.8rem', background: tousCoches ? '#2a9d8f' : '#e0f0ee', color: tousCoches ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tousCoches ? 'bold' : 'normal' }}
              >Tous</button>
              {TEMPS.map(t => (
                <button key={t.id} onClick={() => toggleTemps(t.id)}
                  style={{ padding: '0.4rem 0.8rem', background: tempsChoisis.includes(t.id) ? '#2a9d8f' : '#e0f0ee', color: tempsChoisis.includes(t.id) ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tempsChoisis.includes(t.id) ? 'bold' : 'normal' }}
                >{t.label}</button>
              ))}
            </div>
            {tempsChoisis.length === 0 && (
              <p style={{ color: '#e63946', fontSize: '0.82rem', marginTop: '0.4rem' }}>Sélectionne au moins un temps.</p>
            )}
          </div>

          {error && <p style={{ color: '#e63946', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

          <button onClick={genererQuestions} disabled={!selectedList || tempsChoisis.length === 0 || gameState === 'loading'}
            style={{ width: '100%', padding: '0.75rem', background: (selectedList && tempsChoisis.length > 0) ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: (selectedList && tempsChoisis.length > 0) ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}
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
          <div style={{ color: '#e9c46a', fontWeight: 'bold', marginTop: '0.25rem' }}>+{digoosEarned} <Delta size={20} /> gagnés</div>
        </div>

        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
          {resultats.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.85rem', gap: '0.5rem' }}>
              <span style={{ color: '#555', minWidth: '70px' }}><strong>{r.verbe}</strong></span>
              <span style={{ color: '#888', fontSize: '0.78rem', flex: 1 }}>{r.temps} · {PERSONNE_LABEL[r.personne] || r.personne}</span>
              <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold', textAlign: 'right' }}>
                {r.correct ? `✓ ${r.reponsesAffichage}` : `✗ ${r.donnee} → ${r.reponsesAffichage}`}
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
          {score} pts · +{digoosEarned} <Delta size={20} />
        </div>
      </div>

      <div style={{ background: '#e0f0ee', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div className="progress-bar" style={{ width: `${(current / questions.length) * 100}%`, background: '#2a9d8f', height: '100%', borderRadius: '1rem' }} />
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
            {PERSONNE_LABEL[q.personne] || q.personne}
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
