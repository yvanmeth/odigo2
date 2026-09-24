import { useEffect, useState, useCallback, useRef } from 'react'
import { Delta } from '../components/Delta'
import { supabase } from '../lib/supabase'
import { addDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'
import { speak } from '../lib/speech'
import ExerciseBilan from '../components/ExerciseBilan'
import { hasRevisionBonusForList } from '../services/revisionBonus'

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
type GameMode = 'normal' | 'libre'

const TOTAL_NORMAL_CARDS = 10

// Fisher-Yates — utilisé uniquement par buildNormalDeck (mode normal),
// distinct du shuffle() existant (Array.sort aléatoire) réservé au mode libre.
const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const buildNormalDeck = (wordPool: WordItem[]): WordItem[] => {
  if (wordPool.length >= TOTAL_NORMAL_CARDS) {
    return shuffleArray(wordPool).slice(0, TOTAL_NORMAL_CARDS)
  }
  // Liste < 10 mots : chaque mot au moins une fois, complément aléatoire jusqu'à 10
  const q: WordItem[] = [...wordPool]
  while (q.length < TOTAL_NORMAL_CARDS) {
    q.push(wordPool[Math.floor(Math.random() * wordPool.length)])
  }
  return shuffleArray(q)
}

const LANG_VOICE_MAP: Record<string, string> = {
  'Anglais': 'en-GB', 'Allemand': 'de-DE', 'Grec': 'el-GR',
  'Arabe': 'ar-DZ', 'Italien': 'it-IT', 'Espagnol': 'es-ES', 'Français': 'fr-FR',
}

// --- Sons Web Audio ---
const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.type = 'triangle'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.setValueAtTime(1175, ctx.currentTime + 0.06)
    g.gain.setValueAtTime(0.1, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    o.start(); o.stop(ctx.currentTime + 0.25)
  } catch { /* silencieux */ }
}

const playFailSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const freqs = [350, 280]
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx.currentTime + i * 0.13
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.25, t + 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      o.start(t); o.stop(t + 0.22)
    })
  } catch { /* silencieux */ }
}

export default function Flashcards() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [lists, setLists] = useState<WordList[]>([])
  const [selectedList, setSelectedList] = useState('')
  const [listName, setListName] = useState('')
  const [listLanguage, setListLanguage] = useState('')
  const [direction, setDirection] = useState<'foreign' | 'french'>('foreign')
  const [mode, setMode] = useState<GameMode>('libre')
  const [words, setWords] = useState<WordItem[]>([])

  // Game state
  const [deck, setDeck] = useState<WordItem[]>([])
  const [currentCard, setCurrentCard] = useState<WordItem | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [totalCards, setTotalCards] = useState(0)
  const [knownCount, setKnownCount] = useState(0)
  const [passCount, setPassCount] = useState(0)
  const [cardAttempts, setCardAttempts] = useState(0)
  const [digoosEarned, setDigoosEarned] = useState(0)
  const [swipeAnim, setSwipeAnim] = useState<'left' | 'right' | null>(null)

  // Mode normal uniquement — passage unique + une phase de révision
  const [isReviewPhase, setIsReviewPhase] = useState(false)
  const [correctFirstPass, setCorrectFirstPass] = useState(0)
  const [failedCards, setFailedCards] = useState<WordItem[]>([])
  const [resultats, setResultats] = useState<{ mot: string; correct: boolean; isReview: boolean }[]>([])
  const [hasRevisionBonus, setHasRevisionBonus] = useState(false)

  const touchStartX = useRef<number | null>(null)

  const getForeignVoice = (): string => LANG_VOICE_MAP[listLanguage] || 'fr-FR'
  const rectoIsForeign = direction === 'foreign' && listLanguage !== 'Français'
  const versoIsForeign = direction === 'french' && listLanguage !== 'Français'

  useEffect(() => { fetchLists() }, [])

  // Bloquer le scroll clavier pendant le jeu
  useEffect(() => {
    if (gameState !== 'playing') return
    const prevent = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', prevent, { passive: false })
    return () => window.removeEventListener('keydown', prevent)
  }, [gameState])

  // Raccourcis clavier
  useEffect(() => {
    if (gameState !== 'playing') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ')          { e.preventDefault(); handleFlip() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleKnown() }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); handleUnknown() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameState, isFlipped, currentCard, deck, cardAttempts])

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

  const shuffle = (arr: WordItem[]) => [...arr].sort(() => Math.random() - 0.5)

  const startGame = async () => {
    if (!selectedList) return
    if (mode === 'normal') {
      const [revBonus] = await Promise.all([
        hasRevisionBonusForList(selectedList),
        fetchWords(selectedList),
      ])
      setHasRevisionBonus(revBonus)
    } else {
      await fetchWords(selectedList)
    }
  }

  useEffect(() => {
    if (words.length > 0 && gameState === 'select') {
      setKnownCount(0)
      setPassCount(0)
      setDigoosEarned(0)
      setIsFlipped(false)
      setCardAttempts(0)

      if (mode === 'normal') {
        const normalDeck = buildNormalDeck(words)
        setDeck(normalDeck.slice(1))
        setCurrentCard(normalDeck[0])
        setTotalCards(TOTAL_NORMAL_CARDS)
        setIsReviewPhase(false)
        setCorrectFirstPass(0)
        setFailedCards([])
        setResultats([])
      } else {
        const shuffled = shuffle(words)
        setDeck(shuffled.slice(1))
        setCurrentCard(shuffled[0])
        setTotalCards(words.length)
      }

      setGameState('playing')
    }
  }, [words, mode])

  const handleFlip = useCallback(() => {
    if (!currentCard) return
    setIsFlipped(prev => !prev)
  }, [currentCard])

  const nextCard = useCallback((known: boolean) => {
    if (!currentCard) return

    if (mode === 'libre') {
      // ---- Mode libre : comportement actuel, strictement inchangé ----
      const isFirstAttempt = cardAttempts === 0
      let digoos = 0

      if (known) {
        digoos = isFirstAttempt ? 2 : 1
        playSuccessSound()
      } else {
        playFailSound()
      }

      setDigoosEarned(prev => prev + digoos)
      setPassCount(prev => prev + 1)
      setSwipeAnim(known ? 'right' : 'left')

      setTimeout(() => {
        setSwipeAnim(null)
        setIsFlipped(false)
        setCardAttempts(0)

        if (known) {
          setKnownCount(prev => prev + 1)
          const next = deck[0] ?? null
          setDeck(prev => prev.slice(1))
          setCurrentCard(next)
        } else {
          const remaining = [...deck, currentCard]
          const reshuffled = shuffle(remaining)
          setCurrentCard(reshuffled[0])
          setDeck(reshuffled.slice(1))
        }
      }, 350)
      return
    }

    // ---- Mode normal : passage linéaire, une seule phase de révision ----
    if (known) playSuccessSound()
    else playFailSound()

    const mot = direction === 'foreign' ? currentCard.source_word : currentCard.target_word
    setResultats(prev => [...prev, { mot, correct: known, isReview: isReviewPhase }])

    if (known && !isReviewPhase) setCorrectFirstPass(prev => prev + 1)
    if (!known) setFailedCards(prev => [...prev, currentCard])

    setPassCount(prev => prev + 1)
    setSwipeAnim(known ? 'right' : 'left')

    setTimeout(() => {
      setSwipeAnim(null)
      setIsFlipped(false)
      setCardAttempts(0)
      if (known) setKnownCount(prev => prev + 1)
      const next = deck[0] ?? null
      setDeck(prev => prev.slice(1))
      setCurrentCard(next)
    }, 350)
  }, [currentCard, deck, cardAttempts, mode, isReviewPhase, direction])

  const handleKnown = useCallback(() => {
    if (!currentCard || swipeAnim) return
    nextCard(true)
  }, [currentCard, swipeAnim, nextCard])

  const handleUnknown = useCallback(() => {
    if (!currentCard || swipeAnim) return
    setCardAttempts(prev => prev + 1)
    nextCard(false)
  }, [currentCard, swipeAnim, nextCard])

  // Fin de session / passage en révision (mode normal)
  useEffect(() => {
    if (gameState !== 'playing') return
    if (currentCard) return

    if (mode === 'libre') {
      if (knownCount > 0) saveScore()
      return
    }

    // Mode normal : une seule passe de révision pour les cartes ratées au 1er passage
    if (failedCards.length > 0 && !isReviewPhase) {
      setIsReviewPhase(true)
      setCurrentCard(failedCards[0])
      setDeck(failedCards.slice(1))
      setFailedCards([])
      return
    }
    if (passCount > 0) saveScore()
  }, [currentCard, gameState, knownCount, mode, failedCards, isReviewPhase, passCount])

  const saveScore = async () => {
    if (mode === 'libre') {
      await addDigoos(digoosEarned, 'exercise', 'Flashcards')
      await logActivity({
        action_type: 'exercise_completed',
        questions_total: totalCards,
        questions_correct: knownCount,
        metadata: { exercise: 'flashcards' },
      })
      setGameState('result')
      return
    }

    // Mode normal
    await logActivity({
      action_type: 'exercise_completed',
      questions_total: TOTAL_NORMAL_CARDS,
      questions_correct: correctFirstPass,
      metadata: { exercise: 'flashcards', mode: 'normal' },
    })
    setGameState('result')
  }

  // Touch / swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) { handleFlip(); return }
    if (dx > 50) handleKnown()
    else if (dx < -50) handleUnknown()
  }

  const displayFront = (card: WordItem) =>
    direction === 'foreign' ? card.source_word : card.target_word

  const displayBack = (card: WordItem) =>
    direction === 'foreign' ? card.target_word : card.source_word

  // ---- ÉCRAN SÉLECTION ----
  if (gameState === 'select') {
    return (
      <div>
        <h2 style={{ color: '#2a9d8f', marginBottom: '1.5rem' }}>🃏 Flashcards</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '450px' }}>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Liste</label>
            <select
              value={selectedList}
              onChange={e => { setSelectedList(e.target.value); const l = lists.find(x => x.id === e.target.value); if (l) { setListLanguage(l.language); setListName(l.name) } }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '0.5rem', border: '1px solid #ddd', fontSize: '0.9rem' }}
            >
              <option value="">-- Sélectionner --</option>
              {lists.map(l => <option key={l.id} value={l.id}>{l.name} — {l.language} ({l.list_type})</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Direction</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setDirection('foreign')}
                style={{ flex: 1, padding: '0.6rem', background: direction === 'foreign' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'foreign' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {listLanguage || 'Langue'} → Français
              </button>
              <button
                onClick={() => setDirection('french')}
                style={{ flex: 1, padding: '0.6rem', background: direction === 'french' ? '#2a9d8f' : 'var(--color-border)', color: direction === 'french' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Français → {listLanguage || 'Langue'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Mode</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setMode('normal')}
                style={{ flex: 1, padding: '0.6rem', background: mode === 'normal' ? '#2a9d8f' : 'var(--color-border)', color: mode === 'normal' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Normal
              </button>
              <button
                onClick={() => setMode('libre')}
                style={{ flex: 1, padding: '0.6rem', background: mode === 'libre' ? '#2a9d8f' : 'var(--color-border)', color: mode === 'libre' ? 'white' : '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Libre
              </button>
            </div>
          </div>

          <button
            onClick={startGame}
            disabled={!selectedList}
            style={{ width: '100%', padding: '0.75rem', background: selectedList ? '#2a9d8f' : '#ccc', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: selectedList ? 'pointer' : 'default', fontSize: '1rem', fontWeight: 'bold' }}
          >
            🚀 Jouer
          </button>

          <div style={{ marginTop: '1rem', background: 'var(--color-background)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.82rem', color: '#555', lineHeight: '1.6' }}>
            <strong style={{ color: '#2a9d8f' }}>Raccourcis clavier</strong><br />
            <span>Espace → retourner la carte</span><br />
            <span>→ su · ← pas su</span>
          </div>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN RÉSULTAT ----
  if (gameState === 'result') {
    if (mode === 'normal') {
      return (
        <div>
          <ExerciseBilan
            exercise="flashcards"
            errors={TOTAL_NORMAL_CARDS - correctFirstPass}
            difficulty="moyen"
            hasRevisionBonus={hasRevisionBonus}
            listName={listName || undefined}
            onDone={() => { setGameState('select'); setWords([]) }}
          />
          <div style={{ maxWidth: '560px', margin: '0 auto', marginTop: '1.5rem', paddingBottom: '2rem' }}>
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.25rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ color: '#2a9d8f', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Récapitulatif</h3>
              {resultats.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', gap: '0.75rem' }}>
                  <span style={{ width: '3.5rem', flexShrink: 0, textAlign: 'center', color: '#aaa', fontSize: r.isReview ? '0.7rem' : '0.8rem', fontWeight: 'bold' }}>
                    {r.isReview ? 'Révision' : i + 1}
                  </span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.85rem' }}>
                    <span style={{ color: '#555' }}><strong>{r.mot}</strong></span>
                    <span style={{ color: r.correct ? '#2a9d8f' : '#e63946', fontWeight: 'bold' }}>
                      {r.correct ? '✓ Su' : '✗ Pas su'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Mode libre — écran actuel, inchangé
    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#2a9d8f', fontSize: '2rem', marginBottom: '0.5rem' }}>Toutes les cartes maîtrisées !</h2>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.25rem' }}>{knownCount} / {totalCards}</div>
        <div style={{ color: '#888', marginBottom: '0.5rem' }}>{passCount} passages au total</div>
        <div style={{ color: '#e9c46a', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '2rem' }}>+{digoosEarned} <Delta size={20} /> gagnés</div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => { setGameState('select'); setWords([]) }}
            style={{ padding: '0.75rem 2rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            Changer de liste
          </button>
          <button
            onClick={() => {
              const shuffled = shuffle(words)
              setDeck(shuffled.slice(1))
              setCurrentCard(shuffled[0])
              setKnownCount(0)
              setPassCount(0)
              setDigoosEarned(0)
              setIsFlipped(false)
              setCardAttempts(0)
              setGameState('playing')
            }}
            style={{ padding: '0.75rem 2rem', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            Recommencer
          </button>
        </div>
      </div>
    )
  }

  // ---- ÉCRAN JEU ----
  const remaining = deck.length + (currentCard ? 1 : 0)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', userSelect: 'none' }}>

      {/* HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.9rem', color: '#888' }}>
          {isReviewPhase
            ? <>Révision · {remaining} carte{remaining > 1 ? 's' : ''} restante{remaining > 1 ? 's' : ''}</>
            : <>{knownCount} sue{knownCount > 1 ? 's' : ''} · {remaining} restante{remaining > 1 ? 's' : ''}</>
          }
        </div>
        {mode === 'libre' && (
          <div style={{ fontSize: '0.85rem', color: '#e9c46a', fontWeight: 'bold' }}>
            +{digoosEarned} <Delta size={20} />
          </div>
        )}
      </div>

      {/* Barre de progression */}
      <div style={{ background: 'var(--color-border)', borderRadius: '1rem', height: '6px', marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div className="progress-bar" style={{
          width: `${totalCards > 0 ? (knownCount / totalCards) * 100 : 0}%`,
          background: '#2a9d8f', height: '100%', borderRadius: '1rem',
        }} />
      </div>

      {/* Carte */}
      {currentCard && (
        <div style={{ perspective: '1000px', marginBottom: '1.5rem' }}>
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleFlip}
            style={{
              position: 'relative', width: '100%', height: '200px',
              transformStyle: 'preserve-3d',
              transition: swipeAnim ? 'transform 0.35s ease, opacity 0.35s ease' : 'transform 0.45s ease',
              transform: swipeAnim === 'right'
                ? 'translateX(120%) rotate(10deg)'
                : swipeAnim === 'left'
                ? 'translateX(-120%) rotate(-10deg)'
                : isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              opacity: swipeAnim ? 0 : 1,
              cursor: 'pointer',
            }}
          >
            {/* Recto */}
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              background: 'white', borderRadius: '1rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '1.5rem', boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: '1rem' }}>
                {displayFront(currentCard)}
              </div>
              {rectoIsForeign && (
                <button
                  onClick={e => { e.stopPropagation(); speak(displayFront(currentCard), getForeignVoice()) }}
                  style={{ padding: '0.3rem 0.75rem', background: 'var(--color-border)', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  🔊 Écouter
                </button>
              )}
              <div style={{ position: 'absolute', bottom: '0.75rem', fontSize: '0.75rem', color: '#ccc' }}>
                Tape ou Espace pour retourner
              </div>
            </div>

            {/* Verso */}
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'var(--color-background)', borderRadius: '1rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '1.5rem', boxSizing: 'border-box',
            }}>
              <div style={{ fontSize: '0.8rem', color: '#2a9d8f', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Traduction
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#2a9d8f', textAlign: 'center', marginBottom: '1rem' }}>
                {displayBack(currentCard)}
              </div>
              {versoIsForeign && (
                <button
                  onClick={e => { e.stopPropagation(); speak(displayBack(currentCard), getForeignVoice()) }}
                  style={{ padding: '0.3rem 0.75rem', background: 'white', color: '#2a9d8f', border: '1px solid #2a9d8f', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  🔊 Écouter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Boutons su / pas su */}
      {currentCard && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleUnknown}
            disabled={!!swipeAnim}
            style={{ flex: 1, padding: '0.9rem', background: 'white', color: '#e63946', border: '2px solid #e63946', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff5f5' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
          >
            ✗ Pas su
          </button>
          <button
            onClick={handleKnown}
            disabled={!!swipeAnim}
            style={{ flex: 1, padding: '0.9rem', background: 'white', color: '#2a9d8f', border: '2px solid #2a9d8f', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-background)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
          >
            ✓ Su
          </button>
        </div>
      )}

      {/* Légende raccourcis */}
      <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: '#ccc' }}>
        ← Pas su &nbsp;·&nbsp; Espace Retourner &nbsp;·&nbsp; → Su
      </div>
    </div>
  )
}
