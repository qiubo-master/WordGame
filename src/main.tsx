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
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
