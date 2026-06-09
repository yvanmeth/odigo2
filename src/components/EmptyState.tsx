interface EmptyStateProps {
  emoji: string
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export const EmptyState = ({ emoji, title, subtitle, actionLabel, onAction }: EmptyStateProps) => (
  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#aaa' }}>
    <div style={{ fontSize: '3rem', marginBottom: '0.75rem', filter: 'grayscale(20%)' }}>
      {emoji}
    </div>
    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#888', marginBottom: '0.4rem' }}>
      {title}
    </div>
    {subtitle && (
      <div style={{
        fontSize: '0.85rem', color: '#bbb', marginBottom: '1rem',
        maxWidth: '260px', margin: '0 auto 1rem', lineHeight: '1.5',
      }}>
        {subtitle}
      </div>
    )}
    {actionLabel && onAction && (
      <button onClick={onAction} style={{
        padding: '0.5rem 1.25rem', background: '#2a9d8f', color: 'white',
        border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
        fontSize: '0.9rem', fontWeight: 'bold',
      }}>
        {actionLabel}
      </button>
    )}
  </div>
)
