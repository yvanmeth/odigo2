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
}

interface Question {
  verbe: string
  temps: string
  personne: string
  reponses: string[] // toutes les variantes acceptables
}

type GameState = 'select' | 'loading' | 'playing' | 'result' | 'highscore'

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
  // Cas 1 : premier token est exactement un pronom ("je", "j'", "tu", ...)
  if (allPronoms.includes(firstWord) || firstWord.endsWith("'")) {
    return { pronom: firstWord, forme: parts.slice(1).join(' ') }
  }
  // Cas 2 : pronom contracté collé au verbe — "j'aurai" → pronom "j'", verbe "aurai"
  const apoIdx = firstWord.indexOf("'")
  if (apoIdx !== -1) {
    const candidatePronom = firstWord.slice(0, apoIdx + 1)
    if (allPronoms.includes(candidatePronom) || candidatePronom.endsWith("'")) {
      return { pronom: candidatePronom, forme: [firstWord.slice(apoIdx + 1), ...parts.slice(1)].join(' ') }
    }
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
  const isSubjonctif = q.temps.toLowerCase().includes('subjonctif')
  const isImperatif  = q.temps.toLowerCase().includes('impératif')

  // Strip "que "/"qu'" propre au subjonctif avant parsing
  const cleanInput = isSubjonctif ? input.replace(/^(que\s+|qu')\s*/i, '') : input

  const { pronom, forme: formeRaw } = parseReponse(cleanInput)

  // Strip "!" optionnel à l'impératif
  const forme = isImperatif ? formeRaw.replace(/\s*!$/, '').trim() : formeRaw

  // À l'impératif le pronom est toléré sans pénalité
  const erreurPronom = !isImperatif && pronom !== null && !pronominCorrect(pronom, q.personne)
  const formeOk = q.reponses.some(r => forme.trim() === r.trim())
  const correct  = formeOk && !erreurPronom

  const reponsesAffichage = buildReponsesAffichage(q.reponses, q.personne, q.temps)
  return { correct, erreurPronom, pronomSaisi: pronom, formeSaisie: forme, reponsesAffichage }
}

const longestCommonPrefix = (strs: string[]): string => {
  if (strs.length === 0) return ''
  let prefix = strs[0]
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) prefix = prefix.slice(0, -1)
    if (prefix === '') return ''
  }
  return prefix
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// "je" → "j'" devant voyelle ou h (muet dans la grande majorité des verbes courants)
const contracterJe = (forme: string): string => {
  if (/^[aeéèêëiîïoôuûüyh]/i.test(forme)) return `j'${forme}`
  return `je ${forme}`
}

// Construit un affichage compact ex: ["suis allé","suis allée"] → "je suis allé(e)"
// base = plus long préfixe commun ; suffixes non-vides entre parenthèses
const buildReponsesAffichage = (reponses: string[], personne: string, temps?: string): string => {
  if (reponses.length === 0) return ''
  const isImperatif = temps?.toLowerCase().includes('impératif') ?? false
  const pronomAttendu = isImperatif ? '' : (PRONOMS[personne]?.[0] ?? '')

  const afficherAvecPronom = (forme: string): string => {
    if (!pronomAttendu) return forme
    if (personne === 'je') return contracterJe(forme)
    return `${pronomAttendu} ${forme}`
  }

  if (reponses.length === 1) return afficherAvecPronom(reponses[0])
  const base = longestCommonPrefix(reponses)
  const uniqueSuffixes = [...new Set(reponses.map(r => r.slice(base.length)))].filter(s => s !== '')
  const compact = uniqueSuffixes.length > 0 ? `${base}(${uniqueSuffixes.join('/')})` : base
  return afficherAvecPronom(compact)
}

export default function Conjugaison() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [selectedList, setSelectedList] = useState('')
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
  const [error, setError] = useState('')
  const [showHighscore, setShowHighscore] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [hasRevisionBonus, setHasRevisionBonus] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchLists() }, [])

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100) }, [current, gameState])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('word_lists').select('id, name').eq('user_id', user.id).eq('list_type', 'conjugaison').eq('language', 'Français').order('name')
    if (data) setLists(data)
    setLoadingLists(false)
  }

  const checkHighscore = async (finalScore: number): Promise<boolean> => {
    if (localStorage.getItem('odigo_highscores') === 'off') return false
    if (!selectedList) return false
    const { data } = await supabase
      .from('highscores').select('score')
      .eq('exercise', 'conjugaison').eq('list_id', selectedList)
      .order('score', { ascending: false }).limit(5)
    if (!data) return false
    if (data.length < 5) return true
    return finalScore > data[data.length - 1].score
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

    const [revBonus, { data }] = await Promise.all([
      hasRevisionBonusForList(selectedList),
      supabase.from('word_items').select('source_word').eq('list_id', selectedList),
    ])
    setHasRevisionBonus(revBonus)

    const verbes = (data || [])
      .map((w: any) => w.source_word?.trim())
      .filter(Boolean)

    if (verbes.length === 0) {
      setError('Cette liste ne contient aucun verbe.')
      setGameState('select')
      return
    }

    const prompt = `Tu es un générateur de questions de conjugaison française pour un élève de 11P (16-17 ans, Genève).

Génère exactement 10 questions à partir de ces verbes : ${verbes.join(', ')}.
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
- IMPORTANT : mélange les questions dans un ordre totalement imprévisible — ne regroupe pas les verbes ensemble, ne suis pas l'ordre des temps ni l'ordre grammatical des personnes (1ère, 2e, 3e). L'ordre doit être aléatoire et varié.

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown :
[{"verbe":"infinitif","temps":"temps exact","personne":"personne","reponses":["forme1","forme2"]}]`

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

    setStreak(newStreak)
    setScore(prev => prev + points)
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
    setShowHighscore(false)
    setGameState('result')
    const [, isTop] = await Promise.all([
      logActivity({
        action_type: 'exercise_completed',
        questions_total: questions.length,
        questions_correct: resultats.filter(r => r.correct).length,
        metadata: { exercise: 'conjugaison' },
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
  const tousCoches = tempsChoisis.length === TEMPS.length
  const listName = lists.find(l => l.id === selectedList)?.name ?? ''

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
    if (!loadingLists && lists.length === 0) {
      return (
        <div>
          <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>✍️ Conjugaison</h2>
          <EmptyState
            emoji="📝"
            title="Aucune liste de conjugaison"
            subtitle="Crée une liste de type Conjugaison dans la page Listes de mots pour jouer à cet exercice."
          />
        </div>
      )
    }

    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>✍️ Conjugaison</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '520px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste de verbes</label>
            <select
              value={selectedList}
              onChange={e => setSelectedList(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            >
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              Temps <span style={{ color: '#aaa', fontWeight: 'normal' }}>({tempsChoisis.length}/{TEMPS.length} sélectionné{tempsChoisis.length > 1 ? 's' : ''})</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button onClick={toggleTous}
                style={{ padding: '0.4rem 0.8rem', background: tousCoches ? '#2a9d8f' : 'var(--color-border)', color: tousCoches ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tousCoches ? 'bold' : 'normal' }}
              >Tous</button>
              {TEMPS.map(t => (
                <button key={t.id} onClick={() => toggleTemps(t.id)}
                  style={{ padding: '0.4rem 0.8rem', background: tempsChoisis.includes(t.id) ? '#2a9d8f' : 'var(--color-border)', color: tempsChoisis.includes(t.id) ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tempsChoisis.includes(t.id) ? 'bold' : 'normal' }}
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

          {selectedList && localStorage.getItem('odigo_highscores') !== 'off' && (
            <button onClick={() => setShowLeaderboard(true)} style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', background: 'none', color: '#aaa', border: '1px solid #eee', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              🏆 Voir le classement
            </button>
          )}
        </div>

        {showLeaderboard && (
          <HighscoreModal
            exercise="conjugaison"
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

  // ---- ÉCRAN RÉSULTAT ----
  if (gameState === 'result') {
    return (
      <div>
        <ExerciseBilan
          exercise="conjugaison"
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
                <span style={{ color: '#888', fontSize: '0.78rem', flex: 1 }}>{r.temps} · {PERSONNE_LABEL[r.personne] || r.personne}</span>
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

  // ---- ÉCRAN HIGHSCORE ----
  if (gameState === 'highscore') {
    return (
      <HighscoreModal
        exercise="conjugaison"
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

  // ---- ÉCRAN JEU ----
  return (
    <div style={{ maxWidth: '520px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>
          {current + 1} / {questions.length}
          {streak >= 3 && <span style={{ color: '#e9c46a', marginLeft: '0.5rem' }}>🔥 {streak}</span>}
        </div>
      </div>

      <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
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
