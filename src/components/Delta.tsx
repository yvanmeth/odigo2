interface DeltaProps {
  size?: number  // défaut 18
  style?: React.CSSProperties
}

export const Delta = ({ size = 18, style }: DeltaProps) => (
  <img
    src="/delta.svg"
    alt="Δ"
    style={{
      height: size,
      width: size,
      verticalAlign: 'middle',
      display: 'inline-block',
      ...style
    }}
  />
)
