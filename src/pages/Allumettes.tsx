import { useEffect, useRef, useState } from 'react'
import { Delta } from '../components/Delta'
import { supabase } from '../lib/supabase'
import { deductDigoos } from '../services/digoos'
import { logActivity } from '../services/activity'

type GameState = 'select' | 'drawing' | 'playing' | 'result'
type Difficulty = 'easy' | 'medium' | 'hard'
type Turn = 'player' | 'odigo'
type Board = boolean[][]
type Move = { line: number; indices: number[] }

const INITIAL_BOARD: Board = [
  [true],
  [true, true, true],
  [true, true, true, true, true],
  [true, true, true, true, true, true, true],
]

const PRIMARY = '#2a9d8f'
const ACCENT = '#e76f51'

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '😊 Facile',
  medium: '🤔 Moyen',
  hard: '💀 Difficile',
}

const cloneBoard = (board: Board): Board => board.map(line => [...line])

const applyMove = (board: Board, move: Move): Board => {
  const next = cloneBoard(board)
  move.indices.forEach(i => { next[move.line][i] = false })
  return next
}

const totalMatches = (board: Board): number =>
  board.reduce((sum, line) => sum + line.filter(Boolean).length, 0)

const getValidMoves = (board: Board): Move[] => {
  const moves: Move[] = []
  board.forEach((line, lineIndex) => {
    let start = 0
    while (start < line.length) {
      if (!line[start]) { start++; continue }
      let end = start
      while (end < line.length && line[end]) end++
      const groupLength = end - start
      for (let size = 1; size <= 3; size++) {
        for (let offset = 0; offset + size <= groupLength; offset++) {
          moves.push({ line: lineIndex, indices: Array.from({ length: size }, (_, i) => start + offset + i) })
        }
      }
      start = end
    }
  })
  return moves
}

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

const moveEasy = (board: Board): Move => {
  const linesWithMatches = board
    .map((_, index) => index)
    .filter(index => board[index].some(Boolean))
  const lineIndex = pickRandom(linesWithMatches)
  const movesOnLine = getValidMoves(board).filter(move => move.line === lineIndex)
  return pickRandom(movesOnLine)
}

const encodeBoard = (board: Board): string =>
  board.map(line => line.map(b => b ? '1' : '0').join('')).join('|')

const memo = new Map<string, boolean>()
// true = la position est GAGNANTE pour le joueur qui doit jouer

// Détermine si la position actuelle est gagnante pour celui qui doit jouer
// (en supposant jeu parfait des deux côtés)
const isWinningPosition = (board: Board): boolean => {
  const key = encodeBoard(board)
  if (memo.has(key)) return memo.get(key)!

  const moves = getValidMoves(board)

  // Plateau vide (aucun coup possible) : l'adversaire vient de prendre la dernière
  // allumette et perd → la position est GAGNANTE pour le joueur actuel
  if (moves.length === 0) {
    memo.set(key, true)
    return true
  }

  // Cherche s'il existe un coup qui mène l'adversaire dans une position perdante pour lui
  let winning = false
  for (const move of moves) {
    const newBoard = applyMove(board, move)

    // Prendre la dernière allumette = perdre → ignorer ce coup
    if (totalMatches(newBoard) === 0) continue

    // Si la position résultante est perdante pour l'adversaire,
    // alors ce coup est gagnant pour nous
    if (!isWinningPosition(newBoard)) {
      winning = true
      break
    }
  }

  memo.set(key, winning)
  return winning
}

const moveHard = (board: Board): Move => {
  memo.clear() // reset à chaque appel — le plateau change de structure entre 2 manches

  const moves = getValidMoves(board)

  // Chercher un coup qui laisse l'adversaire dans une position perdante
  for (const move of moves) {
    const newBoard = applyMove(board, move)

    // Si ce coup prend la dernière allumette, ne pas le jouer (on perdrait)
    if (totalMatches(newBoard) === 0) continue

    if (!isWinningPosition(newBoard)) {
      return move
    }
  }

  // Aucun coup gagnant trouvé (position perdante quoi qu'on fasse)
  // → jouer un coup qui ne prend pas la dernière allumette si possible
  const safeMoves = moves.filter(move => totalMatches(applyMove(board, move)) > 0)

  return safeMoves.length > 0 ? pickRandom(safeMoves) : pickRandom(moves)
}

const Allumettes = () => {
  const [gameState, setGameState] = useState<GameState>('select')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [board, setBoard] = useState<Board>(() => cloneBoard(INITIAL_BOARD))
  const [turn, setTurn] = useState<Turn>('player')
  const [selection, setSelection] = useState<Move | null>(null)
  const [digoos, setDigoos] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [winner, setWinner] = useState<Turn | null>(null)
  const [drawingPhase, setDrawingPhase] = useState<1 | 2>(1)
  const [firstPlayer, setFirstPlayer] = useState<Turn>('player')
  const [blinkingMove, setBlinkingMove] = useState<Move | null>(null)
  const [blinkVisible, setBlinkVisible] = useState(true)

  const isOptimalTurnRef = useRef(true)

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('progress').select('digoos').eq('user_id', user.id).single()
      setDigoos(data?.digoos || 0)
    }
    fetchBalance()
  }, [])

  const moveMedium = (currentBoard: Board): Move => {
    const useOptimal = isOptimalTurnRef.current
    isOptimalTurnRef.current = !isOptimalTurnRef.current
    return useOptimal ? moveHard(currentBoard) : moveEasy(currentBoard)
  }

  const computeOdigoMove = (currentBoard: Board): Move => {
    if (difficulty === 'easy') return moveEasy(currentBoard)
    if (difficulty === 'hard') return moveHard(currentBoard)
    return moveMedium(currentBoard)
  }

  const animateRemoval = (move: Move, onComplete: () => void) => {
    setBlinkingMove(move)
    setBlinkVisible(true)
    let toggles = 0
    const id = setInterval(() => {
      toggles++
      setBlinkVisible(prev => !prev)
      if (toggles >= 3) {
        clearInterval(id)
        setBlinkingMove(null)
        setBlinkVisible(true)
        onComplete()
      }
    }, 200)
  }

  const endGame = (lastToMove: Turn) => {
    const w: Turn = lastToMove === 'player' ? 'odigo' : 'player'
    setWinner(w)
    setGameState('result')
    logActivity({ action_type: 'exercise_completed', metadata: { exercise: 'allumettes', winner: w } })
  }

  const triggerOdigoTurn = (currentBoard: Board) => {
    setStatusMessage('Odigo réfléchit...')
    setTimeout(() => {
      const move = computeOdigoMove(currentBoard)
      animateRemoval(move, () => {
        const nextBoard = applyMove(currentBoard, move)
        setBoard(nextBoard)
        if (totalMatches(nextBoard) === 0) {
          endGame('odigo')
        } else {
          setTurn('player')
          setStatusMessage('Sélectionne des allumettes')
        }
      })
    }, 800)
  }

  const startDraw = (initialBoard: Board) => {
    setGameState('drawing')
    setDrawingPhase(1)
    setTimeout(() => {
      const first: Turn = Math.random() < 0.5 ? 'player' : 'odigo'
      setFirstPlayer(first)
      setDrawingPhase(2)
      setTimeout(() => {
        setBoard(initialBoard)
        setSelection(null)
        setWinner(null)
        setTurn(first)
        setGameState('playing')
        if (first === 'player') {
          setStatusMessage('Sélectionne des allumettes')
        } else {
          triggerOdigoTurn(initialBoard)
        }
      }, 1200)
    }, 1000)
  }

  const handleStart = async () => {
    if (digoos < 1) return
    await deductDigoos(1)
    setDigoos(prev => Math.max(0, prev - 1))
    isOptimalTurnRef.current = true
    startDraw(cloneBoard(INITIAL_BOARD))
  }

  const handleQuit = () => {
    setGameState('select')
    setBoard(cloneBoard(INITIAL_BOARD))
    setSelection(null)
    setWinner(null)
    setStatusMessage('')
  }

  const handleSelectMatch = (lineIndex: number, matchIndex: number) => {
    if (!board[lineIndex][matchIndex]) return
    setSelection(prev => {
      if (!prev || prev.line !== lineIndex) {
        return { line: lineIndex, indices: [matchIndex] }
      }
      if (prev.indices.includes(matchIndex)) return prev
      if (prev.indices.length >= 3) return prev

      const min = Math.min(...prev.indices)
      const max = Math.max(...prev.indices)
      if (matchIndex === min - 1 || matchIndex === max + 1) {
        return { line: lineIndex, indices: [...prev.indices, matchIndex].sort((a, b) => a - b) }
      }
      return { line: lineIndex, indices: [matchIndex] }
    })
  }

  const handleConfirmMove = () => {
    if (!selection || selection.indices.length === 0) return
    const move = selection
    setSelection(null)
    setStatusMessage('')
    const nextBoard = applyMove(board, move)
    setBoard(nextBoard)
    if (totalMatches(nextBoard) === 0) {
      endGame('player')
    } else {
      setTurn('odigo')
      triggerOdigoTurn(nextBoard)
    }
  }

  const renderMatch = (lineIndex: number, matchIndex: number) => {
    const present = board[lineIndex][matchIndex]
    const isBlinking = blinkingMove?.line === lineIndex && blinkingMove.indices.includes(matchIndex)
    const visible = isBlinking ? blinkVisible : present
    const isSelected = !!selection && selection.line === lineIndex && selection.indices.includes(matchIndex)
    const clickable = present && gameState === 'playing' && turn === 'player'

    return (
      <svg
        key={matchIndex}
        width={20}
        height={50}
        viewBox="0 0 20 50"
        onClick={() => clickable && handleSelectMatch(lineIndex, matchIndex)}
        style={{
          opacity: visible ? 1 : 0,
          pointerEvents: present ? 'auto' : 'none',
          cursor: clickable ? 'pointer' : 'default',
          filter: isSelected ? 'drop-shadow(0 0 4px #e9c46a)' : 'none',
          transform: isSelected ? 'scale(1.1)' : 'scale(1)',
          transition: 'transform 0.15s ease',
        }}
      >
        <rect x={8} y={11} width={4} height={36} rx={2} fill="#8B4513" />
        <ellipse cx={10} cy={9} rx={5} ry={6} fill="#e63946" />
      </svg>
    )
  }

  if (gameState === 'select') {
    return (
      <div>
        <h2 style={{ color: PRIMARY, marginBottom: '1.5rem' }}>⚔️ Jeu des allumettes</h2>
        <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', maxWidth: '420px' }}>
          <h3 style={{ color: '#555', fontSize: '0.95rem', marginBottom: '0.75rem' }}>Règles</h3>
          <ul style={{ color: '#555', fontSize: '0.85rem', lineHeight: 1.6, paddingLeft: '1.2rem', marginBottom: '1.5rem' }}>
            <li>Retire 1, 2 ou 3 allumettes consécutives sur une même ligne</li>
            <li>Les allumettes retirées créent des trous</li>
            <li>Tu dois retirer au moins 1 allumette par tour</li>
            <li>Celui qui retire la dernière allumette perd !</li>
          </ul>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#555', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Difficulté</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['easy', 'medium', 'hard'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    background: difficulty === level ? PRIMARY : 'var(--color-border)',
                    color: difficulty === level ? 'white' : PRIMARY,
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: difficulty === level ? 'bold' : 'normal',
                  }}
                >
                  {DIFFICULTY_LABELS[level]}
                </button>
              ))}
            </div>
          </div>

          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Coût : 1 <Delta size={16} /> · Solde actuel : {digoos} <Delta size={16} />
          </p>

          <button
            onClick={handleStart}
            disabled={digoos < 1}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: digoos >= 1 ? PRIMARY : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: digoos >= 1 ? 'pointer' : 'default',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            🎲 Lancer la partie
          </button>
          {digoos < 1 && (
            <p style={{ color: '#e63946', fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>Digoos insuffisants</p>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'drawing') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: '1rem', textAlign: 'center' }}>
        {drawingPhase === 1 ? (
          <p style={{ fontSize: '1.5rem', color: '#555' }}>🎲 Tirage au sort...</p>
        ) : (
          <p style={{ fontSize: '1.8rem', fontWeight: 'bold', color: firstPlayer === 'player' ? PRIMARY : ACCENT }}>
            {firstPlayer === 'player' ? '🎲 Tu commences !' : '🎲 Odigo commence !'}
          </p>
        )}
      </div>
    )
  }

  if (gameState === 'result') {
    const playerWon = winner === 'player'
    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ color: playerWon ? PRIMARY : ACCENT, fontSize: '1.8rem', marginBottom: '0.5rem' }}>
          {playerWon ? '🎉 Tu as gagné !' : '😔 Odigo a gagné cette fois...'}
        </h2>
        <p style={{ color: '#888', marginBottom: '2rem' }}>
          {playerWon ? 'Odigo a dû retirer la dernière allumette !' : 'Tu as retiré la dernière allumette. Réessaie !'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={handleStart}
            disabled={digoos < 1}
            style={{
              padding: '0.75rem 1.5rem',
              background: digoos >= 1 ? PRIMARY : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: digoos >= 1 ? 'pointer' : 'default',
              fontSize: '0.95rem',
              fontWeight: 'bold',
            }}
          >
            🔄 Rejouer
          </button>
          <button
            onClick={handleQuit}
            style={{ padding: '0.75rem 1.5rem', background: 'var(--color-border)', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.95rem' }}
          >
            Quitter
          </button>
        </div>
      </div>
    )
  }

  const selectedCount = selection?.indices.length || 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h2 style={{ color: turn === 'player' ? PRIMARY : ACCENT, fontSize: '1.3rem', margin: 0 }}>
          {turn === 'player' ? '⚡ Ton tour' : "🤖 Tour d'Odigo"}
        </h2>
        <span style={{ background: 'var(--color-border)', color: PRIMARY, padding: '0.3rem 0.7rem', borderRadius: '1rem', fontSize: '0.8rem' }}>
          {DIFFICULTY_LABELS[difficulty]}
        </span>
      </div>

      <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{statusMessage}</p>

      <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {board.map((line, lineIndex) => (
            <div key={lineIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: '#aaa', fontSize: '0.8rem', minWidth: '1.5rem' }}>L{lineIndex + 1}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {line.map((_, matchIndex) => renderMatch(lineIndex, matchIndex))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {turn === 'player' && (
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleConfirmMove}
            disabled={selectedCount === 0}
            style={{
              padding: '0.6rem 1.5rem',
              background: selectedCount > 0 ? PRIMARY : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: selectedCount > 0 ? 'pointer' : 'default',
              fontSize: '0.9rem',
              fontWeight: 'bold',
            }}
          >
            Retirer ({selectedCount} allumette{selectedCount > 1 ? 's' : ''})
          </button>
          <button
            onClick={() => setSelection(null)}
            style={{ padding: '0.6rem 1.5rem', background: 'var(--color-border)', color: PRIMARY, border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}

export default Allumettes
