let cachedVoice: SpeechSynthesisVoice | null = null

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

export function speak(text: string, rate = 0.85): void {
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

export function warmUpSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null
    pickEnglishVoice()
  }
}
