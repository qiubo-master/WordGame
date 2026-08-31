import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { warmUpSpeech } from './engine/speech'

warmUpSpeech()

const el = document.getElementById('root')
if (el) createRoot(el).render(<App />)

// PWA：仅生产构建注册 Service Worker（开发环境不缓存，避免 HMR 干扰）
const metaEnv = (import.meta as unknown as { env?: { PROD?: boolean } }).env
if (metaEnv?.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    let refreshing = false
    const currentEntry = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src

    const checkForAppUpdate = async () => {
      if (!currentEntry || document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/?__wq_update=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const html = await res.text()
        const match = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)
        if (!match) return
        const latestEntry = new URL(match[1], location.origin).href
        if (latestEntry !== currentEntry) location.reload()
      } catch {
        // 离线时继续使用当前缓存版本。
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      location.reload()
    })

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.update().catch(() => {})
        window.setTimeout(checkForAppUpdate, 2000)
        window.addEventListener('focus', checkForAppUpdate)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForAppUpdate()
        })
      })
      .catch(() => {})
  })
}
