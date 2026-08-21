import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'
import { speak as speakWithLang } from '../lib/speech'
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

const TOTAL_WORDS = 15

const LANG_VOICE_MAP: Record<string, string> = {
  'Anglais': 'en-GB', 'Allemand': 'de-DE', 'Grec': 'el-GR',
  'Arabe': 'ar-DZ', 'Italien': 'it-IT', 'Espagnol': 'es-ES', 'Français': 'fr-FR',
}

export default function Spelling() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [direction, setDirection] = useState<'foreign' | 'french'>('foreign')
  const [words, setWords] = useState<WordItem[]>([])
  const [listLanguage, setListLanguage] = useState('')

  const [queue, setQueue] = useState<WordItem[]>([])
  const [failedWords, setFailedWords] = useState<WordItem[]>([])
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'perfect' | 'ok' | 'wrong'; correction: string; hasCase: boolean; hasPunct: boolean } | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [fireMode, setFireMode] = useState<null | 'small' | 'big'>(null)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [isReviewPhase, setIsReviewPhase] = useState(false)
  const [showHighscore, setShowHighscore] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const [usedListen, setUsedListen] = useState(false)
  const [usedLetterCount, setUsedLetterCount] = useState(false)
  const [usedFirstLetter, setUsedFirstLetter] = useState(false)
  const [showLetterCount, setShowLetterCount] = useState(false)
  const [showFirstLetter, setShowFirstLetter] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchLists() }, [])

  const fetchLists = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('word_lists').select('id, name, language, list_type').eq('user_id', user.id).eq('list_type', 'vocabulaire').order('name')
    if (data) setLists(data)
  }

  const fetchWords = async (listId: string) => {
    const { data } = await supabase.from('word_items').select('*').eq('list_id', listId)
    if (data) setWords(data.filter(w => w.source_word && w.target_word))
  }

  const buildQueue = (wordPool: WordItem[]) => {
    const q: WordItem[] = []
    for (let i = 0; i < TOTAL_WORDS; i++) {
      q.push(wordPool[Math.floor(Math.random() * wordPool.length)])
    }
    return q
  }

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
    setInput('')
    setFeedback(null)
    setUsedListen(false)
    setUsedLetterCount(false)
    setUsedFirstLetter(false)
    setShowLetterCount(false)
    setShowFirstLetter(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [currentWord, queue, gameState])

  const getTargetWord = useCallback((word: WordItem) => {
    return direction === 'foreign' ? word.target_word : word.source_word
  }, [direction])

  const getSourceWord = useCallback((word: WordItem) => {
    return direction === 'foreign' ? word.source_word : word.target_word
  }, [direction])

  const getLetterHint = (word: string) => {
    return word.split(' ').map(w => w.split('').map(() => '_').join(' ')).join('   ')
  }

  const getFirstLetterHint = (word: string) => {
    return word.split(' ').map(w => w[0] + w.slice(1).split('').map(() => '_').join(' ')).join('   ')
  }

  const getVoiceForWord = (isSourceWord: boolean): string => {
    if (!listLanguage || listLanguage === 'Français') return 'fr-FR'
    const isForeignWord =
      (direction === 'foreign' && isSourceWord) ||
      (direction === 'french' && !isSourceWord)
    return isForeignWord ? (LANG_VOICE_MAP[listLanguage] || 'fr-FR') : 'fr-FR'
  }

  const shouldShowSpeaker = (isSourceWord: boolean): boolean => {
    if (!listLanguage || listLanguage === 'Français') return false
    return (direction === 'foreign' && isSourceWord) ||
           (direction === 'french' && !isSourceWord)
  }

  const speak = (text: string, lang: string) => {
    speakWithLang(text, lang)
    setUsedListen(true)
  }

  // Normalise pour comparaison tolérante (majuscules + ponctuation)
  const normalize = (s: string) => s.toLowerCase().replace(/[.,;:!?'"()\-]/g, '').trim()

  const countErrors = (answer: string, correct: string) => {
    // Vérifier différences de casse/ponctuation uniquement
    const normAnswer = normalize(answer)
    const normCorrect = normalize(correct)
    if (normAnswer === normCorrect) return 0 // identique après normalisation

    // Compter les vraies erreurs (sur les versions normalisées)
    if (normAnswer === normCorrect) return 0
    let errors = Math.abs(normAnswer.length - normCorrect.length)
    const minLen = Math.min(normAnswer.length, normCorrect.length)
    for (let i = 0; i < minLen; i++) {
      if (normAnswer[i] !== normCorrect[i]) errors++
    }
    return errors
  }

  const hasCaseDiff = (answer: string, correct: string) => {
    return answer.toLowerCase() === correct.toLowerCase() && answer !== correct
  }

  const hasPunctDiff = (answer: string, correct: string) => {
    return normalize(answer) === normalize(correct) && answer !== correct
  }

  const calculatePoints = (errorCount: number) => {
    const hasAid = usedListen || usedLetterCount || usedFirstLetter
    if (errorCount === 0) {
      if (!hasAid) return 20
      if (usedFirstLetter) return 12
      if (usedLetterCount) return 15
      if (usedListen) return 10
    }
    if (errorCount === 1) {
      return hasAid ? 5 : 8
    }
    return 0
  }

  const handleValidate = useCallback(() => {
    if (!currentWord || feedback) return
    const correct = getTargetWord(currentWord)
    const errorCount = countErrors(input.trim(), correct)
    const caseDiff = hasCaseDiff(input.trim(), correct)
    const punctDiff = hasPunctDiff(input.trim(), correct)

    let type: 'perfect' | 'ok' | 'wrong'
    if (errorCount === 0) type = 'perfect'
    else if (errorCount === 1) type = 'ok'
    else type = 'wrong'

    const points = calculatePoints(errorCount)
    setFeedback({ type, correction: correct, hasCase: caseDiff, hasPunct: punctDiff })

    if (type === 'perfect') {
      const newStreak = streak + 1
      setStreak(newStreak)
      const newFireMode = newStreak >= 10 ? 'big' : newStreak >= 4 ? 'small' : null
      setFireMode(newFireMode)
      setScore(prev => prev + points)
    } else {
      setStreak(0)
      setFireMode(null)
      if (type === 'ok') setScore(prev => prev + points)
      setFailedWords(prev => [...prev, currentWord])
    }

    setWordsCompleted(prev => prev + 1)

    // Scroll vers le feedback
    setTimeout(() => {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)

    // Attendre 3 secondes avant de passer au mot suivant
    setTimeout(() => {
      setCurrentWord(null)
      setFeedback(null)
    }, 3000)
  }, [currentWord, input, feedback, streak, usedListen, usedLetterCount, usedFirstLetter, getTargetWord])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && gameState === 'playing' && !feedback) {
        handleValidate()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleValidate, gameState, feedback])

  const checkHighscore = async (finalScore: number): Promise<boolean> => {
    if (localStorage.getItem('odigo_highscores') === 'off') return false
    if (!selectedList) return false
    const { data } = await supabase
      .from('highscores').select('score')
      .eq('exercise', 'spelling').eq('list_id', selectedList)
      .order('score', { ascending: false }).limit(5)
    if (!data) return false
    if (data.length < 5) return true
    return finalScore > data[data.length - 1].score
  }

  const saveScore = async () => {
    await addDigoos(5 + Math.floor(score / 10))
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: wordsCompleted,
      questions_correct: wordsCompleted - failedWords.length,
      metadata: { exercise: 'spelling' },
    })
    const isTop = await checkHighscore(score)
    if (isTop) setShowHighscore(true)
    else setGameState('result')
  }

  const getFireEmoji = () => {
    if (fireMode === 'big') return '🔥🔥'
    if (fireMode === 'small') return '🔥'
    return ''
  }

  const targetLang = direction === 'foreign' ? 'français' : (listLanguage || 'langue étrangère')

  if (gameState === 'select') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>✍️ Épellation</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '450px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste</label>
            <select
              value={selectedList}
              onChange={e => {
                setSelectedList(e.target.value)
                const l = lists.find(x => x.id === e.target.value)
                if (l) setListLanguage(l.language)
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            >
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name} — {l.language} ({l.list_type})</option>)}
            </select>
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

  if (gameState === 'result') {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '2rem', marginBottom: '0.5rem' }}>Partie terminée !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>{score} pts</div>
        <div style={{ color: '#888', marginBottom: '2rem' }}>{wordsCompleted} mots traités</div>
        <button onClick={() => { setGameState('select'); setWords([]) }} style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}>
          Retour
        </button>
      </div>
    )
  }

  const listName = lists.find(l => l.id === selectedList)?.name || ''

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 'bold', color: '#2a9d8f', fontSize: '1.2rem' }}>
          {score} pts {getFireEmoji()}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#888' }}>
          {streak > 0 && <span style={{ color: fireMode ? '#e9c46a' : '#2a9d8f', marginRight: '0.5rem' }}>série : {streak}</span>}
          {wordsCompleted}/{totalWords}
          {isReviewPhase && <span style={{ color: '#e63946', marginLeft: '0.3rem' }}>révision</span>}
        </div>
      </div>

      {currentWord && (
        <div>
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
            Écris la traduction en <strong style={{ color: '#2a9d8f' }}>{targetLang}</strong>
          </div>

          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
              {getSourceWord(currentWord)}
            </span>
            {shouldShowSpeaker(true) && (
              <button
                onClick={() => speakWithLang(getSourceWord(currentWord), getVoiceForWord(true))}
                style={{ padding: '0.3rem 0.75rem', background: 'var(--color-border)', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                🔊 Écouter
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
            {shouldShowSpeaker(false) && (
              <button
                onClick={() => speak(getTargetWord(currentWord), getVoiceForWord(false))}
                style={{ padding: '0.4rem 0.8rem', background: usedListen ? 'var(--color-border)' : 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                🔊 Écouter {usedListen && '(-pts)'}
              </button>
            )}
            <button
              onClick={() => { setShowLetterCount(true); setUsedLetterCount(true) }}
              style={{ padding: '0.4rem 0.8rem', background: usedLetterCount ? 'var(--color-border)' : 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              # Lettres {usedLetterCount && '(-pts)'}
            </button>
            <button
              onClick={() => { setShowFirstLetter(true); setUsedFirstLetter(true) }}
              style={{ padding: '0.4rem 0.8rem', background: usedFirstLetter ? 'var(--color-border)' : 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              A_ 1ère lettre {usedFirstLetter && '(-pts)'}
            </button>
          </div>

          {(showLetterCount || showFirstLetter) && (
            <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem', color: '#2a9d8f', marginBottom: '1rem', letterSpacing: '0.2rem' }}>
              {showFirstLetter
                ? getFirstLetterHint(getTargetWord(currentWord))
                : getLetterHint(getTargetWord(currentWord))
              }
            </div>
          )}

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!!feedback}
            placeholder="Ta réponse..."
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: `2px solid ${feedback ? (feedback.type === 'perfect' ? '#2a9d8f' : feedback.type === 'ok' ? '#e9c46a' : '#e63946') : '#ddd'}`, fontSize: '1rem', boxSizing: 'border-box', marginBottom: '0.75rem', textAlign: 'center' }}
          />

          <button
            onClick={handleValidate}
            disabled={!!feedback || !input.trim()}
            style={{ width: '100%', padding: '0.75rem', background: input.trim() && !feedback ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: input.trim() && !feedback ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}
          >
            Valider
          </button>

          {feedback && (
            <div ref={feedbackRef} style={{ textAlign: 'center', marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', background: feedback.type === 'perfect' ? 'var(--color-background)' : feedback.type === 'ok' ? '#fffbf0' : '#fff5f5' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: feedback.type === 'perfect' ? '#2a9d8f' : feedback.type === 'ok' ? '#e9c46a' : '#e63946' }}>
                {feedback.type === 'perfect' ? `✓ Perfect ! ${getFireEmoji()}` : feedback.type === 'ok' ? '~ OK, presque !' : '✗ Faux'}
              </div>
              {feedback.type !== 'perfect' && (
                <div style={{ color: '#555', marginTop: '0.5rem' }}>
                  Correction : <strong>{feedback.correction}</strong>
                </div>
              )}
              {feedback.type === 'perfect' && (feedback.hasCase || feedback.hasPunct) && (
                <div style={{ color: '#e9c46a', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  ⚠️ Attention aux majuscules / ponctuation : <strong>{feedback.correction}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showHighscore && (
        <HighscoreModal
          exercise="spelling" listId={selectedList} listName={listName} score={score}
          onClose={() => { setShowHighscore(false); setGameState('result') }}
          onDisable={() => { localStorage.setItem('odigo_highscores', 'off'); setShowHighscore(false); setGameState('result') }}
          onReplay={() => { setShowHighscore(false); setGameState('select'); startGame() }}
          onQuit={() => { setShowHighscore(false); setGameState('select') }}
        />
      )}
      {showLeaderboard && (
        <HighscoreModal
          exercise="spelling" listId={selectedList} listName={listName} score={0} initialPhase="leaderboard"
          onClose={() => setShowLeaderboard(false)}
          onDisable={() => { localStorage.setItem('odigo_highscores', 'off'); setShowLeaderboard(false) }}
          onReplay={() => { setShowLeaderboard(false); startGame() }}
          onQuit={() => setShowLeaderboard(false)}
        />
      )}
    </div>
  )
}