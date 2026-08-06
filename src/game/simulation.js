import { APPARATUS_CONFIG, ENEMY_PATTERNS } from './config.js'

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

export function createRun(seed = Date.now(), config = APPARATUS_CONFIG) {
  return {
    phase: 'running',
    elapsed: 0,
    travelDistance: 0,
    nextSpawnAt: 0.65,
    nextId: 1,
    hp: config.STARTING_HP,
    kills: 0,
    hitsTaken: 0,
    enemies: [],
    seed: seed >>> 0,
  }
}

function spawnIntervalAt(elapsed, config) {
  return Math.max(
    config.MIN_SPAWN_INTERVAL,
    config.INITIAL_SPAWN_INTERVAL - elapsed * config.SPAWN_RAMP_PER_SECOND,
  )
}

function createEnemy(state, config) {
  const random = mulberry32(state.seed + state.nextId * 7919)
  const pattern = ENEMY_PATTERNS[Math.floor(random() * ENEMY_PATTERNS.length)]
  const angle = random() * Math.PI * 2
  const radius = (0.18 + random() * 0.82) * config.MAX_OFFSET
  const offset = {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }

  return {
    id: `enemy-${state.nextId}`,
    pattern,
    routeZ: state.travelDistance + config.SPAWN_DISTANCE + random() * 8,
    offset,
    phase: random() * Math.PI * 2,
    state: 'approaching',
    hasDamaged: false,
    parkedOffset: null,
  }
}

export function patternOffset(enemy, distanceAhead, elapsed) {
  if (enemy.parkedOffset) return enemy.parkedOffset

  const closeness = Math.max(0, Math.min(1, 1 - distanceAhead / APPARATUS_CONFIG.APPROACHING_DISTANCE))
  const phase = enemy.phase + elapsed
  const amplitude = 0.18 + closeness * 0.38

  switch (enemy.pattern) {
    case 'zigzag':
      return {
        x: enemy.offset.x + Math.sin(phase * 5.2) * amplitude,
        y: enemy.offset.y + Math.sin(phase * 2.6) * amplitude * 0.28,
      }
    case 'orbit':
      return {
        x: enemy.offset.x + Math.cos(phase * 2.2) * amplitude,
        y: enemy.offset.y + Math.sin(phase * 2.2) * amplitude,
      }
    case 'corkscrew':
      return {
        x: enemy.offset.x + Math.cos(phase * 4.1) * amplitude * closeness,
        y: enemy.offset.y + Math.sin(phase * 4.1) * amplitude * closeness,
      }
    default:
      return {
        x: enemy.offset.x + Math.sin(phase * 1.3) * amplitude * 0.3,
        y: enemy.offset.y + Math.cos(phase * 1.1) * amplitude * 0.22,
      }
  }
}

export function advanceRun(state, deltaSeconds, config = APPARATUS_CONFIG) {
  if (state.phase !== 'running') return state

  const delta = Math.max(0, Math.min(deltaSeconds, 0.05))
  const elapsed = state.elapsed + delta
  const travelDistance = state.travelDistance + config.TRAVEL_SPEED * delta
  let nextSpawnAt = state.nextSpawnAt
  let nextId = state.nextId
  let seed = state.seed
  let enemies = [...state.enemies]

  while (elapsed >= nextSpawnAt) {
    const spawnState = { ...state, travelDistance, nextId, seed }
    enemies.push(createEnemy(spawnState, config))
    nextId += 1
    seed = (seed + 0x9e3779b9) >>> 0
    nextSpawnAt += spawnIntervalAt(elapsed, config)
  }

  let hp = state.hp
  let hitsTaken = state.hitsTaken

  enemies = enemies.map((enemy) => {
    if (enemy.state === 'parked') return enemy

    const distanceAhead = enemy.routeZ - travelDistance
    if (distanceAhead > config.INTERACTION_DISTANCE) return enemy

    const parkedOffset = patternOffset(enemy, config.INTERACTION_DISTANCE, elapsed)
    if (!enemy.hasDamaged) {
      hp -= 1
      hitsTaken += 1
    }

    return {
      ...enemy,
      state: 'parked',
      hasDamaged: true,
      parkedOffset,
    }
  })

  return {
    ...state,
    phase: hp <= 0 ? 'overwhelmed' : 'running',
    elapsed,
    travelDistance,
    nextSpawnAt,
    nextId,
    seed,
    hp: Math.max(0, hp),
    hitsTaken,
    enemies,
  }
}

export function shootEnemy(state, enemyId) {
  if (state.phase !== 'running' || !enemyId) return state
  const exists = state.enemies.some((enemy) => enemy.id === enemyId)
  if (!exists) return state
  return {
    ...state,
    kills: state.kills + 1,
    enemies: state.enemies.filter((enemy) => enemy.id !== enemyId),
  }
}

export function prototypePayout(state) {
  return state.kills
}
