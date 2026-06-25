import { useState } from 'react'
import type { CalendarItem, CalendarView, AppEvent, SubjectOption, Evaluation } from './types'
import { formatDateHeader, toDateStr } from './helpers'
import PlannerDay from './PlannerDay'
import PlannerWeek from './PlannerWeek'
import PlannerMonth from './PlannerMonth'
import CalendarCreateModal from './CalendarCreateModal'

interface Props {
  items: CalendarItem[]
  onEdit: (item: CalendarItem) => void
  onDelete: (table: string, id: string) => void
  onDeleteEvent: (event: AppEvent, mode: 'single' | 'following' | 'all') => void
  userId: string
  subjects: SubjectOption[]
  evaluations: Evaluation[]
  onRefresh?: () => void
}

const modalChoiceBtnStyle: React.CSSProperties = {
  padding: '0.6rem 1rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
  background: '#e0f0ee', color: '#2a9d8f', fontSize: '0.88rem', textAlign: 'left', fontWeight: 'bold',
}

const TABLE_MAP: Record<CalendarItem['type'], string> = {
  evaluation: 'evaluations',
  revision: 'revisions',
  event: 'events',
  reminder: 'reminders',
  mission: 'missions',
}

export default function PlannerCalendar({ items, onEdit, onDelete, onDeleteEvent, userId, subjects, evaluations, onRefresh }: Props) {
  const [calView, setCalView] = useState<CalendarView>('week')
  const [calDate, setCalDate] = useState(new Date())
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null)
  const [editPopoverPos, setEditPopoverPos] = useState({ x: 0, y: 0 })
  const [deleteSeriesItem, setDeleteSeriesItem] = useState<CalendarItem | null>(null)
  const [createModal, setCreateModal] = useState<{ open: boolean; date: string; time?: string }>({ open: false, date: '' })

  const navigate = (dir: -1 | 1) => {
    setCalDate(prev => {
      const d = new Date(prev)
      if (calView === 'day') d.setDate(d.getDate() + dir)
      else if (calView === 'week') d.setDate(d.getDate() + dir * 7)
      else { d.setMonth(d.getMonth() + dir); d.setDate(1) }
      return d
    })
  }

  const handleItemClick = (e: React.MouseEvent, item: CalendarItem) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const popoverWidth = 220
    const popoverHeight = 130
    const spaceRight = window.innerWidth - rect.right
    const spaceBottom = window.innerHeight - rect.bottom
    const x = spaceRight >= popoverWidth ? rect.right + 8 : rect.left - popoverWidth - 8
    const y = spaceBottom >= popoverHeight ? rect.top : rect.top - popoverHeight
    const clampedX = Math.max(8, Math.min(x, window.innerWidth - popoverWidth - 8))
    const clampedY = Math.max(8, Math.min(y, window.innerHeight - popoverHeight - 8))
    setEditPopoverPos({ x: clampedX, y: clampedY })
    setEditingItem(item)
  }

  const calViewToggle = (v: CalendarView) => ({
    padding: '0.35rem 0.65rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' as const,
    background: calView === v ? '#2a9d8f' : 'transparent',
    color: calView === v ? 'white' : '#2a9d8f',
    fontSize: '0.8rem', fontWeight: calView === v ? 'bold' : ('normal' as const),
  })

  const navBtnStyle = {
    padding: '0.35rem 0.65rem', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' as const,
    background: '#e0f0ee', color: '#2a9d8f', fontSize: '0.9rem',
  }

  return (
    <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      {/* Barre navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #e0f0ee', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button onClick={() => navigate(-1)} style={navBtnStyle}>←</button>
          <button onClick={() => setCalDate(new Date())} style={navBtnStyle}>Aujourd'hui</button>
          <button onClick={() => navigate(1)} style={navBtnStyle}>→</button>
        </div>
        <div style={{ flex: 1, fontWeight: 'bold', color: '#333', fontSize: '0.9rem', textAlign: 'center' }}>
          {formatDateHeader(calDate, calView)}
        </div>
        <div style={{ display: 'flex', gap: '0.2rem', background: '#f0faf8', borderRadius: '0.5rem', padding: '0.2rem' }}>
          <button style={calViewToggle('day')} onClick={() => setCalView('day')}>Jour</button>
          <button style={calViewToggle('week')} onClick={() => setCalView('week')}>Semaine</button>
          <button style={calViewToggle('month')} onClick={() => setCalView('month')}>Mois</button>
        </div>
        <button onClick={() => setCreateModal({ open: true, date: toDateStr(calDate) })} style={{
          background: '#2a9d8f', color: 'white', border: 'none', borderRadius: '0.5rem',
          padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          + Ajouter
        </button>
      </div>

      {calView === 'day' && <PlannerDay calDate={calDate} items={items} onItemClick={handleItemClick} onCellClick={(date, time) => setCreateModal({ open: true, date, time })} />}
      {calView === 'week' && <PlannerWeek calDate={calDate} items={items} onItemClick={handleItemClick} onCellClick={(date, time) => setCreateModal({ open: true, date, time })} />}
      {calView === 'month' && <PlannerMonth calDate={calDate} items={items} onItemClick={handleItemClick} onDayClick={date => setCreateModal({ open: true, date })} />}

      {/* Popover édition */}
      {editingItem && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 499 }} onClick={() => setEditingItem(null)} />
          <div style={{
            position: 'fixed', left: editPopoverPos.x, top: editPopoverPos.y, zIndex: 500,
            background: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '0.75rem 1rem', minWidth: '190px',
          }}>
            <div style={{ fontWeight: 'bold', color: '#333', fontSize: '0.88rem', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid #f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
              {editingItem.title}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {editingItem.type !== 'mission' && (
                <>
                  <button onClick={() => { onEdit(editingItem); setEditingItem(null) }} style={{ background: '#e0f0ee', color: '#2a9d8f', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    ✏️ Modifier
                  </button>
                  <button onClick={() => {
                    if (editingItem.type === 'event' && (editingItem.raw as AppEvent).recurrence_id) {
                      setDeleteSeriesItem(editingItem)
                      setEditingItem(null)
                    } else {
                      onDelete(TABLE_MAP[editingItem.type], editingItem.id)
                      setEditingItem(null)
                    }
                  }} style={{ background: '#fee', color: '#e63946', border: 'none', borderRadius: '0.4rem', padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                    🗑️
                  </button>
                </>
              )}
              {editingItem.type === 'mission' && (
                <span style={{ fontSize: '0.78rem', color: '#e76f51', fontStyle: 'italic' }}>Mission (lecture seule)</span>
              )}
              <button onClick={() => setEditingItem(null)} style={{ background: 'none', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '1rem', marginLeft: 'auto' }}>
                ✕
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal choix suppression événement récurrent */}
      {deleteSeriesItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', maxWidth: '340px', width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: '#333', marginBottom: '0.5rem', fontSize: '1.05rem' }}>Supprimer l'événement récurrent</h3>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>Cet événement fait partie d'une série. Que souhaitez-vous supprimer ?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={() => { onDeleteEvent(deleteSeriesItem.raw as AppEvent, 'single'); setDeleteSeriesItem(null) }} style={modalChoiceBtnStyle}>Cet événement uniquement</button>
              <button onClick={() => { onDeleteEvent(deleteSeriesItem.raw as AppEvent, 'following'); setDeleteSeriesItem(null) }} style={modalChoiceBtnStyle}>Cet événement et les suivants</button>
              <button onClick={() => { onDeleteEvent(deleteSeriesItem.raw as AppEvent, 'all'); setDeleteSeriesItem(null) }} style={{ ...modalChoiceBtnStyle, background: '#fee', color: '#e63946' }}>Toute la série</button>
              <button onClick={() => setDeleteSeriesItem(null)} style={{ ...modalChoiceBtnStyle, background: 'none', color: '#aaa' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal création d'item depuis le calendrier */}
      {createModal.open && (
        <CalendarCreateModal
          initialDate={createModal.date}
          initialTime={createModal.time}
          userId={userId}
          subjects={subjects}
          evaluations={evaluations}
          onClose={() => setCreateModal({ open: false, date: '' })}
          onSaved={() => { onRefresh?.() }}
        />
      )}
    </div>
  )
}
