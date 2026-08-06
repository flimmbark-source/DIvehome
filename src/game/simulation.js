import { APPARATUS_CONFIG, ENEMY_PATTERNS, tunnelAxisAt } from './config.js'
import { advanceBoss, createBoss, destroyBossTarget } from './boss.js'
import { difficultyFor } from './difficulty.js'
import { emptyShapeInventory } from './progression.js'

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

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

export function isCombatPhase(stateOrPhase) {
  const phase = typeof stateOrPhase === 'string' ? stateOrPhase : stateOrPhase?.phase
  return phase === 'running' || phase === 'boss'
}

export function createRun(seed = Date.now(), config = APPARATUS_CONFIG, loadout = {}) {
  const maxHp = config.STARTING_HP + Math.max(0, loadout.maxHpBonus ?? 0)
  const difficulty = difficultyFor(loadout.difficultyLevel)
  return {
    phase: 'running',
    elapsed: 0,
    travelDistance: 0,
    nextSpawnAt: config.FIRST_WAVE_AT ?? 0.65,
    wavesSpawned: 0,
    nextId: 1,
    hp: maxHp,
    maxHp,
    shield: Math.max(0, loadout.startingShield ?? 0),
    blocks: 0,
    kills: 0,
    hitsTaken: 0,
    difficultyLevel: difficulty.level,
    resourceRemainder: 0,
    shapeDrops: emptyShapeInventory(),
    enemies: [],
    boss: null,
    bossPiecesDestroyed: 0,
    bossTentaclesDestroyed: 0,
    bossRewardGranted: false,
    craftPosition: { x: 0, y: 0 },
    diving: false,
    seed: seed >>> 0,
  }
}

export function spawnIntervalAt(elapsed, config = APPARATUS_CONFIG, difficultyLevel = 0) {
  const difficulty = difficultyFor(difficultyLevel)
  const baseInterval = Math.max(
    config.MIN_WAVE_INTERVAL,
    config.INITIAL_WAVE_INTERVAL - elapsed * config.WAVE_INTERVAL_RAMP_PER_SECOND,
  )
  return baseInterval * difficulty.waveIntervalMultiplier
}

export function waveSizeAt(elapsed, config = APPARATUS_CONFIG, difficultyLevel = 0) {
  if (elapsed < config.OPENING_WAVE_SECONDS) return 1
  const difficulty = difficultyFor(difficultyLevel)
  const rampSeconds = Math.max(0.01, config.WAVE_SIZE_RAMP_SECONDS)
  const escalation = Math.floor((elapsed - config.OPENING_WAVE_SECONDS) / rampSeconds)
  const baseWaveSize = Math.min(config.MAX_WAVE_SIZE, 2 + escalation)
  return baseWaveSize + difficulty.waveSizeBonus
}

function createEnemy(state, config, memberIndex = 0, waveSize = 1) {
  const random = mulberry32(state.seed + state.nextId * 7919)
  const pattern = ENEMY_PATTERNS[Math.floor(random() * ENEMY_PATTERNS.length)]
  const angle = waveSize > 1
    ? state.wavesSpawned * 1.73 + (memberIndex / waveSize) * Math.PI * 2 + (random() - 0.5) * 0.35
    : random() * Math.PI * 2
  const radius = (waveSize > 1 ? 0.38 + random() * 0.62 : 0.18 + random() * 0.82) * config.MAX_OFFSET

  return {
    id: `enemy-${state.nextId}`,
    waveId: state.wavesSpawned,
    waveMember: memberIndex,
    waveSize,
    pattern,
    routeZ:
      state.travelDistance +
      config.SPAWN_DISTANCE +
      memberIndex * config.WAVE_DEPTH_SPACING +
      random() * config.WAVE_DEPTH_JITTER,
    offset: {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    },
    homeOffset: { x: 0, y: 0 },
    phase: random() * Math.PI * 2,
    state: 'approaching',
    hasDamaged: false,
  }
}

export function patternOffset(enemy, distanceAhead, elapsed) {
  const closeness = clamp(1 - distanceAhead / APPARATUS_CONFIG.APPROACHING_DISTANCE, 0, 1)
  const phase = enemy.phase + elapsed
  const amplitude = 0.18 + closeness * 0.38
  const home = enemy.homeOffset ?? { x: 0, y: 0 }

  switch (enemy.pattern) {
    case 'zigzag':
      return {
        x: enemy.offset.x + home.x + Math.sin(phase * 5.2) * amplitude,
        y: enemy.offset.y + home.y + Math.sin(phase * 2.6) * amplitude * 0.28,
      }
    case 'orbit':
      return {
        x: enemy.offset.x + home.x + Math.cos(phase * 2.2) * amplitude,
        y: enemy.offset.y + home.y + Math.sin(phase * 2.2) * amplitude,
      }
    case 'corkscrew':
      return {
        x: enemy.offset.x + home.x + Math.cos(phase * 4.1) * amplitude * closeness,
        y: enemy.offset.y + home.y + Math.sin(phase * 4.1) * amplitude * closeness,
      }
    default:
      return {
        x: enemy.offset.x + home.x + Math.sin(phase * 1.3) * amplitude * 0.3,
        y: enemy.offset.y + home.y + Math.cos(phase * 1.1) * amplitude * 0.22,
      }
  }
}

export function enemyPositionAtDistance(enemy, distanceAhead, elapsed, config = APPARATUS_CONFIG) {
  const offset = patternOffset(enemy, distanceAhead, elapsed)
  const enemyAxis = tunnelAxisAt(enemy.routeZ, config)
  const playerTravel = enemy.routeZ - distanceAhead
  const currentAxis = tunnelAxisAt(playerTravel, config)
  return {
    x: enemyAxis.x - currentAxis.x + offset.x * config.TUBE_RADIUS,
    y: enemyAxis.y - currentAxis.y + offset.y * config.TUBE_RADIUS,
    z: -distanceAhead,
  }
}

function absorbHits(state, incomingHits) {
  let hp = state.hp
  let shield = state.shield ?? 0
  let blocks = state.blocks ?? 0
  let hitsTaken = state.hitsTaken

  for (let index = 0; index < incomingHits; index += 1) {
    if (shield > 0) {
      shield -= 1
      blocks += 1
    } else {
      hp -= 1
      hitsTaken += 1
    }
  }

  return { hp: Math.max(0, hp), shield, blocks, hitsTaken }
}

function normalizedCraftPosition(controls, config) {
  const craft = controls?.craftPosition ?? { x: 0, y: 0 }
  return {
    x: clamp(Number.isFinite(craft.x) ? craft.x : 0, -config.CRAFT_MAX_X, config.CRAFT_MAX_X),
    y: clamp(Number.isFinite(craft.y) ? craft.y : 0, -config.CRAFT_MAX_Y, config.CRAFT_MAX_Y),
  }
}

function advanceOrdinaryRun(state, realDelta, config, controls) {
  const diving = Boolean(controls?.diving)
  const timeScale = diving ? config.DIVE_TIME_SCALE : 1
  const delta = realDelta * timeScale
  const elapsed = state.elapsed + delta
  const travelDistance = state.travelDistance + config.TRAVEL_SPEED * delta
  const craftPosition = normalizedCraftPosition(controls, config)

  if (elapsed >= config.ROUND_SECONDS) {
    return {
      ...state,
      phase: 'boss',
      elapsed,
      travelDistance,
      enemies: [],
      boss: createBoss(config, state.difficultyLevel),
      craftPosition,
      diving: false,
    }
  }

  let nextSpawnAt = state.nextSpawnAt
  let wavesSpawned = state.wavesSpawned ?? 0
  let nextId = state.nextId
  let seed = state.seed
  let enemies = [...state.enemies]

  while (elapsed >= nextSpawnAt && nextSpawnAt < config.ROUND_SECONDS) {
    const waveElapsed = nextSpawnAt
    const waveSize = waveSizeAt(waveElapsed, config, state.difficultyLevel)

    for (let memberIndex = 0; memberIndex < waveSize; memberIndex += 1) {
      const spawnState = { ...state, travelDistance, nextId, seed, wavesSpawned }
      enemies.push(createEnemy(spawnState, config, memberIndex, waveSize))
      nextId += 1
      seed = (seed + 0x9e3779b9) >>> 0
    }

    wavesSpawned += 1
    nextSpawnAt += spawnIntervalAt(waveElapsed, config, state.difficultyLevel)
  }

  let incomingHits = 0
  enemies = enemies
    .map((enemy) => {
      const previousDistance = enemy.routeZ - state.travelDistance
      const distanceAhead = enemy.routeZ - travelDistance
      const closeness = clamp(1 - distanceAhead / config.APPROACHING_DISTANCE, 0, 1)
      const enemyAxis = tunnelAxisAt(enemy.routeZ, config)
      const currentAxis = tunnelAxisAt(travelDistance, config)
      const desiredOffset = {
        x: (craftPosition.x - (enemyAxis.x - currentAxis.x)) / config.TUBE_RADIUS - enemy.offset.x,
        y: (craftPosition.y - (enemyAxis.y - currentAxis.y)) / config.TUBE_RADIUS - enemy.offset.y,
      }
      const homingFactor = Math.min(1, config.ENEMY_HOMING_RATE * delta * (0.28 + closeness * 0.72))
      const currentHome = enemy.homeOffset ?? { x: 0, y: 0 }
      const nextEnemy = {
        ...enemy,
        homeOffset: {
          x: currentHome.x + (desiredOffset.x - currentHome.x) * homingFactor,
          y: currentHome.y + (desiredOffset.y - currentHome.y) * homingFactor,
        },
      }

      if (
        !nextEnemy.hasDamaged &&
        previousDistance > config.CRAFT_PLANE_DISTANCE &&
        distanceAhead <= config.CRAFT_PLANE_DISTANCE
      ) {
        const contactPosition = enemyPositionAtDistance(
          nextEnemy,
          config.CRAFT_PLANE_DISTANCE,
          elapsed,
          config,
        )
        const dx = contactPosition.x - craftPosition.x
        const dy = contactPosition.y - craftPosition.y
        const contactRadius = config.CRAFT_HIT_RADIUS + config.ENEMY_HIT_RADIUS
        if (dx * dx + dy * dy <= contactRadius * contactRadius) incomingHits += 1
        nextEnemy.hasDamaged = true
        nextEnemy.state = 'passed'
      }

      return nextEnemy
    })
    .filter((enemy) => enemy.routeZ - travelDistance >= -config.ENEMY_PASS_CLEANUP_DISTANCE)

  const damage = absorbHits(state, incomingHits)
  return {
    ...state,
    phase: damage.hp <= 0 ? 'overwhelmed' : 'running',
    elapsed,
    travelDistance,
    nextSpawnAt,
    wavesSpawned,
    nextId,
    seed,
    ...damage,
    craftPosition,
    diving,
    enemies,
  }
}

function advanceBossRun(state, delta, config, controls) {
  const craftPosition = normalizedCraftPosition(controls, config)
  const advanced = advanceBoss(state.boss, delta, config, craftPosition)
  const damage = absorbHits(state, advanced.attacks)
  const defeated = Boolean(advanced.boss?.defeated)
  const phase = damage.hp <= 0 ? 'overwhelmed' : defeated ? 'victory' : 'boss'

  return {
    ...state,
    phase,
    elapsed: state.elapsed + delta,
    ...damage,
    craftPosition,
    diving: false,
    boss: advanced.boss,
    bossRewardGranted: state.bossRewardGranted || defeated,
  }
}

export function advanceRun(state, deltaSeconds, config = APPARATUS_CONFIG, controls = {}) {
  if (!isCombatPhase(state)) return state

  const delta = Math.max(0, Math.min(deltaSeconds, 0.05))
  if (state.phase === 'boss') return advanceBossRun(state, delta, config, controls)
  return advanceOrdinaryRun(state, delta, config, controls)
}

function shootOrdinaryEnemy(state, enemyId) {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId)
  if (!enemy) return state

  const difficulty = difficultyFor(state.difficultyLevel)
  const accumulatedYield = (state.resourceRemainder ?? 0) + difficulty.resourceMultiplier
  const recoveredShapes = Math.max(1, Math.floor(accumulatedYield + 0.0000001))
  const resourceRemainder = accumulatedYield - recoveredShapes

  return {
    ...state,
    kills: state.kills + 1,
    resourceRemainder,
    shapeDrops: {
      ...state.shapeDrops,
      [enemy.pattern]: (state.shapeDrops?.[enemy.pattern] ?? 0) + recoveredShapes,
    },
    enemies: state.enemies.filter((candidate) => candidate.id !== enemyId),
  }
}

export function shootTarget(state, targetId) {
  if (!isCombatPhase(state) || !targetId) return state

  if (state.phase === 'running') return shootOrdinaryEnemy(state, targetId)

  const result = destroyBossTarget(state.boss, targetId)
  if (!result.changed) return state

  return {
    ...state,
    phase: result.defeated ? 'victory' : 'boss',
    boss: result.boss,
    bossPiecesDestroyed: state.bossPiecesDestroyed + 1,
    bossTentaclesDestroyed:
      state.bossTentaclesDestroyed + (result.tentacleDestroyed ? 1 : 0),
    bossRewardGranted: state.bossRewardGranted || result.defeated,
  }
}

export function shootEnemy(state, enemyId) {
  return shootTarget(state, enemyId)
}

export function shapePayout(state, config = APPARATUS_CONFIG) {
  const payout = { ...emptyShapeInventory(), ...state.shapeDrops }
  if (!state.bossRewardGranted) return payout

  const difficulty = difficultyFor(state.difficultyLevel)
  for (const [shape, amount] of Object.entries(config.BOSS_REWARD)) {
    const scaledAmount = Math.max(amount, Math.round(amount * difficulty.resourceMultiplier))
    payout[shape] = (payout[shape] ?? 0) + scaledAmount
  }
  return payout
}
