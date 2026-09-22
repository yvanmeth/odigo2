import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Delta } from './Delta'
import { addDigoos } from '../services/digoos'
import { toDateStr } from '../lib/dates'
import { calcBilan, EXERCISE_LABELS, type Difficulty, type BilanCalcResult } from '../lib/exerciseBilan'

export interface ExerciseBilanProps {
  exercise: string
  errors: number
  difficulty: Difficulty
  hasRevisionBonus: boolean
  onDone: () => void
  subLabel?: string
  listName?: string
  blocksPerfect?: boolean
}

// Animation steps:
// 0 = loading (bilan not yet computed)
// 1 = frame fades in
// 2 = star 1 pops in
// 3 = star 2 pops in
// 4 = star 3 pops in
// 5 = details + button appear
const STAR_COLORS = {
  earned: '#2a9d8f',
  golden: '#e9c46a',
  empty: '#ddd',
}

const playSound = (src: string) => {
  try {
    const audio = new Audio(src)
    audio.volume = 0.6
    audio.play().catch(() => {})
  } catch {
    // sound file absent — silent fail
  }
}

export default function ExerciseBilan({
  exercise,
  errors,
  difficulty,
  hasRevisionBonus,
  onDone,
  subLabel,
  listName,
  blocksPerfect,
}: ExerciseBilanProps) {
  const [step, setStep] = useState(0)
  const [golden, setGolden] = useState(false)
  const [bilan, setBilan] = useState<BilanCalcResult | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const userIdRef = useRef<string | null>(null)
  const committed = useRef(false)

  const schedule = (fn: () => void, delayMs: number) => {
    const id = setTimeout(fn, delayMs)
    timers.current.push(id)
  }

  const startAnimation = (result: BilanCalcResult) => {
    let t = 100
    schedule(() => setStep(1), t)

    t += 400
    schedule(() => {
      setStep(2)
      if (result.stars >= 1) playSound('/sounds/star.mp3')
    }, t)

    t += 600
    schedule(() => {
      setStep(3)
      if (result.stars >= 2) playSound('/sounds/star.mp3')
    }, t)

    t += 600
    schedule(() => {
      setStep(4)
      if (result.stars >= 3) playSound('/sounds/star.mp3')
    }, t)

    if (result.isPerfect) {
      t += 600
      schedule(() => {
        setGolden(true)
        playSound('/sounds/perfect.mp3')
      }, t)
      t += 600
      schedule(() => setStep(5), t)
    } else {
      t += 800
      schedule(() => setStep(5), t)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      userIdRef.current = user?.id ?? null

      let dailySumBefore = 0
      if (user) {
        const today = toDateStr(new Date())
        const [y, m, d] = today.split('-').map(Number)
        const startOfDay = new Date(y, m - 1, d).toISOString()
        const startOfTomorrow = new Date(y, m - 1, d + 1).toISOString()

        const { data: txData } = await supabase
          .from('digoos_transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('source', 'exercise')
          .gte('created_at', startOfDay)
          .lt('created_at', startOfTomorrow)

        if (txData) {
          dailySumBefore = txData.reduce(
            (sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0),
            0,
          )
        }
      }

      const result = calcBilan({ errors, difficulty, hasRevisionBonus, dailySumBefore, blocksPerfect })
      setBilan(result)
      startAnimation(result)
    }

    init()

    const t = timers.current
    return () => { t.forEach(clearTimeout) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderStar = (index: number) => {
    const isVisible = step >= index + 2
    const isEarned = bilan ? index < bilan.stars : false
    let color = STAR_COLORS.empty
    if (isEarned) color = golden ? STAR_COLORS.golden : STAR_COLORS.earned

    return (
      <span
        key={index}
        style={{
          fontSize: '3rem',
          display: 'inline-block',
          transform: isVisible
            ? (isEarned ? 'scale(1)' : 'scale(0.75)')
            : 'scale(0)',
          opacity: isVisible ? 1 : 0,
          color,
          filter: isEarned && golden ? 'drop-shadow(0 0 10px #e9c46a99)' : 'none',
          transition:
            'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease, color 0.5s ease, filter 0.5s ease',
        }}
      >
        ★
      </span>
    )
  }

  if (step === 0 || !bilan) {
    return (
      <div style={{ textAlign: 'center', color: '#aaa', padding: '3rem', fontSize: '0.9rem' }}>
        Calcul en cours…
      </div>
    )
  }

  const handleContinue = () => {
    if (committed.current || !bilan) return
    committed.current = true
    const uid = userIdRef.current
    const label = EXERCISE_LABELS[exercise] ?? exercise
    if (uid) {
      addDigoos(bilan.total, 'exercise', label).catch(() => {})
      supabase.from('exercise_results').insert({
        user_id: uid,
        exercise,
        errors,
        stars: bilan.stars,
        is_perfect: bilan.isPerfect,
        difficulty,
        digoos_earned: bilan.total,
        list_name: listName ?? null,
      }).then(() => {}, () => {})
    }
    onDone()
  }

  const exerciseLabel = subLabel ?? EXERCISE_LABELS[exercise] ?? exercise
  const coeffInfo =
    difficulty === 'facile' ? { label: 'Niveau facile', coeff: '× 0.8' } :
    difficulty === 'difficile' ? { label: 'Niveau difficile', coeff: '× 1.2' } : null

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        opacity: step >= 1 ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '1.5rem',
          padding: '2rem 1.75rem',
          boxShadow: '0 6px 32px rgba(0,0,0,0.12)',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginBottom: '0.25rem' }}>
          Bilan
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#333', marginBottom: '1.25rem' }}>
          {exerciseLabel}
        </div>

        {/* Étoiles */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginBottom: '0.5rem' }}>
          {[0, 1, 2].map(i => renderStar(i))}
        </div>

        {!bilan.isPerfect && (
          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
            {10 - errors} bonne{10 - errors > 1 ? 's' : ''} réponse{10 - errors > 1 ? 's' : ''} sur 10
          </div>
        )}

        {bilan.isPerfect && golden && (
          <div style={{
            fontSize: '0.85rem', fontWeight: 'bold',
            color: '#e9c46a',
            opacity: golden ? 1 : 0,
            transition: 'opacity 0.5s',
            marginBottom: '0.25rem',
          }}>
            ✨ Parfait !
          </div>
        )}

        {/* Détails Δ */}
        <div
          style={{
            opacity: step >= 5 ? 1 : 0,
            transform: step >= 5 ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 0.4s ease, transform 0.4s ease',
            marginTop: '1.5rem',
          }}
        >
          <div style={{
            background: '#f8fffe',
            border: '1px solid #e0f5f2',
            borderRadius: '0.75rem',
            padding: '1rem',
            fontSize: '0.85rem',
            textAlign: 'left',
          }}>
            <div style={{ fontWeight: 'bold', color: '#2a9d8f', marginBottom: '0.6rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Récompenses
            </div>

            <BilanRow label="Base" value={5} />
            {bilan.bonusStars > 0 && (
              <BilanRow label={`Étoiles (×${bilan.stars})`} value={bilan.bonusStars} />
            )}
            {bilan.isPerfect && (
              <BilanRow label="Parfait ✨" value={bilan.bonusPerfect} />
            )}
            {bilan.bonusRevision > 0 && (
              <BilanRow label="Bonus révision 📅" value={bilan.bonusRevision} />
            )}
            {coeffInfo && (
              <>
                <div style={{ borderTop: '1px solid #e0f5f2', marginTop: '0.4rem', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#555', marginBottom: '0.3rem' }}>
                  <span>Sous-total</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#2a9d8f' }}>
                    +{bilan.baseDigoos} <Delta size={13} />
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', marginBottom: '0.3rem' }}>
                  <span>{coeffInfo.label}</span>
                  <span>{coeffInfo.coeff}</span>
                </div>
              </>
            )}

            <div style={{ borderTop: '1px solid #e0f5f2', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#2a9d8f', fontSize: '1rem' }}>
              <span>Total</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                +{bilan.total} <Delta size={16} />
              </span>
            </div>

            {bilan.dailyCapApplied && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#e76f51', background: '#fff5f2', borderRadius: '0.4rem', padding: '0.4rem 0.6rem' }}>
                ⚠️ Plafond quotidien atteint (+{DAILY_CAP_DISPLAY}{' '}<Delta size={12} style={{ verticalAlign: 'middle' }} />) — coefficient ×0.2 appliqué
              </div>
            )}
          </div>

          <button
            onClick={handleContinue}
            style={{
              marginTop: '1.25rem',
              width: '100%',
              padding: '0.75rem',
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              Obtenir les <Delta size={16} />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

const DAILY_CAP_DISPLAY = 2000

function BilanRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: '#555' }}>
      <span>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#2a9d8f', fontWeight: 'bold' }}>
        +{value} <Delta size={13} />
      </span>
    </div>
  )
}
