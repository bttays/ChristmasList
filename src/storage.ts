import { useEffect, useState } from 'react'

// Data is kept in the browser for now. When shared lists arrive, this hook
// is the single place to swap in a backend.
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable (private mode, quota); keep working in memory.
    }
  }, [key, value])

  return [value, setValue] as const
}

export const newId = () => crypto.randomUUID()

export const formatMoney = (n?: number) =>
  n === undefined
    ? ''
    : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })

export const parseMoney = (s: string): number | undefined => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : undefined
}
