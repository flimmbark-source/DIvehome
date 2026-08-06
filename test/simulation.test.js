import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceRun,
  createRun,
  shapePayout,
  shootEnemy,
  shootTarget,
  spawnIntervalAt,
  waveSizeAt,
} from '../src/game/simulation.js'
import { APPARATUS_CONFIG } from '../src/game/config.js'
import { createBoss, tentacleSegmentPosition } from '../src/game/boss.js'

function advanceFor(run, seconds, config = APPARATUS_CONFIG, controls = {}) {
  let current = run
  let remaining = seconds
  while (remaining > 0) {
    const delta = Math.min(0.05, remaining)
    current = advanceRun(current, delta, config, controls)
    remaining -= delta
  }
  return current
}

function enemyAt(distance, overrides = {}) {
  return {
    id: 'enemy-test',
    pattern: 'drift',
    routeZ: distance,
    offset: { x: 0, y: 0 },
    homeOffset: { x: 0, y: 0 },
    phase: 0,
    state: 'approaching',
    hasDamaged: false,
    ...overrides,
  }
}

test('a direct craft contact damages once while the enemy continues past', () => {
  const run = {
    ...createRun(1),
    nextSpawnAt: 999,
    enemies: [enemyAt(APPARATUS_CONFIG.CRAFT_PLANE_DISTANCE + 0.1)],
  }

  const crossed = advanceRun(run, 0.05, APPARATUS_CONFIG, {
    craftPosition: { x: 0, y: 0 },
  })
  assert.equal(crossed.hp, APPARATUS_CONFIG.STARTING_HP - 1)
  assert.equal(crossed.enemies[0].state, 'passed')
  assert.ok(crossed.enemies[0].routeZ - crossed.travelDistance < APPARATUS_CONFIG.CRAFT_PLANE_DISTANCE)

  const fartherPast = advanceRun(crossed, 0.05, APPARATUS_CONFIG, {
    craftPosition: { x: 0, y: 0 },
  })
  assert.equal(fartherPast.hp, crossed.hp)
  assert.equal(fartherPast.hitsTaken, 1)
})

test('an enemy that misses the craft passes without causing damage', () => {
  const run = {
    ...createRun(1),
    nextSpawnAt: 999,
    enemies: [enemyAt(APPARATUS_CONFIG.CRAFT_PLANE_DISTANCE + 0.1, { offset: { x: 0.75, y: 0.75 } })],
  }

  const crossed = advanceRun(run, 0.05, APPARATUS_CONFIG, {
    craftPosition: { x: -APPARATUS_CONFIG.CRAFT_MAX_X, y: -APPARATUS_CONFIG.CRAFT_MAX_Y },
  })
  assert.equal(crossed.hp, APPARATUS_CONFIG.STARTING_HP)
  assert.equal(crossed.enemies[0].state, 'passed')
})

test('a prepared shield blocks one actual craft collision', () => {
  const run = {
    ...createRun(1, APPARATUS_CONFIG, { startingShield: 1 }),
    nextSpawnAt: 999,
    enemies: [enemyAt(APPARATUS_CONFIG.CRAFT_PLANE_DISTANCE + 0.1, { pattern: 'drift' })],
  }

  const crossed = advanceRun(run, 0.05, APPARATUS_CONFIG, {
    craftPosition: { x: 0, y: 0 },
  })
  assert.equal(crossed.hp, APPARATUS_CONFIG.STARTING_HP)
  assert.equal(crossed.shield, 0)
  assert.equal(crossed.blocks, 1)
})

test('nearby enemies bias their path toward the craft', () => {
  const run = {
    ...createRun(1),
    nextSpawnAt: 999,
    enemies: [enemyAt(18, { offset: { x: -0.5, y: 0 } })],
  }
  const advanced = advanceRun(run, 0.05, APPARATUS_CONFIG, {
    craftPosition: { x: APPARATUS_CONFIG.CRAFT_MAX_X, y: 0 },
  })
  assert.ok(advanced.enemies[0].homeOffset.x > 0)
})

test('holding dive accelerates elapsed time, travel, and spawning together', () => {
  const config = {
    ...APPARATUS_CONFIG,
    FIRST_WAVE_AT: 0.1,
    INITIAL_WAVE_INTERVAL: 99,
    MIN_WAVE_INTERVAL: 99,
    WAVE_INTERVAL_RAMP_PER_SECOND: 0,
  }
  const normal = advanceRun(createRun(1, config), 0.05, config, { diving: false })
  const diving = advanceRun(createRun(1, config), 0.05, config, { diving: true })

  assert.equal(diving.elapsed, normal.elapsed * config.DIVE_TIME_SCALE)
  assert.equal(diving.travelDistance, normal.travelDistance * config.DIVE_TIME_SCALE)
  assert.equal(normal.wavesSpawned, 0)
  assert.equal(diving.wavesSpawned, 1)
})

test('shooting collects the exact enemy shape', () => {
  const run = {
    ...createRun(1),
    enemies: [enemyAt(20, { pattern: 'corkscrew' })],
  }

  const shot = shootEnemy(run, 'enemy-test')
  assert.equal(shot.kills, 1)
  assert.equal(shot.enemies.length, 0)
  assert.equal(shapePayout(shot).corkscrew, 1)
  assert.equal(shapePayout(shot).drift, 0)
})

test('the tunnel escalates from singles into two, three, and four-enemy waves', () => {
  assert.equal(waveSizeAt(0), 1)
  assert.equal(waveSizeAt(APPARATUS_CONFIG.OPENING_WAVE_SECONDS - 0.01), 1)
  assert.equal(waveSizeAt(APPARATUS_CONFIG.OPENING_WAVE_SECONDS), 2)
  assert.equal(
    waveSizeAt(APPARATUS_CONFIG.OPENING_WAVE_SECONDS + APPARATUS_CONFIG.WAVE_SIZE_RAMP_SECONDS),
    3,
  )
  assert.equal(
    waveSizeAt(APPARATUS_CONFIG.OPENING_WAVE_SECONDS + APPARATUS_CONFIG.WAVE_SIZE_RAMP_SECONDS * 2),
    4,
  )
  assert.equal(waveSizeAt(APPARATUS_CONFIG.ROUND_SECONDS - 1), APPARATUS_CONFIG.MAX_WAVE_SIZE)
})

test('wave intervals tighten after the opening without exceeding the minimum', () => {
  const openingInterval = spawnIntervalAt(0)
  const middleInterval = spawnIntervalAt(APPARATUS_CONFIG.ROUND_SECONDS / 2)
  const lateInterval = spawnIntervalAt(APPARATUS_CONFIG.ROUND_SECONDS * 2)

  assert.ok(middleInterval < openingInterval)
  assert.equal(lateInterval, APPARATUS_CONFIG.MIN_WAVE_INTERVAL)
})

test('a wave event spawns its members together with one shared wave id', () => {
  const config = {
    ...APPARATUS_CONFIG,
    FIRST_WAVE_AT: 0.1,
    OPENING_WAVE_SECONDS: 0,
    WAVE_SIZE_RAMP_SECONDS: 999,
    MAX_WAVE_SIZE: 2,
    INITIAL_WAVE_INTERVAL: 99,
    MIN_WAVE_INTERVAL: 99,
    WAVE_INTERVAL_RAMP_PER_SECOND: 0,
    SPAWN_DISTANCE: 1000,
  }
  const run = advanceFor(createRun(7, config), 0.11, config)

  assert.equal(run.enemies.length, 2)
  assert.equal(run.wavesSpawned, 1)
  assert.equal(run.enemies[0].waveId, run.enemies[1].waveId)
  assert.equal(run.enemies[0].waveSize, 2)
  assert.equal(run.enemies[1].waveSize, 2)
  assert.ok(Math.abs(run.enemies[1].routeZ - run.enemies[0].routeZ) < 3)
})

test('the one-minute descent transitions into a clean boss encounter', () => {
  const run = {
    ...createRun(1),
    elapsed: APPARATUS_CONFIG.ROUND_SECONDS - 0.02,
    nextSpawnAt: 999,
    enemies: [enemyAt(50, { id: 'enemy-leftover' })],
  }

  const bossRun = advanceRun(run, 0.05)
  assert.equal(bossRun.phase, 'boss')
  assert.ok(bossRun.boss)
  assert.equal(bossRun.enemies.length, 0)
  assert.equal(bossRun.travelDistance > run.travelDistance, true)
})

test('a reaching boss tentacle only damages when its tip contacts the craft', () => {
  const boss = createBoss()
  const attackingBoss = {
    ...boss,
    elapsed: APPARATUS_CONFIG.BOSS_INTRO_SECONDS,
    tentacles: boss.tentacles.map((tentacle, index) =>
      index === 0
        ? { ...tentacle, extension: 0.999, cooldown: 0 }
        : { ...tentacle, cooldown: 999 },
    ),
  }
  const reachingTentacle = { ...attackingBoss.tentacles[0], extension: 1 }
  const tip = reachingTentacle.segments.filter((segment) => segment.alive).at(-1)
  const tipPosition = tentacleSegmentPosition(
    reachingTentacle,
    tip,
    { ...attackingBoss, elapsed: attackingBoss.elapsed + 0.05 },
  )
  const run = {
    ...createRun(1, APPARATUS_CONFIG, { startingShield: 1 }),
    phase: 'boss',
    boss: attackingBoss,
    enemies: [],
  }

  const attacked = advanceRun(run, 0.05, APPARATUS_CONFIG, {
    craftPosition: { x: tipPosition.x, y: tipPosition.y },
  })
  assert.equal(attacked.hp, APPARATUS_CONFIG.STARTING_HP)
  assert.equal(attacked.shield, 0)
  assert.equal(attacked.blocks, 1)
})

test('boss pieces do not create farmable drops and victory grants a fixed cache', () => {
  const boss = createBoss()
  const run = {
    ...createRun(1),
    phase: 'boss',
    boss: { ...boss, elapsed: APPARATUS_CONFIG.BOSS_INTRO_SECONDS },
    enemies: [],
  }

  const shot = shootTarget(run, boss.facePieces[0].id)
  assert.deepEqual(shapePayout(shot), shapePayout(run))

  const victory = { ...shot, phase: 'victory', bossRewardGranted: true }
  const payout = shapePayout(victory)
  assert.equal(payout.drift, APPARATUS_CONFIG.BOSS_REWARD.drift)
  assert.equal(payout.zigzag, APPARATUS_CONFIG.BOSS_REWARD.zigzag)
  assert.equal(payout.orbit, APPARATUS_CONFIG.BOSS_REWARD.orbit)
  assert.equal(payout.corkscrew, APPARATUS_CONFIG.BOSS_REWARD.corkscrew)
})
