import { useState, createContext, useContext, useCallback } from 'react'
import type { ReactNode } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type'], duration?: number) => void
}

export const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

export const useToast = () => useContext(ToastContext)

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((
    message: string,
    type: Toast['type'] = 'success',
    duration = 2500
  ) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type, duration }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const COLORS = {
    success: { bg: '#2a9d8f', icon: '✓' },
    error:   { bg: '#e63946', icon: '✕' },
    info:    { bg: '#5c6bc0', icon: 'ℹ' },
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: COLORS[toast.type].bg,
            color: 'white',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: '500',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            animation: 'slideIn 0.2s ease',
            minWidth: '200px', maxWidth: '320px',
          }}>
            <span style={{ fontWeight: 'bold' }}>{COLORS[toast.type].icon}</span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
