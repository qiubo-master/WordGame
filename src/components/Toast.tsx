import { useEffect, useState } from 'react'

let listener: ((msg: string) => void) | null = null

export function toast(msg: string): void {
  listener?.(msg)
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    listener = (m) => {
      setMsg(m)
      setKey((k) => k + 1)
    }
    return () => {
      listener = null
    }
  }, [])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 1600)
    return () => clearTimeout(t)
  }, [msg, key])

  if (!msg) return null
  return (
    <div className="toast" key={key}>
      {msg}
    </div>
  )
}
