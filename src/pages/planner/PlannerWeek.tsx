import { useEffect, useRef } from 'react'
import type { CalendarItem } from './types'
import { toDateStr, getWeekDays, parseTime, isRecurringEvent } from './helpers'

interface Props {
  calDate: Date
  items: CalendarItem[]
  onItemClick: (e: React.MouseEvent, item: CalendarItem) => void
  onCellClick?: (date: string, time: string) => void
}

const S = 7, E = 21, PPH = 40

export default function PlannerWeek({ calDate, items, onItemClick, onCellClick }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const totalH = (E - S) * PPH
  const hours = Array.from({ length: E - S }, (_, i) => S + i)
  const days = getWeekDays(calDate)
  const todayStr = toDateStr(new Date())
  const now = new Date()

  useEffect(() => {
    if (!gridRef.current) return
    const scrollTo = Math.max(0, (now.getHours() - S - 1) * PPH)
    gridRef.current.scrollTop = scrollTo
  }, [calDate])

  const chipClick = (item: CalendarItem, e: React.MouseEvent) => {
    e.stopPropagation()
    onItemClick(e, item)
  }

  const handleCellClick = (date: string, hour: number) => {
    const time = `${String(hour).padStart(2, '0')}:00`
    onCellClick?.(date, time)
  }

  return (
    <div>
      {/* Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid #e0f0ee' }}>
        <div />
        {days.map((day, i) => {
          const ds = toDateStr(day)
          const isToday = ds === todayStr
          const isWE = i >= 5
          return (
            <div key={i} style={{ textAlign: 'center', padding: '0.4rem 0.2rem', background: isWE ? '#fafafa' : 'white', borderLeft: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: '0.68rem', color: isToday ? '#2a9d8f' : '#999', fontWeight: isToday ? 'bold' : 'normal', textTransform: 'uppercase' }}>
                {day.toLocaleDateString('fr-CH', { weekday: 'short' })}
              </div>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: isToday ? '#2a9d8f' : 'transparent', color: isToday ? 'white' : '#333', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', fontWeight: 'bold' }}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Toute la journée */}
      <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid #e0f0ee', background: '#fafafa', minHeight: '24px' }}>
        <div style={{ fontSize: '0.6rem', color: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>tj</div>
        {days.map((day, i) => {
          const ds = toDateStr(day)
          const dayAllDay = items.filter(it => it.date === ds && !it.startTime)
          return (
            <div key={i} style={{ borderLeft: '1px solid #f0f0f0', background: i >= 5 ? '#fafafa' : 'white', padding: '2px', minWidth: 0, overflow: 'hidden' }}>
              {dayAllDay.slice(0, 3).map(item => (
                <div key={item.id} onClick={e => chipClick(item, e)} title={item.title} style={{ background: item.color, color: 'white', borderRadius: '0.2rem', padding: '0.1rem 0.3rem', fontSize: '0.65rem', marginBottom: '1px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '100%', boxSizing: 'border-box' }}>
                  {item.title}
                  {isRecurringEvent(item) && <span style={{ fontSize: '0.65rem', marginLeft: '0.2rem' }}>🔁</span>}
                </div>
              ))}
              {dayAllDay.length > 3 && <div style={{ fontSize: '0.6rem', color: '#888' }}>+{dayAllDay.length - 3}</div>}
            </div>
          )
        })}
      </div>

      {/* Grille horaire */}
      <div ref={gridRef} style={{ overflowY: 'auto', maxHeight: '600px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', height: `${totalH}px` }}>
          <div style={{ position: 'relative' }}>
            {hours.map(h => (
              <div key={h} style={{ position: 'absolute', top: `${(h - S) * PPH - 8}px`, right: '6px', fontSize: '0.62rem', color: '#ccc' }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {days.map((day, colIdx) => {
            const ds = toDateStr(day)
            const timed = items.filter(it => it.date === ds && !!it.startTime)
            const isWE = colIdx >= 5
            const isTodayCol = ds === todayStr
            const nowTop = isTodayCol ? (now.getHours() - S) * PPH + Math.floor(now.getMinutes() * PPH / 60) : -1
            return (
              <div key={colIdx} style={{ position: 'relative', borderLeft: '1px solid #f0f0f0', background: isWE ? '#fafafa' : 'white' }}>
                {hours.map(h => (
                  <div
                    key={`click${h}`}
                    onClick={() => handleCellClick(ds, h)}
                    style={{ position: 'absolute', top: `${(h - S) * PPH}px`, left: 0, right: 0, height: `${PPH}px`, cursor: 'pointer', zIndex: 1 }}
                  />
                ))}
                {hours.map(h => (
                  <div key={`l${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH}px`, left: 0, right: 0, borderTop: '1px solid #f0f0f0' }} />
                ))}
                {hours.map(h => (
                  <div key={`m${h}`} style={{ position: 'absolute', top: `${(h - S) * PPH + 20}px`, left: 0, right: 0, borderTop: '1px dashed #f8f8f8' }} />
                ))}
                {nowTop >= 0 && nowTop <= totalH && (
                  <div style={{ position: 'absolute', top: `${nowTop}px`, left: 0, right: 0, borderTop: '2px solid #e63946', zIndex: 10 }} />
                )}
                {timed.map(item => {
                  const { h, m } = parseTime(item.startTime!)
                  const top = (h - S) * PPH + Math.floor(m * PPH / 60)
                  let ht = 20
                  if (item.endTime) {
                    const end = parseTime(item.endTime)
                    ht = Math.max(20, Math.floor((end.h * 60 + end.m - h * 60 - m) * PPH / 60))
                  }
                  return (
                    <div key={item.id} title={item.title} onClick={e => chipClick(item, e)} style={{
                      position: 'absolute', top: `${top}px`, left: '1px', right: '1px', height: `${ht}px`,
                      background: item.color, borderRadius: '0.25rem', padding: '0.1rem 0.3rem',
                      cursor: 'pointer', overflow: 'hidden', color: 'white', fontSize: '0.65rem', zIndex: 5,
                      maxWidth: '100%', boxSizing: 'border-box',
                    }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                        {isRecurringEvent(item) && <span style={{ fontSize: '0.65rem', marginLeft: '0.2rem' }}>🔁</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
