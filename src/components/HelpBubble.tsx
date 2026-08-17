import { useState, useEffect, useRef } from 'react'

interface HelpBubbleProps {
  title: string
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const HelpBubble = ({ title, content, position = 'bottom' }: HelpBubbleProps) => {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const enabled = localStorage.getItem('odigo_help_bubbles') !== 'off'
  if (!enabled) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        style={{
          width: '20px', height: '20px',
          borderRadius: '50%',
          background: open ? '#2a9d8f' : '#e0f0ee',
          color: open ? 'white' : '#2a9d8f',
          border: 'none', cursor: 'pointer',
          fontSize: '0.75rem', fontWeight: 'bold',
          display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s ease',
        }}
      >
        ?
      </button>

      {open && isMobile && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
          />
          <div ref={popoverRef} style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            background: 'white',
            borderRadius: '1rem 1rem 0 0',
            padding: '1.5rem',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: '#2a9d8f', fontSize: '1rem' }}>💡 {title}</strong>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#aaa' }}>✕</button>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.6 }}>
              {content}
            </div>
          </div>
        </>
      )}

      {open && !isMobile && (
        <div ref={popoverRef} style={{
          position: 'absolute',
          ...(position === 'bottom' && { top: '28px', left: '50%', transform: 'translateX(-50%)' }),
          ...(position === 'top' && { bottom: '28px', left: '50%', transform: 'translateX(-50%)' }),
          ...(position === 'right' && { left: '28px', top: '50%', transform: 'translateY(-50%)' }),
          ...(position === 'left' && { right: '28px', top: '50%', transform: 'translateY(-50%)' }),
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid #e0f0ee',
          width: '280px',
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <strong style={{ color: '#2a9d8f', fontSize: '0.9rem' }}>💡 {title}</strong>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#aaa' }}>✕</button>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#444', lineHeight: 1.6 }}>
            {content}
          </div>
        </div>
      )}
    </div>
  )
}

export default HelpBubble
