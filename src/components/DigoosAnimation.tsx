import { useState, useEffect, useCallback } from 'react'

interface DigoosAnimationItem {
  id: string
  amount: number
  x: number
  y: number
}

interface DigoosAnimationProps {
  onRef?: (trigger: (amount: number) => void) => void
}

export const DigoosAnimation = ({ onRef }: DigoosAnimationProps) => {
  const [items, setItems] = useState<DigoosAnimationItem[]>([])

  const trigger = useCallback((amount: number) => {
    if (amount <= 0) return

    // Son de pièce
    try {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
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

    // Position aléatoire centrée en bas à droite
    const id = Math.random().toString(36).slice(2)
    const x = window.innerWidth - 120 - Math.random() * 60
    const y = window.innerHeight - 100 - Math.random() * 40

    setItems(prev => [...prev, { id, amount, x, y }])

    setTimeout(() => {
      setItems(prev => prev.filter(i => i.id !== id))
    }, 1500)
  }, [])

  useEffect(() => {
    onRef?.(trigger)
  }, [trigger, onRef])

  return (
    <>
      {items.map(item => (
        <div key={item.id} style={{
          position: 'fixed',
          left: item.x,
          top: item.y,
          zIndex: 9998,
          pointerEvents: 'none',
          animation: 'digoosFloat 1.5s ease-out forwards',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          color: '#e9c46a',
          textShadow: '0 1px 4px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
        }}>
          +{item.amount} Δ
        </div>
      ))}
    </>
  )
}
