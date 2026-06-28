interface ProgressCircleProps {
  value: number
  max: number
  streak: number
  label: string
  color: string
  size?: number
}

export default function ProgressCircle({ value, max, streak, label, color, size = 96 }: ProgressCircleProps) {
  const center = size / 2
  const radius = size * 0.375
  const strokeWidth = size * (8 / 96)
  const fontSize = size * (22 / 96)
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(value / max, 1))
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x={center} y={center} textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fontWeight="bold" fill="#333"
          style={{ transform: 'rotate(90deg)', transformOrigin: `${center}px ${center}px` }}
        >
          {streak}
        </text>
      </svg>
      <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )
}
