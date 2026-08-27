interface HomeGreetingProps {
  greeting: string
}

export default function HomeGreeting({ greeting }: HomeGreetingProps) {
  if (!greeting) return null
  return (
    <div style={{
      background: 'var(--color-card)',
      borderRadius: '1rem',
      padding: '1.25rem 1.5rem',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      borderLeft: '4px solid #2a9d8f',
      fontSize: '1.05rem',
      color: 'var(--color-text)',
      lineHeight: '1.5',
    }}>
      {greeting}
    </div>
  )
}
