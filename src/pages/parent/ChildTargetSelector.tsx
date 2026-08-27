interface Child {
  id: string
  first_name: string
}

interface ChildTargetSelectorProps {
  children: Child[]
  mode: 'all' | 'specific'
  selectedIds: string[]
  onModeChange: (mode: 'all' | 'specific') => void
  onToggle: (childId: string, checked: boolean) => void
}

export default function ChildTargetSelector({
  children, mode, selectedIds, onModeChange, onToggle,
}: ChildTargetSelectorProps) {
  if (children.length === 0) return null

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.4rem' }}>Disponible pour</label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => onModeChange('all')}
          style={{
            padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
            background: mode === 'all' ? '#2a9d8f' : 'var(--color-border)',
            color: mode === 'all' ? 'white' : '#2a9d8f',
          }}
        >
          Tous mes enfants
        </button>
        <button
          onClick={() => onModeChange('specific')}
          style={{
            padding: '0.4rem 0.8rem', border: 'none', borderRadius: '0.5rem',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
            background: mode === 'specific' ? '#2a9d8f' : 'var(--color-border)',
            color: mode === 'specific' ? 'white' : '#2a9d8f',
          }}
        >
          Choisir
        </button>
      </div>
      {mode === 'specific' && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {children.map(child => (
            <label key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(child.id)}
                onChange={e => onToggle(child.id, e.target.checked)}
              />
              {child.first_name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
