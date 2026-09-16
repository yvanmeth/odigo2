import type { CSSProperties } from 'react'

export interface AnalogClockProps {
  hour: number       // 1–12
  minute: number     // 0–59
  size?: number      // diamètre en px, défaut 240
  interactive?: boolean  // réservé pour la logique de drag (étape ultérieure)
  animated?: boolean     // transition 0.6s ease-in-out sur la rotation des aiguilles
  minuteHandColor?: string  // couleur de l'aiguille des minutes, défaut '#e9c46a'
  transitionMs?: number     // durée ms d'une transition linéaire (s'utilise à la place de animated)
  minuteAngle?: number      // angle cumulatif de l'aiguille des minutes (override du calcul interne)
  hourAngle?: number        // angle cumulatif de l'aiguille des heures   (override du calcul interne)
}

export default function AnalogClock({
  hour,
  minute,
  size = 240,
  animated = false,
  minuteHandColor = '#e9c46a',
  transitionMs,
  minuteAngle,
  hourAngle,
}: AnalogClockProps) {
  const cx = size / 2
  const cy = size / 2
  const r  = size * 0.44

  // ── Angles (degrés, 0 = 12h, sens horaire) ─────────────────────────────────
  // Si des angles cumulatifs sont fournis par le parent (ex. mode aiguilles de
  // LireHeure), on les utilise directement — ils garantissent que la CSS
  // interpole toujours dans le bon sens, y compris au passage 359°→0°.
  // Sinon on recalcule l'angle absolu dans [0°, 360°).
  const effectiveMinuteAngle = minuteAngle !== undefined
    ? minuteAngle
    : minute * 6
  // L'aiguille des heures avance de 0.5° par minute (30°/heure ÷ 60 min)
  const effectiveHourAngle = hourAngle !== undefined
    ? hourAngle
    : (hour % 12) * 30 + minute * 0.5

  // ── Longueurs des aiguilles ──────────────────────────────────────────────────
  const hourLen    = r * 0.55
  const hourTail   = r * 0.14
  const minuteLen  = r * 0.80
  const minuteTail = r * 0.14

  // ── Épaisseurs ───────────────────────────────────────────────────────────────
  const hourStroke   = Math.max(3, size * 0.028)
  const minuteStroke = Math.max(2, size * 0.016)

  // ── Rayons pour les repères ──────────────────────────────────────────────────
  const rTickOut    = r * 0.91
  const rTickInMain = r * 0.79   // repères 3 / 6 / 9 / 12
  const rTickInMin  = r * 0.86   // autres heures
  const rNum        = r * 0.65   // centre des chiffres 3, 6, 9, 12

  // ── Helpers de position sur le cadran ───────────────────────────────────────
  const toXY = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) }
  }

  // ── Style d'aiguille avec rotation CSS ──────────────────────────────────────
  const handStyle = (angleDeg: number): CSSProperties => {
    const transition = transitionMs !== undefined
      ? `transform ${transitionMs}ms linear`
      : animated ? 'transform 0.6s ease-in-out' : 'none'
    return {
      transformOrigin: `${cx}px ${cy}px`,
      transform: `rotate(${angleDeg}deg)`,
      transition,
    }
  }

  // ── Repères horaires (12 positions) ─────────────────────────────────────────
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle   = i * 30
    const isMain  = i % 3 === 0                // 0(12), 3(3), 6(6), 9(9)
    const rInner  = isMain ? rTickInMain : rTickInMin
    const outer   = toXY(angle, rTickOut)
    const inner   = toXY(angle, rInner)
    const numPos  = toXY(angle, rNum)
    const label   = i === 0 ? 12 : i
    return { i, angle, outer, inner, numPos, isMain, label }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block' }}
      aria-label={`Horloge : ${hour} heure${hour > 1 ? 's' : ''} ${minute > 0 ? `et ${minute}` : ''}`}
    >
      {/* Fond du cadran */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="#f0faf8"
        stroke="#2a9d8f"
        strokeWidth={Math.max(2, size * 0.016)}
      />

      {/* Repères et chiffres */}
      {ticks.map(({ i, outer, inner, numPos, isMain, label }) => (
        <g key={i}>
          <line
            x1={outer.x} y1={outer.y}
            x2={inner.x} y2={inner.y}
            stroke={isMain ? '#2a9d8f' : '#b2d8d4'}
            strokeWidth={isMain ? Math.max(1.5, size * 0.011) : Math.max(1, size * 0.007)}
            strokeLinecap="round"
          />
          {isMain && (
            <text
              x={numPos.x}
              y={numPos.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(10, size * 0.1)}
              fontWeight="bold"
              fill="#2a9d8f"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {label}
            </text>
          )}
        </g>
      ))}

      {/* Aiguille des heures — plus courte, plus épaisse, couleur teal */}
      <line
        x1={cx}
        y1={cy + hourTail}
        x2={cx}
        y2={cy - hourLen}
        stroke="#2a9d8f"
        strokeWidth={hourStroke}
        strokeLinecap="round"
        style={handStyle(effectiveHourAngle)}
      />

      {/* Aiguille des minutes — plus longue, plus fine */}
      <line
        x1={cx}
        y1={cy + minuteTail}
        x2={cx}
        y2={cy - minuteLen}
        stroke={minuteHandColor}
        strokeWidth={minuteStroke}
        strokeLinecap="round"
        style={handStyle(effectiveMinuteAngle)}
      />

      {/* Pivot central */}
      <circle cx={cx} cy={cy} r={Math.max(3, size * 0.028)} fill="#2a9d8f" />
    </svg>
  )
}
