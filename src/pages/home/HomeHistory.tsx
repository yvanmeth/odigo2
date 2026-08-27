import type { Evaluation, Revision } from '../../type/index'
import type { Event as AppEvent } from '../../type/index'
import { formatDateDMY, isPastInFilter, type PastFilter } from '../../lib/dates'
import { EmptyState } from '../../components/EmptyState'

type FilterKey = 'evaluations' | 'revisions' | 'events' | 'reminders'

interface Reminder {
  id: string
  title: string
  deadline_date: string
  completed: boolean
}

interface SubjectOption {
  id: number | string
  name: string
}

interface HomeHistoryProps {
  evaluations: Evaluation[]
  revisions: Revision[]
  events: AppEvent[]
  reminders: Reminder[]
  subjects: SubjectOption[]
  pastFilter: PastFilter
  onPastFilterChange: (f: PastFilter) => void
  typeFilters: Record<FilterKey, boolean>
  onTypeFilterToggle: (key: FilterKey) => void
}

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', color: '#aaa',
  fontSize: '0.82rem', fontWeight: 'bold',
}
const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', fontSize: '0.88rem', borderBottom: '1px solid #f5f5f5',
}

const groupLabel = (icon: string, label: string) => (
  <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', marginBottom: '0.5rem', marginTop: '0.25rem' }}>
    {icon} {label}
  </div>
)

export default function HomeHistory({
  evaluations, revisions, events, reminders, subjects,
  pastFilter, onPastFilterChange, typeFilters, onTypeFilterToggle,
}: HomeHistoryProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const getSubjectName = (id: unknown) =>
    subjects.find(s => String(s.id) === String(id))?.name || '?'

  const pastEvals = evaluations
    .filter(e => isPastInFilter(e.evaluation_date, pastFilter, todayStr))
    .sort((a, b) => b.evaluation_date.localeCompare(a.evaluation_date))
  const pastRevs = revisions
    .filter(r => isPastInFilter(r.revision_date, pastFilter, todayStr))
    .sort((a, b) => b.revision_date.localeCompare(a.revision_date))
  const pastEvts = events
    .filter(e => isPastInFilter(e.event_date, pastFilter, todayStr))
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
  const pastRems = reminders
    .filter(r => r.completed && isPastInFilter(r.deadline_date, pastFilter, todayStr))
    .sort((a, b) => b.deadline_date.localeCompare(a.deadline_date))

  const hasPastContent =
    (typeFilters.evaluations && pastEvals.length > 0) ||
    (typeFilters.revisions && pastRevs.length > 0) ||
    (typeFilters.events && pastEvts.length > 0) ||
    (typeFilters.reminders && pastRems.length > 0)

  const filterLabels: Record<FilterKey, string> = {
    evaluations: 'Évaluations', revisions: 'Révisions', events: 'Événements', reminders: 'Rappels',
  }

  return (
    <div style={{
      background: 'var(--color-card)', borderRadius: '1rem', padding: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ color: '#2a9d8f', fontSize: '1rem', fontWeight: 'bold' }}>📋 Historique</div>
      </div>

      {/* Filtre de période */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {([['all', 'Tout'], ['year', 'Cette année'], ['30days', '30 derniers jours'], ['none', 'Aucun']] as [PastFilter, string][]).map(([val, label]) => (
          <button key={val} onClick={() => onPastFilterChange(val)} style={{
            padding: '0.3rem 0.7rem', border: 'none', borderRadius: '0.4rem',
            cursor: 'pointer', fontSize: '0.8rem',
            background: pastFilter === val ? '#888' : '#f0f0f0',
            color: pastFilter === val ? 'white' : '#666',
          }}>
            {label}
          </button>
        ))}
      </div>

      {pastFilter !== 'none' && (
        <>
          {/* Filtres de type */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {(['evaluations', 'revisions', 'events', 'reminders'] as FilterKey[]).map(key => (
              <button key={key} onClick={() => onTypeFilterToggle(key)} style={{
                padding: '0.3rem 0.7rem', border: 'none', borderRadius: '0.4rem',
                cursor: 'pointer', fontSize: '0.8rem',
                background: typeFilters[key] ? '#2a9d8f' : 'var(--color-border)',
                color: typeFilters[key] ? 'white' : '#2a9d8f',
              }}>
                {filterLabels[key]}
              </button>
            ))}
          </div>

          {!hasPastContent && (
            <EmptyState emoji="🌟" title="Semaine vierge" subtitle="Ajoute des évaluations, révisions ou événements dans le Planificateur." />
          )}

          {typeFilters.evaluations && pastEvals.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {groupLabel('📝', 'Évaluations')}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      {['Date', 'Matière', 'Sujet', 'Révisions', 'Note attendue', 'Note obtenue'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pastEvals.map(e => {
                      const totalRev = revisions.filter(r => r.evaluation_id === e.id).length
                      const doneRev = revisions.filter(r => r.evaluation_id === e.id && r.completed).length
                      return (
                        <tr key={e.id} style={{ opacity: 0.8 }}>
                          <td style={tdStyle}>{formatDateDMY(e.evaluation_date)}</td>
                          <td style={{ ...tdStyle, fontWeight: 'bold' }}>{getSubjectName(e.subject_id)}</td>
                          <td style={tdStyle}>{e.topic}</td>
                          <td style={tdStyle}><span style={{ color: '#aaa' }}>{doneRev}/{totalRev}</span></td>
                          <td style={tdStyle}>{e.readiness ?? '—'}</td>
                          <td style={tdStyle}>{e.grade ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {typeFilters.revisions && pastRevs.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {groupLabel('📖', 'Révisions')}
              {pastRevs.map(r => (
                <div key={r.id} style={{
                  display: 'flex', gap: '0.75rem', alignItems: 'center',
                  padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', opacity: 0.75,
                }}>
                  <span style={{ fontSize: '1rem' }}>{r.completed ? '✅' : '⬜'}</span>
                  <span style={{ fontSize: '0.85rem', color: '#888' }}>{formatDateDMY(r.revision_date)}</span>
                  {r.details && <span style={{ fontSize: '0.82rem', color: '#bbb' }}>{r.details}</span>}
                </div>
              ))}
            </div>
          )}

          {typeFilters.events && pastEvts.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {groupLabel('📅', 'Événements')}
              {pastEvts.map(ev => (
                <div key={ev.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', opacity: 0.75 }}>
                  <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#555' }}>{ev.title}</span>
                  <span style={{ fontSize: '0.8rem', color: '#bbb', marginLeft: '0.6rem' }}>{formatDateDMY(ev.event_date)}</span>
                </div>
              ))}
            </div>
          )}

          {typeFilters.reminders && pastRems.length > 0 && (
            <div>
              {groupLabel('🔔', 'Rappels')}
              {pastRems.map(r => (
                <div key={r.id} style={{
                  display: 'flex', gap: '0.6rem', alignItems: 'center',
                  padding: '0.4rem 0', borderBottom: '1px solid #f5f5f5', opacity: 0.75,
                }}>
                  <span style={{ fontSize: '1rem' }}>✅</span>
                  <span style={{ fontSize: '0.85rem', color: '#555' }}>{r.title}</span>
                  <span style={{ fontSize: '0.78rem', color: '#bbb' }}>{formatDateDMY(r.deadline_date)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
