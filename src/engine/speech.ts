import { apiSpeechUrl } from './api'

let cachedVoice: SpeechSynthesisVoice | null = null
let currentAudio: HTMLAudioElement | null = null

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const preferred = ['Samantha', 'Alex', 'Google US English', 'Microsoft Aria', 'Microsoft Zira']
  for (const name of preferred) {
    const hit = voices.find((v) => v.name.includes(name) && v.lang.toLowerCase().startsWith('en'))
    if (hit) {
      cachedVoice = hit
      return hit
    }
  }
  const fallback = voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  cachedVoice = fallback ?? null
  return cachedVoice
}

function speakWithSystemVoice(text: string, rate: number): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = rate
    u.pitch = 1
    const voice = pickEnglishVoice()
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
  } catch {
    // 浏览器不支持或被策略阻止时静默降级，不影响主流程
  }
}

function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)
}

/**
 * Apple 设备使用系统英文语音；Android/学习机优先播放后端代理的 MP3。
 * 部分 Android WebView 虽然暴露 speechSynthesis，实际却没有英文语音包，
 * 所以远程音频失败时才回退到系统朗读。
 */
export function speak(text: string, rate = 0.85): void {
  if (typeof window === 'undefined') return
  const word = text.trim()
  if (!word) return

  if (isAppleDevice() || typeof Audio === 'undefined') {
    speakWithSystemVoice(word, rate)
    return
  }

  try {
    currentAudio?.pause()
    const audio = new Audio(apiSpeechUrl(word))
    currentAudio = audio
    audio.preload = 'auto'
    let fellBack = false
    const fallback = () => {
      if (fellBack || currentAudio !== audio) return
      fellBack = true
      currentAudio = null
      speakWithSystemVoice(word, rate)
    }
    audio.onerror = fallback
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
    }
    void audio.play().catch(fallback)
  } catch {
    speakWithSystemVoice(word, rate)
  }
}

export function warmUpSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
    pickEnglishVoice()
  }
}
