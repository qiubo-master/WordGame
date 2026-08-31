import { useAppStore } from '../store/useAppStore'

type AudioCtxCtor = typeof AudioContext

let ctx: AudioContext | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor }
  const AC = w.AudioContext ?? w.webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneSpec {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
  slideTo?: number
}

function play(specs: ToneSpec[]): void {
  if (muted) return
  try {
    if (!useAppStore.getState().settings.soundOn) return
  } catch {
    // store 尚未就绪时忽略
  }
  const c = getCtx()
  if (!c) return
  const now = c.currentTime
  for (const s of specs) {
    const start = now + s.at
    const end = start + s.dur
    try {
      const osc = c.createOscillator()
      const g = c.createGain()
      osc.type = s.type ?? 'sine'
      osc.frequency.setValueAtTime(s.freq, start)
      if (s.slideTo && s.slideTo > 0) {
        osc.frequency.exponentialRampToValueAtTime(s.slideTo, end)
      }
      const peak = s.gain ?? 0.15
      g.gain.setValueAtTime(0.0001, start)
      g.gain.exponentialRampToValueAtTime(peak, start + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(g)
      g.connect(c.destination)
      osc.start(start)
      osc.stop(end + 0.02)
    } catch {
      // 单个音失败不影响主流程
    }
  }
}

export const SFX = {
  correct: () => play([
    { freq: 660, at: 0, dur: 0.09, type: 'sine', gain: 0.16 },
    { freq: 990, at: 0.08, dur: 0.14, type: 'sine', gain: 0.14 },
  ]),
  wrong: () => play([
    { freq: 240, at: 0, dur: 0.13, type: 'sawtooth', gain: 0.1, slideTo: 170 },
    { freq: 150, at: 0.11, dur: 0.2, type: 'sawtooth', gain: 0.09 },
  ]),
  pop: () => play([{ freq: 520, at: 0, dur: 0.07, type: 'triangle', gain: 0.07, slideTo: 760 }]),
  hit: () => play([
    { freq: 880, at: 0, dur: 0.06, type: 'square', gain: 0.08 },
    { freq: 1320, at: 0.05, dur: 0.1, type: 'sine', gain: 0.12 },
  ]),
  miss: () => play([
    { freq: 200, at: 0, dur: 0.14, type: 'square', gain: 0.09, slideTo: 120 },
  ]),
  win: () => play([
    { freq: 523, at: 0, dur: 0.12, type: 'sine', gain: 0.14 },
    { freq: 659, at: 0.11, dur: 0.12, type: 'sine', gain: 0.14 },
    { freq: 784, at: 0.22, dur: 0.12, type: 'sine', gain: 0.14 },
    { freq: 1047, at: 0.33, dur: 0.26, type: 'sine', gain: 0.15 },
  ]),
  lose: () => play([
    { freq: 392, at: 0, dur: 0.16, type: 'triangle', gain: 0.12 },
    { freq: 311, at: 0.15, dur: 0.16, type: 'triangle', gain: 0.12 },
    { freq: 233, at: 0.3, dur: 0.3, type: 'triangle', gain: 0.11 },
  ]),
  coin: () => play([
    { freq: 1180, at: 0, dur: 0.06, type: 'sine', gain: 0.1 },
    { freq: 1560, at: 0.05, dur: 0.1, type: 'sine', gain: 0.09 },
  ]),
}

export function unlockAudio(): void {
  getCtx()
}

export function setMuted(v: boolean): void {
  muted = v
}

export function isMuted(): boolean {
  return muted
}
