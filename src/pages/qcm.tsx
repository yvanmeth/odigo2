import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'
import HighscoreModal from '../components/HighscoreModal'

interface WordItem {
  id: string
  source_word: string
  target_word: string
}

interface WordList {
  id: string
  name: string
  language: string
  list_type: string
}

type GameState = 'select' | 'playing' | 'result'
type Mode = 'debutant' | 'avance' | 'expert'

const TOTAL_WORDS = 15
const MODE_CONFIG = {
  debutant: { choices: 2, basePoints: 5, bonusSpeed: 2, label: 'Débutant', emoji: '🌱' },
  avance: { choices: 4, basePoints: 10, bonusSpeed: 5, label: 'Avancé', emoji: '⚡' },
  expert: { choices: 8, basePoints: 20, bonusSpeed: 10, label: 'Expert', emoji: '💎' },
}

const LANG_VOICE_MAP: Record<string, string> = {
  'Anglais': 'en-GB', 'Allemand': 'de-DE', 'Grec': 'el-GR',
  'Arabe': 'ar-DZ', 'Italien': 'it-IT', 'Espagnol': 'es-ES', 'Français': 'fr-FR',
}

const speak = (text: string, lang = 'fr-FR') => {
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  speechSynthesis.speak(utterance)
}


interface GuestProps {
  guestMode?: boolean
  guestListId?: string
  guestLanguage?: string
  onGameEnd?: () => void
  userId?: string
}

export default function QCM({ guestMode, guestListId, guestLanguage, onGameEnd, userId }: GuestProps) {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [mode, setMode] = useState<Mode>('avance')
  const [direction, setDirection] = useState<'foreign' | 'french'>('foreign')
  const [words, setWords] = useState<WordItem[]>([])

  // Game state
  const [queue, setQueue] = useState<WordItem[]>([])
  const [failedWords, setFailedWords] = useState<WordItem[]>([])
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null)
  const [choices, setChoices] = useState<string[]>([])
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [isReviewPhase, setIsReviewPhase] = useState(false)
  const [startTime, setStartTime] = useState(0)
  const [showHighscore, setShowHighscore] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [fireMode, setFireMode] = useState<null | 'small' | 'big'>(null)

  const [listLanguage, setListLanguage] = useState('')

  useEffect(() => {
    if (guestMode && guestListId) {
      setSelectedList(guestListId)
      if (guestLanguage) setListLanguage(guestLanguage)
      fetchWords(guestListId)
    } else {
      fetchLists()
    }
  }, [])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('word_lists').select('id, name, language, list_type').eq('user_id', user.id).eq('list_type', 'vocabulaire').order('name')
    if (data) setLists(data)
  }

  const fetchWords = async (listId: string) => {
    console.log('Loading guest list:', listId)
    const { data, error } = await supabase.from('word_items').select('*').eq('list_id', listId)
    console.log('Guest words result:', data?.length, 'error:', error)
    if (data) setWords(data.filter(w => w.source_word && w.target_word))
  }

  const buildQueue = (wordPool: WordItem[]) => {
    const q: WordItem[] = []
    for (let i = 0; i < TOTAL_WORDS; i++) {
      q.push(wordPool[Math.floor(Math.random() * wordPool.length)])
    }
    return q
  }

  const getChoices = useCallback((correct: WordItem, allWords: WordItem[], numChoices: number) => {
    const correctAnswer = direction === 'foreign' ? correct.target_word : correct.source_word
    const others = allWords
      .filter(w => w.id !== correct.id)
      .map(w => direction === 'foreign' ? w.target_word : w.source_word)
      .filter((v, i, a) => a.indexOf(v) === i && v)
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, numChoices - 1)
    return [correctAnswer, ...shuffled].sort(() => Math.random() - 0.5)
  }, [direction])

  const startGame = async () => {
    if (!selectedList) return
    await fetchWords(selectedList)
  }

  useEffect(() => {
    if (words.length > 0 && gameState === 'select') {
      const q = buildQueue(words)
      setQueue(q)
      setTotalWords(TOTAL_WORDS)
      setScore(0)
      setStreak(0)
      setWordsCompleted(0)
      setFailedWords([])
      setIsReviewPhase(false)
      setFireMode(null)
      setGameState('playing')
    }
  }, [words])

  useEffect(() => {
    if (gameState !== 'playing') return
    if (currentWord) return

    const nextQueue = [...queue]
    const next = nextQueue.shift()
    if (!next) {
      if (failedWords.length > 0 && !isReviewPhase) {
        setIsReviewPhase(true)
        setQueue([...failedWords])
        setTotalWords(prev => prev + failedWords.length)
        setFailedWords([])
        return
      }
      saveScore()
      return
    }
    setQueue(nextQueue)
    setCurrentWord(next)
    setChoices(getChoices(next, words, MODE_CONFIG[mode].choices))
    setFeedback(null)
    setStartTime(Date.now())
  }, [currentWord, queue, gameState])

  const handleAnswer = useCallback((chosen: string) => {
    if (!currentWord || feedback) return
    const config = MODE_CONFIG[mode]
    const correctAnswer = direction === 'foreign' ? currentWord.target_word : currentWord.source_word
    const isCorrect = chosen === correctAnswer
    const elapsed = (Date.now() - startTime) / 1000

    setFeedback({ correct: isCorrect, answer: correctAnswer })

    if (isCorrect) {
      const newStreak = streak + 1
      setStreak(newStreak)

      let points = config.basePoints
      if (elapsed < 3) points += config.bonusSpeed

      const newFireMode = newStreak >= 10 ? 'big' : newStreak >= 4 ? 'small' : null
      setFireMode(newFireMode)

      if (newStreak >= 10) points += 15
      else if (newStreak >= 4) points += 5

      setScore(prev => prev + points)
    } else {
      setStreak(0)
      setFireMode(null)
      setFailedWords(prev => [...prev, currentWord])
    }

    setWordsCompleted(prev => prev + 1)

    setTimeout(() => {
      setCurrentWord(null)
      setFeedback(null)
    }, 1000)
  }, [currentWord, feedback, mode, direction, streak, startTime])

  const checkHighscore = async (finalScore: number): Promise<boolean> => {
    if (localStorage.getItem('odigo_highscores') === 'off') return false
    if (!selectedList) return false
    const { data } = await supabase
      .from('highscores').select('score')
      .eq('exercise', 'qcm').eq('list_id', selectedList)
      .order('score', { ascending: false }).limit(5)
    if (!data) return false
    if (data.length < 5) return true
    return finalScore > data[data.length - 1].score
  }

  const saveScore = async () => {
    if (guestMode) {
      onGameEnd?.()
      return
    }
    await addDigoos(5 + Math.floor(score / 10), 'exercise', userId)
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: wordsCompleted,
      questions_correct: wordsCompleted - failedWords.length,
      metadata: { exercise: 'qcm', mode },
    }, userId)
    const isTop = await checkHighscore(score)
    if (isTop) setShowHighscore(true)
    else setGameState('result')
  }

  const displayWord = currentWord
    ? (direction === 'foreign' ? currentWord.source_word : currentWord.target_word)
    : ''

  const getFireEmoji = () => {
    if (fireMode === 'big') return '🔥🔥'
    if (fireMode === 'small') return '🔥'
    return ''
  }

  if (gameState === 'select') {
    if (guestMode) return <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>Chargement...</div>
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>🧠 QCM</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '450px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste</label>
            <select value={selectedList} onChange={e => { setSelectedList(e.target.value); const l = lists.find(x => x.id === e.target.value); if (l) setListLanguage(l.language) }} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}>
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name} — {l.language} ({l.list_type})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mode</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '0.6rem', background: mode === m ? '#2a9d8f' : 'var(--color-border)', color: mode === m ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  {MODE_CONFIG[m].emoji} {MODE_CONFIG[m].label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Direction</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setDirection('foreign')} style={{ flex: 1, padding: '0.6rem', background: direction === 'foreign' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'foreign' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Langue → Français
              </button>
              <button onClick={() => setDirection('french')} style={{ flex: 1, padding: '0.6rem', background: direction === 'french' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'french' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Français → Langue
              </button>
            </div>
          </div>

          <button onClick={startGame} disabled={!selectedList} style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}>
            🚀 Jouer
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

  if (gameState === 'result' && !guestMode) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '2rem', marginBottom: '0.5rem' }}>Partie terminée !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>{score} pts</div>
        <div style={{ color: '#888', marginBottom: '2rem' }}>{wordsCompleted} mots traités · Mode {MODE_CONFIG[mode].label}</div>
        <button onClick={() => { setGameState('select'); setWords([]) }} style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}>
          Retour
        </button>
      </div>
    )
  }

  const listName = lists.find(l => l.id === selectedList)?.name || ''

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>

      {/* HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 'bold', color: '#2a9d8f', fontSize: '1.2rem' }}>
          {score} pts {getFireEmoji()}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888' }}>
          {streak > 0 && <span style={{ color: fireMode ? '#e9c46a' : '#2a9d8f', marginRight: '0.5rem' }}>série : {streak}</span>}
          {wordsCompleted}/{totalWords}
          {isReviewPhase && <span style={{ color: '#e63946', marginLeft: '0.3rem' }}>révision</span>}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888' }}>{MODE_CONFIG[mode].emoji} {MODE_CONFIG[mode].label}</div>
      </div>

      {/* Mot à traduire */}
      {currentWord && (
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          marginBottom: '1.5rem',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#333',
          minHeight: '100px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}>
          {displayWord}
          {direction === 'foreign' && listLanguage !== 'Français' && !feedback && (
            <button onClick={() => speak(displayWord, LANG_VOICE_MAP[listLanguage] || 'fr-FR')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '0.5rem' }} title="Écouter la prononciation">
              🔊
            </button>
          )}
        </div>
      )}

      {/* Choix */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mode === 'expert' ? 'repeat(4, 1fr)' : mode === 'avance' ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)',
        gap: '0.75rem',
      }}>
        {choices.map((choice, i) => {
          const isCorrect = feedback && choice === feedback.answer
          return (
            <button
              key={i}
              onClick={() => handleAnswer(choice)}
              disabled={!!feedback}
              style={{
                padding: '0.75rem',
                background: feedback
                  ? isCorrect ? '#2a9d8f' : '#f5f5f5'
                  : 'white',
                color: feedback
                  ? isCorrect ? 'white' : '#aaa'
                  : '#333',
                border: `2px solid ${feedback ? (isCorrect ? '#2a9d8f' : '#eee') : 'var(--color-border)'}`,
                borderRadius: '0.75rem',
                cursor: feedback ? 'default' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                transition: 'all 0.15s',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {choice}
            </button>
          )
        })}
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: feedback.correct ? '#2a9d8f' : '#e63946' }}>
          {feedback.correct ? `✓ Correct ! ${getFireEmoji()}` : `✗ Réponse : ${feedback.answer}`}
        </div>
      )}

      {showHighscore && (
        <HighscoreModal
          exercise="qcm" listId={selectedList} listName={listName} score={score}
          onClose={() => { setShowHighscore(false); setGameState('result') }}
          onDisable={() => { localStorage.setItem('odigo_highscores', 'off'); setShowHighscore(false); setGameState('result') }}
          onReplay={() => { setShowHighscore(false); setGameState('select'); startGame() }}
          onQuit={() => { setShowHighscore(false); setGameState('select') }}
        />
      )}
      {showLeaderboard && (
        <HighscoreModal
          exercise="qcm" listId={selectedList} listName={listName} score={0} initialPhase="leaderboard"
          onClose={() => setShowLeaderboard(false)}
          onDisable={() => { localStorage.setItem('odigo_highscores', 'off'); setShowLeaderboard(false) }}
          onReplay={() => { setShowLeaderboard(false); startGame() }}
          onQuit={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  )
}