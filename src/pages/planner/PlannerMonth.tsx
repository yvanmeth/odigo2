import { useState } from 'react'
import type { CalendarItem } from './types'
import { toDateStr, isSameDay, getMonthGrid } from './helpers'
import CalendarItemChip from './CalendarItem'

interface Props {
  calDate: Date
  items: CalendarItem[]
  onItemClick: (item: CalendarItem, pos: { x: number; y: number }) => void
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function PlannerMonth({ calDate, items, onItemClick }: Props) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const grid = getMonthGrid(calDate)
  const currentMonth = calDate.getMonth()

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f0faf8' }}>
        {DAY_NAMES.map((name, i) => (
          <div key={name} style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.78rem', fontWeight: 'bold', color: i >= 5 ? '#888' : '#2a9d8f' }}>
            {name}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {grid.map((day, idx) => {
          const ds = toDateStr(day)
          const isCurrentMonth = day.getMonth() === currentMonth
          const isToday = isSameDay(day, new Date())
          const isWE = idx % 7 >= 5
          const dayItems = items.filter(i => i.date === ds)
          const showAll = expandedDay === ds
          const displayed = showAll ? dayItems : dayItems.slice(0, 3)
          const extra = dayItems.length - 3

          return (
            <div key={idx} style={{
              border: '1px solid #f0f0f0', minHeight: '90px', padding: '0.3rem',
              background: isWE ? '#fafafa' : 'white', opacity: isCurrentMonth ? 1 : 0.4,
            }}>
              <div style={{ marginBottom: '0.2rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: isToday ? '#2a9d8f' : 'transparent',
                  color: isToday ? 'white' : '#333',
                  fontSize: '0.75rem', fontWeight: isToday ? 'bold' : 'normal',
                }}>
                  {day.getDate()}
                </span>
              </div>
              {displayed.map(item => (
                <CalendarItemChip key={item.id} item={item} onItemClick={onItemClick} compact showTime style={{ marginBottom: '0.1rem' }} />
              ))}
              {!showAll && extra > 0 && (
                <div onClick={e => { e.stopPropagation(); setExpandedDay(ds) }} style={{ fontSize: '0.65rem', color: '#888', cursor: 'pointer', fontWeight: 'bold' }}>
                  +{extra} autres
                </div>
              )}
              {showAll && extra > 0 && (
                <div onClick={e => { e.stopPropagation(); setExpandedDay(null) }} style={{ fontSize: '0.65rem', color: '#888', cursor: 'pointer' }}>
                  Voir moins ▲
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
