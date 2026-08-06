export const DIFFICULTY_LEVELS = Object.freeze([
  Object.freeze({
    level: 0,
    label: 'BASELINE',
    color: '#75ffc0',
    description: 'The current Apparatus descent with its existing waves, boss timing, and rewards.',
    waveSizeBonus: 0,
    waveIntervalMultiplier: 1,
    resourceMultiplier: 1,
    bossTempoMultiplier: 1,
    bossRegenMultiplier: 1,
  }),
  Object.freeze({
    level: 1,
    label: 'PRESSURE I',
    color: '#e9d487',
    description: 'Larger waves arrive sooner after the opening. Recovered shapes accumulate faster.',
    waveSizeBonus: 1,
    waveIntervalMultiplier: 0.92,
    resourceMultiplier: 1.25,
    bossTempoMultiplier: 1.1,
    bossRegenMultiplier: 1.05,
  }),
  Object.freeze({
    level: 2,
    label: 'PRESSURE II',
    color: '#ff9a56',
    description: 'Dense waves and a faster boss demand sustained target prioritization.',
    waveSizeBonus: 2,
    waveIntervalMultiplier: 0.84,
    resourceMultiplier: 1.5,
    bossTempoMultiplier: 1.2,
    bossRegenMultiplier: 1.12,
  }),
  Object.freeze({
    level: 3,
    label: 'PRESSURE III',
    color: '#ff5d66',
    description: 'Maximum pressure. Waves are substantially larger and every kill yields double shapes.',
    waveSizeBonus: 3,
    waveIntervalMultiplier: 0.75,
    resourceMultiplier: 2,
    bossTempoMultiplier: 1.35,
    bossRegenMultiplier: 1.22,
  }),
])

export function normalizeDifficultyLevel(level) {
  const numeric = Number.isFinite(Number(level)) ? Math.round(Number(level)) : 0
  return Math.max(0, Math.min(DIFFICULTY_LEVELS.length - 1, numeric))
}

export function difficultyFor(level = 0) {
  return DIFFICULTY_LEVELS[normalizeDifficultyLevel(level)]
}

export function difficultyEffectLabel(level = 0) {
  const difficulty = difficultyFor(level)
  if (difficulty.level === 0) return 'DIFFICULTY 0: BASELINE'
  return `DIFFICULTY +${difficulty.level}: ${difficulty.resourceMultiplier}× SHAPE YIELD`
}
