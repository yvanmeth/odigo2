import type { Child } from './types'

interface ChildSelectorProps {
  children: Child[]
  viewingChildId: string | null
  onSelectChild: (id: string | null) => void
}

export default function ChildSelector({ children, viewingChildId, onSelectChild }: ChildSelectorProps) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', background: '#f9f9f9' }}>
      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.4rem' }}>Vue active</div>
      <select
        value={viewingChildId || ''}
        onChange={e => onSelectChild(e.target.value || null)}
        style={{ width: '100%', padding: '0.4rem', borderRadius: '0.4rem', border: '1px solid #ddd', fontSize: '0.85rem', color: '#333' }}
      >
        <option value="">👤 Mon espace</option>
        {children.map(c => (
          <option key={c.id} value={c.id}>👧 {c.first_name}</option>
        ))}
      </select>
    </div>
  )
}
