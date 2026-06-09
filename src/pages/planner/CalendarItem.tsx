import type { CalendarItem as CalendarItemType } from './types'

interface Props {
  item: CalendarItemType
  onItemClick: (item: CalendarItemType, pos: { x: number; y: number }) => void
  compact?: boolean
  showTime?: boolean
  style?: React.CSSProperties
}

export default function CalendarItemChip({ item, onItemClick, compact, showTime, style }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const popoverWidth = 200, popoverHeight = 100
    const spaceRight = window.innerWidth - rect.right
    const x = spaceRight >= popoverWidth ? rect.right + 8 : rect.left - popoverWidth - 8
    const y = Math.min(rect.top, window.innerHeight - popoverHeight - 8)
    onItemClick(item, { x, y })
  }

  return (
    <div onClick={handleClick} style={{
      background: item.color,
      color: 'white',
      borderRadius: compact ? '0.25rem' : '0.4rem',
      padding: compact ? '0.1rem 0.35rem' : '0.3rem 0.75rem',
      fontSize: compact ? '0.68rem' : '0.8rem',
      cursor: 'pointer',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      ...style,
    }}>
      {showTime && item.startTime && (
        <span style={{ opacity: 0.85, marginRight: '0.2rem' }}>{item.startTime.slice(0, 5)}</span>
      )}
      {item.title}
    </div>
  )
}
