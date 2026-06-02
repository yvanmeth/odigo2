import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface WordItem {
  id: string
  source_word: string
  target_word: string
}

interface WordList {
  id: string
  name: string
}

type GameState = 'select' | 'playing' | 'result'

const TOTAL_WORDS = 15

const LANG_CODES: Record<string, string> = {
  'Français': 'fr-FR',
  'Anglais': 'en-US',
  'Allemand': 'de-DE',
  'Espagnol': 'es-ES',
  'Grec': 'el-GR',
  'Arabe': 'ar-SA',
  'Italien': 'it-IT',
}

export default function Spelling() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedListName, setSelectedListName] = useState('')
  const [direction, setDirection] = useState<'foreign' | 'french'>('foreign')
  const [words, setWords] = useState<WordItem[]>([])
  const [subjectName, setSubjectName] = useState('Anglais')

  // Game state
  const [queue, setQueue] = useState<WordItem[]>([])
  const [failedWords, setFailedWords] = useState<WordItem[]>([])
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'perfect' | 'ok' | 'wrong'; correction: string } | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [fireMode, setFireMode] = useState<null | 'small' | 'big'>(null)
  const [wordsCompleted, setWordsCompleted] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [isReviewPhase, setIsReviewPhase] = useState(false)
  const [highScores, setHighScores] = useState<{ score: number; date: string }[]>([])

  // Aides
  const [usedListen, setUsedListen] = useState(false)
  const [usedLetterCount, setUsedLetterCount] = useState(false)
  const [usedFirstLetter, setUsedFirstLetter] = useState(false)
  const [showLetterCount, setShowLetterCount] = useState(false)
  const [showFirstLetter, setShowFirstLetter] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchLists() }, [])

  const fetchLists = async () => {
    const { data } = await supabase
      .from('word_lists')
      .select('id, name, subjects(name)')
      .order('name')
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
      setGameState('result')
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

  const speak = (text: string) => {
    const lang = direction === 'foreign'
      ? (LANG_CODES[subjectName] || 'en-US')
      : 'fr-FR'
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    speechSynthesis.speak(utterance)
    setUsedListen(true)
  }

  const countErrors = (answer: string, correct: string) => {
    if (answer === correct) return 0
    let errors = Math.abs(answer.length - correct.length)
    const minLen = Math.min(answer.length, correct.length)
    for (let i = 0; i < minLen; i++) {
      if (answer[i] !== correct[i]) errors++
    }
    return errors
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

    let type: 'perfect' | 'ok' | 'wrong'
    if (errorCount === 0) type = 'perfect'
    else if (errorCount === 1) type = 'ok'
    else type = 'wrong'

    const points = calculatePoints(errorCount)
    setFeedback({ type, correction: correct })

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

    setTimeout(() => {
      setCurrentWord(null)
      setFeedback(null)
    }, 1500)
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

  const saveScore = async () => {
    const key = `spelling_scores_${selectedList}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    const newScore = { score, date: new Date().toLocaleDateString('fr-CH') }
    const updated = [...existing, newScore].sort((a, b) => b.score - a.score).slice(0, 10)
    localStorage.setItem(key, JSON.stringify(updated))
    setHighScores(updated)
  }

  const loadHighScores = (listId: string) => {
    const key = `spelling_scores_${listId}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    setHighScores(existing)
  }

  const getFireEmoji = () => {
    if (fireMode === 'big') return '🔥🔥'
    if (fireMode === 'small') return '🔥'
    return ''
  }

  const targetLang = direction === 'foreign' ? 'français' : subjectName

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
                loadHighScores(e.target.value)
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            >
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Matière (pour la prononciation)</label>
            <select value={subjectName} onChange={e => setSubjectName(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}>
              {Object.keys(LANG_CODES).map(lang => <option key={lang} value={lang}>{lang}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Direction</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setDirection('foreign')} style={{ flex: 1, padding: '0.6rem', background: direction === 'foreign' ? '#2a9d8f' : '#e0f0ee', color: direction === 'foreign' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Langue → Français
              </button>
              <button onClick={() => setDirection('french')} style={{ flex: 1, padding: '0.6rem', background: direction === 'french' ? '#2a9d8f' : '#e0f0ee', color: direction === 'french' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                Français → Langue
              </button>
            </div>
          </div>

          <button onClick={startGame} disabled={!selectedList} style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}>
            🚀 Jouer
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

  if (gameState === 'result') {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '2rem', marginBottom: '0.5rem' }}>Partie terminée !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>{score} pts</div>
        <div style={{ color: '#888', marginBottom: '2rem' }}>{wordsCompleted} mots traités</div>

        {highScores.length > 0 && (
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '300px', margin: '0 auto 1.5rem' }}>
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

        <button onClick={() => { setGameState('select'); setWords([]) }} style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}>
          Rejouer
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>

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
      </div>

      {currentWord && (
        <div>
          {/* Indication de langue */}
          <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
            Écris la traduction en <strong style={{ color: '#2a9d8f' }}>{targetLang}</strong>
          </div>

          {/* Mot source */}
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
            {getSourceWord(currentWord)}
          </div>

          {/* Aides */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
            <button
              onClick={() => speak(getTargetWord(currentWord))}
              style={{ padding: '0.4rem 0.8rem', background: usedListen ? '#e0f0ee' : 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              🔊 Écouter {usedListen && '(-pts)'}
            </button>
            <button
              onClick={() => { setShowLetterCount(true); setUsedLetterCount(true) }}
              style={{ padding: '0.4rem 0.8rem', background: usedLetterCount ? '#e0f0ee' : 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              # Lettres {usedLetterCount && '(-pts)'}
            </button>
            <button
              onClick={() => { setShowFirstLetter(true); setUsedFirstLetter(true) }}
              style={{ padding: '0.4rem 0.8rem', background: usedFirstLetter ? '#e0f0ee' : 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              A_ 1ère lettre {usedFirstLetter && '(-pts)'}
            </button>
          </div>

          {/* Indice lettres */}
          {(showLetterCount || showFirstLetter) && (
            <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem', color: '#2a9d8f', marginBottom: '1rem', letterSpacing: '0.2rem' }}>
              {showFirstLetter
                ? getFirstLetterHint(getTargetWord(currentWord))
                : getLetterHint(getTargetWord(currentWord))
              }
            </div>
          )}

          {/* Champ de saisie */}
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

          {/* Feedback */}
          {feedback && (
            <div style={{ textAlign: 'center', marginTop: '1rem', padding: '0.75rem', borderRadius: '0.5rem', background: feedback.type === 'perfect' ? '#f0faf8' : feedback.type === 'ok' ? '#fffbf0' : '#fff5f5' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: feedback.type === 'perfect' ? '#2a9d8f' : feedback.type === 'ok' ? '#e9c46a' : '#e63946' }}>
                {feedback.type === 'perfect' ? `✓ Perfect ! ${getFireEmoji()}` : feedback.type === 'ok' ? '~ OK, presque !' : '✗ Faux'}
              </div>
              {feedback.type !== 'perfect' && (
                <div style={{ color: '#555', marginTop: '0.25rem' }}>
                  Correction : <strong>{feedback.correction}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}