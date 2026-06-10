import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { ToastContainer } from './Toast'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastCtx {
  showToast: (message: string, type?: ToastType) => void
}

const Ctx = createContext<ToastCtx>({ showToast: () => {} })

let _nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = _nextId++
    setToasts(prev => [...prev, { id, message, type }])
    const ms = type === 'error' ? 6000 : 4000
    const timer = setTimeout(() => dismiss(id), ms)
    timers.current.set(id, timer)
  }, [dismiss])

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx)
}
