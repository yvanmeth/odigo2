import type { CalendarItem as CalendarItemType } from './types'
import { PLANNER_COLORS } from './types'
import { isRecurringEvent } from './helpers'

interface Props {
  item: CalendarItemType
  onItemClick: (e: React.MouseEvent, item: CalendarItemType) => void
  compact?: boolean
  showTime?: boolean
  style?: React.CSSProperties
}

export default function CalendarItemChip({ item, onItemClick, compact, showTime, style }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onItemClick(e, item)
  }

  return (
    <div onClick={handleClick} className="calendar-item" title={item.title} style={{
      background: PLANNER_COLORS[item.type],
      color: 'white',
      borderRadius: compact ? '0.25rem' : '0.4rem',
      padding: compact ? '0.1rem 0.35rem' : '0.3rem 0.75rem',
      fontSize: compact ? '0.68rem' : '0.8rem',
      cursor: 'pointer',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      maxWidth: '100%',
      boxSizing: 'border-box',
      ...style,
    }}>
      {showTime && item.startTime && (
        <span style={{ opacity: 0.85, marginRight: '0.2rem', flexShrink: 0 }}>{item.startTime.slice(0, 5)}</span>
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
        {item.title}
      </span>
      {isRecurringEvent(item) && (
        <span style={{ fontSize: '0.65rem', marginLeft: '0.2rem', opacity: 0.85, flexShrink: 0 }}>🔁</span>
      )}
    </div>
  )
}
