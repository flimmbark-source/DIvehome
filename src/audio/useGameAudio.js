import { useCallback, useMemo } from 'react'

let sharedContext = null

function audioContext() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  if (!sharedContext) sharedContext = new AudioContext()
  if (sharedContext.state === 'suspended') sharedContext.resume().catch(() => {})
  return sharedContext
}

function tone(
  context,
  {
    frequency,
    endFrequency = frequency,
    duration = 0.08,
    gain = 0.08,
    type = 'square',
    delay = 0,
  },
) {
  const now = context.currentTime + delay
  const oscillator = context.createOscillator()
  const envelope = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(Math.max(1, frequency), now)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration)

  envelope.gain.setValueAtTime(0.0001, now)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + Math.min(0.008, duration * 0.2))
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  oscillator.connect(envelope)
  envelope.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.02)
}

function noise(
  context,
  {
    duration = 0.08,
    gain = 0.08,
    filterType = 'bandpass',
    frequency = 900,
    delay = 0,
  } = {},
) {
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration))
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = Math.random() * 2 - 1
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  const now = context.currentTime + delay

  source.buffer = buffer
  filter.type = filterType
  filter.frequency.setValueAtTime(frequency, now)
  filter.Q.setValueAtTime(0.8, now)
  envelope.gain.setValueAtTime(Math.max(0.0001, gain), now)
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(context.destination)
  source.start(now)
  source.stop(now + duration + 0.02)
}

export default function useGameAudio() {
  const unlock = useCallback(() => {
    audioContext()
  }, [])

  const playStep = useCallback((alternate = false) => {
    const context = audioContext()
    if (!context) return
    tone(context, {
      frequency: alternate ? 104 : 92,
      endFrequency: alternate ? 72 : 64,
      duration: 0.065,
      gain: 0.045,
      type: 'triangle',
    })
    noise(context, {
      duration: 0.045,
      gain: 0.025,
      filterType: 'lowpass',
      frequency: alternate ? 520 : 430,
    })
  }, [])

  const playEnter = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 90, endFrequency: 180, duration: 0.2, gain: 0.07, type: 'sawtooth' })
    tone(context, { frequency: 220, endFrequency: 520, duration: 0.18, gain: 0.045, type: 'square', delay: 0.06 })
    noise(context, { duration: 0.16, gain: 0.035, filterType: 'highpass', frequency: 1200 })
  }, [])

  const playShot = useCallback(() => {
    const context = audioContext()
    if (!context) return
    noise(context, { duration: 0.11, gain: 0.16, filterType: 'highpass', frequency: 720 })
    tone(context, { frequency: 150, endFrequency: 48, duration: 0.13, gain: 0.15, type: 'sawtooth' })
    tone(context, { frequency: 950, endFrequency: 280, duration: 0.055, gain: 0.045, type: 'square' })
  }, [])

  const playDry = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 240, endFrequency: 160, duration: 0.025, gain: 0.045, type: 'square' })
  }, [])

  const playReloadStart = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 300, endFrequency: 180, duration: 0.035, gain: 0.045, type: 'square' })
    tone(context, { frequency: 190, endFrequency: 140, duration: 0.04, gain: 0.035, type: 'triangle', delay: 0.075 })
  }, [])

  const playReloadComplete = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 420, endFrequency: 680, duration: 0.045, gain: 0.05, type: 'square' })
    tone(context, { frequency: 760, endFrequency: 580, duration: 0.035, gain: 0.035, type: 'triangle', delay: 0.035 })
  }, [])

  const playEnemyHit = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 1050, endFrequency: 340, duration: 0.09, gain: 0.055, type: 'square' })
    noise(context, { duration: 0.06, gain: 0.04, filterType: 'bandpass', frequency: 1600 })
  }, [])

  const playDamage = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 125, endFrequency: 42, duration: 0.22, gain: 0.13, type: 'sawtooth' })
    noise(context, { duration: 0.18, gain: 0.09, filterType: 'lowpass', frequency: 680 })
  }, [])

  const playOverload = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 220, endFrequency: 38, duration: 0.72, gain: 0.13, type: 'sawtooth' })
    tone(context, { frequency: 98, endFrequency: 31, duration: 0.9, gain: 0.1, type: 'square', delay: 0.08 })
    noise(context, { duration: 0.7, gain: 0.065, filterType: 'lowpass', frequency: 900 })
  }, [])

  const playBossArrival = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 58, endFrequency: 34, duration: 1.05, gain: 0.12, type: 'sawtooth' })
    tone(context, { frequency: 110, endFrequency: 260, duration: 0.72, gain: 0.065, type: 'square', delay: 0.18 })
    tone(context, { frequency: 165, endFrequency: 390, duration: 0.62, gain: 0.045, type: 'triangle', delay: 0.34 })
    noise(context, { duration: 0.9, gain: 0.05, filterType: 'lowpass', frequency: 520 })
  }, [])

  const playTentacleBreak = useCallback(() => {
    const context = audioContext()
    if (!context) return
    noise(context, { duration: 0.24, gain: 0.11, filterType: 'bandpass', frequency: 680 })
    tone(context, { frequency: 520, endFrequency: 72, duration: 0.31, gain: 0.095, type: 'sawtooth' })
    tone(context, { frequency: 180, endFrequency: 92, duration: 0.22, gain: 0.07, type: 'square', delay: 0.08 })
  }, [])

  const playBossVictory = useCallback(() => {
    const context = audioContext()
    if (!context) return
    tone(context, { frequency: 82, endFrequency: 41, duration: 0.55, gain: 0.1, type: 'sawtooth' })
    tone(context, { frequency: 220, endFrequency: 440, duration: 0.42, gain: 0.065, type: 'triangle', delay: 0.16 })
    tone(context, { frequency: 330, endFrequency: 660, duration: 0.48, gain: 0.05, type: 'square', delay: 0.28 })
    noise(context, { duration: 0.42, gain: 0.045, filterType: 'highpass', frequency: 1300, delay: 0.12 })
  }, [])

  return useMemo(
    () => ({
      unlock,
      playStep,
      playEnter,
      playShot,
      playDry,
      playReloadStart,
      playReloadComplete,
      playEnemyHit,
      playDamage,
      playOverload,
      playBossArrival,
      playTentacleBreak,
      playBossVictory,
    }),
    [
      unlock,
      playStep,
      playEnter,
      playShot,
      playDry,
      playReloadStart,
      playReloadComplete,
      playEnemyHit,
      playDamage,
      playOverload,
      playBossArrival,
      playTentacleBreak,
      playBossVictory,
    ],
  )
}
