import type { Evaluation, Revision } from '../../type/index'
import type { Event as AppEvent } from '../../type/index'
import { Delta } from '../../components/Delta'
import { EmptyState } from '../../components/EmptyState'
import {
  parseLocalDate, formatDateDMY,
  getWeekBounds, getISOWeekNumber, formatWeekRange, inRange,
} from '../../lib/dates'

type FilterKey = 'evaluations' | 'revisions' | 'events' | 'reminders'

interface Reminder {
  id: string
  user_id: string
  title: string
  deadline_date: string
  deadline_time?: string
  completed: boolean
  created_at: string
}

interface SubjectOption {
  id: number | string
  name: string
}

interface HomeWeekSectionProps {
  evaluations: Evaluation[]
  revisions: Revision[]
  events: AppEvent[]
  reminders: Reminder[]
  subjects: SubjectOption[]
  weekOffset: number
  isCurrentWeek: boolean
  digoosThisWeek?: number
  exercisesThisWeek?: number
  typeFilters: Record<FilterKey, boolean>
  onTypeFilterToggle: (key: FilterKey) => void
  onToggleRevision: (r: Revision) => void
  onToggleReminder: (r: Reminder) => void
  onUpdateEvalField?: (id: string, field: 'readiness' | 'grade', value: string) => void
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-card)', borderRadius: '1rem', padding: '1.5rem',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '1.5rem',
}
const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', textAlign: 'left', color: '#2a9d8f',
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

const filterLabels: Record<FilterKey, string> = {
  evaluations: 'Évaluations', revisions: 'Révisions', events: 'Événements', reminders: 'Rappels',
}

export default function HomeWeekSection({
  evaluations, revisions, events, reminders, subjects,
  weekOffset, isCurrentWeek,
  digoosThisWeek = 0, exercisesThisWeek = 0,
  typeFilters, onTypeFilterToggle,
  onToggleRevision, onToggleReminder, onUpdateEvalField,
}: HomeWeekSectionProps) {
  const { start, end } = getWeekBounds(weekOffset)
  const weekNo = getISOWeekNumber(parseLocalDate(start))
  const todayStr = new Date().toISOString().split('T')[0]

  const getSubjectName = (id: unknown) =>
    subjects.find(s => String(s.id) === String(id))?.name || '?'

  const weekEvals = evaluations.filter(e => inRange(e.evaluation_date, start, end))
  const weekRevs = revisions.filter(r => inRange(r.revision_date, start, end))
  const weekEvts = events.filter(e => inRange(e.event_date, start, end))
  const weekRems = isCurrentWeek
    ? reminders.filter(r => !r.completed && (inRange(r.deadline_date, start, end) || r.deadline_date < todayStr))
    : reminders.filter(r => !r.completed && inRange(r.deadline_date, start, end))

  const hasContent =
    (typeFilters.evaluations && weekEvals.length > 0) ||
    (typeFilters.revisions && weekRevs.length > 0) ||
    (typeFilters.events && weekEvts.length > 0) ||
    (typeFilters.reminders && weekRems.length > 0)

  const inlineInput = (evalId: string, field: 'readiness' | 'grade', currentVal: number | null | undefined) => (
    <input
      key={`${field}-${evalId}-${currentVal ?? ''}`}
      type="number" min="0" max="6" step="0.5"
      defaultValue={currentVal ?? ''}
      onBlur={e => onUpdateEvalField?.(evalId, field, e.target.value)}
      style={{
        width: '48px', border: 'none', borderBottom: '1px solid #2a9d8f',
        textAlign: 'center', background: 'transparent', fontSize: '0.9rem', padding: '0',
        outline: 'none',
      }}
    />
  )

  return (
    <div style={cardStyle}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ color: '#2a9d8f', fontSize: '1rem', fontWeight: 'bold' }}>
          Semaine {weekNo}{isCurrentWeek ? ' — en cours' : ''}
        </div>
        {isCurrentWeek && (
          <span style={{
            padding: '0.2rem 0.65rem', borderRadius: '1rem',
            background: '#fff8e0', color: '#b8860b', fontSize: '0.78rem', fontWeight: 'bold',
          }}>
            {digoosThisWeek} <Delta size={16} />
          </span>
        )}
      </div>

      <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '0.75rem' }}>
        {formatWeekRange(weekOffset)}
      </div>

      {isCurrentWeek && (
        <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: '1rem', marginTop: '-0.5rem' }}>
          {exercisesThisWeek} exercice{exercisesThisWeek !== 1 ? 's' : ''} cette semaine
        </div>
      )}

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

      {!hasContent && (
        <EmptyState emoji="🌟" title="Semaine vierge" subtitle="Ajoute des évaluations, révisions ou événements dans le Planificateur." />
      )}

      {/* Évaluations */}
      {typeFilters.evaluations && weekEvals.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {groupLabel('📝', 'Évaluations')}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-background)' }}>
                  {['Date', 'Matière', 'Sujet', 'Révisions', 'Note attendue', 'Note obtenue'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekEvals.map(e => {
                  const totalRev = revisions.filter(r => r.evaluation_id === e.id).length
                  const doneRev = revisions.filter(r => r.evaluation_id === e.id && r.completed).length
                  return (
                    <tr key={e.id}>
                      <td style={tdStyle}>{formatDateDMY(e.evaluation_date)}</td>
                      <td style={{ ...tdStyle, fontWeight: 'bold' }}>{getSubjectName(e.subject_id)}</td>
                      <td style={tdStyle}>{e.topic}</td>
                      <td style={tdStyle}>
                        <span style={{ color: doneRev > 0 ? '#2a9d8f' : '#aaa' }}>
                          {doneRev}/{totalRev}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {isCurrentWeek ? inlineInput(e.id, 'readiness', e.readiness) : (e.readiness ?? '—')}
                      </td>
                      <td style={tdStyle}>
                        {isCurrentWeek ? inlineInput(e.id, 'grade', e.grade) : (e.grade ?? '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Révisions — toggle disponible toutes semaines */}
      {typeFilters.revisions && weekRevs.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {groupLabel('📖', 'Révisions')}
          {weekRevs.map(r => {
            const linkedEval = evaluations.find(e => e.id === r.evaluation_id)
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.45rem 0', borderBottom: '1px solid #f5f5f5',
              }}>
                <button
                  onClick={() => onToggleRevision(r)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0', lineHeight: 1 }}
                >
                  {r.completed ? '✅' : '⬜'}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.85rem', color: '#555' }}>{formatDateDMY(r.revision_date)}</span>
                  {r.details && (
                    <span style={{ fontSize: '0.82rem', color: '#888', marginLeft: '0.5rem' }}>{r.details}</span>
                  )}
                  {linkedEval && (
                    <span style={{ fontSize: '0.78rem', color: '#2a9d8f', marginLeft: '0.5rem' }}>
                      → {linkedEval.topic}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Événements */}
      {typeFilters.events && weekEvts.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {groupLabel('📅', 'Événements')}
          {weekEvts.map(ev => (
            <div key={ev.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#333' }}>{ev.title}</span>
              <span style={{ fontSize: '0.82rem', color: '#aaa', marginLeft: '0.6rem' }}>{formatDateDMY(ev.event_date)}</span>
              {ev.details && (
                <div style={{ fontSize: '0.8rem', color: '#bbb', marginTop: '0.2rem' }}>{ev.details}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rappels — toggle disponible toutes semaines */}
      {typeFilters.reminders && weekRems.length > 0 && (
        <div>
          {groupLabel('🔔', 'Rappels')}
          {weekRems.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.45rem 0', borderBottom: '1px solid #f5f5f5',
            }}>
              <button
                onClick={() => onToggleReminder(r)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0', lineHeight: 1 }}
              >
                {r.completed ? '✅' : '⬜'}
              </button>
              <div>
                <span style={{ fontSize: '0.88rem', color: '#333', fontWeight: 'bold' }}>{r.title}</span>
                <span style={{
                  fontSize: '0.78rem', marginLeft: '0.5rem',
                  color: r.deadline_date < todayStr ? '#e63946' : '#aaa',
                }}>
                  {formatDateDMY(r.deadline_date)}
                  {r.deadline_date < todayStr && ' — en retard'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
