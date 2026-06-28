import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { SubjectItem, SubjectTab } from './types'
import SubjectGrid from './SubjectGrid'
import SubjectEvals from './SubjectEvals'
import SubjectNotes from './SubjectNotes'
import SubjectPostits from './SubjectPostits'
import SubjectWordlists from './SubjectWordlists'

export default function Subjects({ userId }: { userId?: string }) {
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null)
  const [subjectTab, setSubjectTab] = useState<SubjectTab>('evals')

  const subjectColor = selectedSubject?.color || '#2a9d8f'

  const tabStyle = (tab: SubjectTab): CSSProperties => ({
    padding: '0.6rem 1.2rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
    background: subjectTab === tab ? '#2a9d8f' : 'var(--color-border)',
    color: subjectTab === tab ? 'white' : '#2a9d8f',
    fontWeight: subjectTab === tab ? 'bold' : 'normal', fontSize: '0.9rem',
  })

  if (!selectedSubject) {
    return (
      <SubjectGrid
        userId={userId}
        onSelectSubject={s => { setSelectedSubject(s); setSubjectTab('evals') }}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setSelectedSubject(null)}
          style={{ padding: '0.4rem 0.8rem', background: 'var(--color-border)', color: '#2a9d8f', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          ← Retour
        </button>
        <h2 style={{ margin: 0, color: subjectColor }}>
          {selectedSubject.emoji} {selectedSubject.name}
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button style={tabStyle('evals')} onClick={() => setSubjectTab('evals')}>📅 Évaluations</button>
        <button style={tabStyle('notes')} onClick={() => setSubjectTab('notes')}>📝 Notes</button>
        <button style={tabStyle('postits')} onClick={() => setSubjectTab('postits')}>🗒️ Post-its</button>
        <button style={tabStyle('wordlists')} onClick={() => setSubjectTab('wordlists')}>📋 Listes</button>
      </div>

      {subjectTab === 'evals' && <SubjectEvals userId={userId} subjectId={selectedSubject.id} />}
      {subjectTab === 'notes' && <SubjectNotes userId={userId} subjectId={selectedSubject.id} />}
      {subjectTab === 'postits' && <SubjectPostits userId={userId} subjectId={selectedSubject.id} />}
      {subjectTab === 'wordlists' && <SubjectWordlists userId={userId} subjectId={selectedSubject.id} />}
    </div>
  )
}
