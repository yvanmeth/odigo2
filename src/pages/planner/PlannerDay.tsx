import { useEffect, useRef } from 'react'
import type { CalendarItem } from './types'
import { toDateStr, isSameDay, parseTime } from './helpers'
import CalendarItemChip from './CalendarItem'

interface Props {
  calDate: Date
  items: CalendarItem[]
  onItemClick: (item: CalendarItem, pos: { x: number; y: number }) => void
}

const S = 6, E = 22, PPH = 60

export default function PlannerDay({ calDate, items, onItemClick }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const totalH = (E - S) * PPH
  const hours = Array.from({ length: E - S + 1 }, (_, i) => S + i)
  const dayStr = toDateStr(calDate)
  const dayItems = items.filter(i => i.date === dayStr)
  const allDay = dayItems.filter(i => !i.startTime)
  const timed = dayItems.filter(i => !!i.startTime)
  const now = new Date()
  const isToday = isSameDay(calDate, now)
  const nowTop = isToday ? (now.getHours() - S) * PPH + now.getMinutes() : -1

  useEffect(() => {
    if (!gridRef.current) return
    const scrollTo = Math.max(0, (now.getHours() - S - 1) * PPH)
    gridRef.current.scrollTop = scrollTo
  }, [calDate])

  return (
    <div>
      {allDay.length > 0 && (
        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
          <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '0.3rem' }}>Toute la journée</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {allDay.map(item => (
              <CalendarItemChip key={item.id} item={item} onItemClick={onItemClick} />
            ))}
          </div>
        </div>
      )}
      <div ref={gridRef} style={{ overflowY: 'auto', maxHeight: '600px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', height: `${totalH}px`, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            {hours.map(h => (
              <div key={h} style={{ position: 'absolute', top: `${(h - S) * PPH - 8}px`, right: '6px', fontSize: '0.68rem', color: '#ccc', userSelect: 'none' }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          <div style={{ position: 'relative', borderLeft: '1px solid #f0f0f0' }}>
            {hours.map(h => (
              <div key={`hl-${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH}px`, left: 0, right: 0, borderTop: h > S ? '1px solid #f0f0f0' : 'none' }} />
            ))}
            {hours.slice(0, hours.length - 1).map(h => (
              <div key={`hh-${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH + 30}px`, left: 0, right: 0, borderTop: '1px dashed #f8f8f8' }} />
            ))}
            {isToday && nowTop >= 0 && nowTop <= totalH && (
              <div style={{ position: 'absolute', top: `${nowTop}px`, left: 0, right: 0, borderTop: '2px solid #e63946', zIndex: 10 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e63946', position: 'absolute', left: '-4px', top: '-4px' }} />
              </div>
            )}
            {timed.map(item => {
              const { h, m } = parseTime(item.startTime!)
              const top = (h - S) * PPH + m
              let ht = 30
              if (item.endTime) {
                const end = parseTime(item.endTime)
                ht = Math.max(30, end.h * 60 + end.m - h * 60 - m)
              }
              return (
                <div key={item.id} onClick={e => {
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  const popoverWidth = 200, popoverHeight = 100
                  const spaceRight = window.innerWidth - rect.right
                  const x = spaceRight >= popoverWidth ? rect.right + 8 : rect.left - popoverWidth - 8
                  const y = Math.min(rect.top, window.innerHeight - popoverHeight - 8)
                  onItemClick(item, { x, y })
                }} style={{
                  position: 'absolute', top: `${top}px`, left: '2px', right: '4px', height: `${ht}px`,
                  background: item.color, borderRadius: '0.4rem', padding: '0.2rem 0.5rem',
                  cursor: 'pointer', overflow: 'hidden', color: 'white', fontSize: '0.78rem', zIndex: 5,
                }}>
                  <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                  {ht >= 40 && <div style={{ opacity: 0.85, fontSize: '0.72rem' }}>{item.startTime}{item.endTime ? `–${item.endTime}` : ''}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
