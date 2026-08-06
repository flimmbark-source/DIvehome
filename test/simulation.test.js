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
import { createBoss } from '../src/game/boss.js'

function advanceFor(run, seconds, config = APPARATUS_CONFIG) {
  let current = run
  let remaining = seconds
  while (remaining > 0) {
    const delta = Math.min(0.05, remaining)
    current = advanceRun(current, delta, config)
    remaining -= delta
  }
  return current
}

test('an enemy damages once when it reaches the plane, then stays parked', () => {
  const run = {
    ...createRun(1),
    nextSpawnAt: 999,
    enemies: [
      {
        id: 'enemy-test',
        pattern: 'drift',
        routeZ: APPARATUS_CONFIG.INTERACTION_DISTANCE + 0.01,
        offset: { x: 0, y: 0 },
        phase: 0,
        state: 'approaching',
        hasDamaged: false,
        parkedOffset: null,
      },
    ],
  }

  const arrived = advanceRun(run, 0.05)
  assert.equal(arrived.hp, APPARATUS_CONFIG.STARTING_HP - 1)
  assert.equal(arrived.enemies[0].state, 'parked')

  const stillParked = advanceRun(arrived, 0.05)
  assert.equal(stillParked.hp, arrived.hp)
  assert.equal(stillParked.hitsTaken, 1)
})

test('a prepared shield blocks one arrival without losing hp', () => {
  const run = {
    ...createRun(1, APPARATUS_CONFIG, { startingShield: 1 }),
    nextSpawnAt: 999,
    enemies: [
      {
        id: 'enemy-test',
        pattern: 'orbit',
        routeZ: APPARATUS_CONFIG.INTERACTION_DISTANCE + 0.01,
        offset: { x: 0, y: 0 },
        phase: 0,
        state: 'approaching',
        hasDamaged: false,
        parkedOffset: null,
      },
    ],
  }

  const arrived = advanceRun(run, 0.05)
  assert.equal(arrived.hp, APPARATUS_CONFIG.STARTING_HP)
  assert.equal(arrived.shield, 0)
  assert.equal(arrived.blocks, 1)
})

test('shooting collects the exact enemy shape', () => {
  const run = {
    ...createRun(1),
    enemies: [
      {
        id: 'enemy-test',
        pattern: 'corkscrew',
        routeZ: 20,
        offset: { x: 0, y: 0 },
        phase: 0,
        state: 'approaching',
        hasDamaged: false,
        parkedOffset: null,
      },
    ],
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
    enemies: [
      {
        id: 'enemy-leftover',
        pattern: 'drift',
        routeZ: 50,
        offset: { x: 0, y: 0 },
        phase: 0,
        state: 'approaching',
        hasDamaged: false,
        parkedOffset: null,
      },
    ],
  }

  const bossRun = advanceRun(run, 0.05)
  assert.equal(bossRun.phase, 'boss')
  assert.ok(bossRun.boss)
  assert.equal(bossRun.enemies.length, 0)
  assert.equal(bossRun.travelDistance > run.travelDistance, true)
})

test('a reaching boss tentacle uses the same shield and integrity rules', () => {
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
  const run = {
    ...createRun(1, APPARATUS_CONFIG, { startingShield: 1 }),
    phase: 'boss',
    boss: attackingBoss,
    enemies: [],
  }

  const attacked = advanceRun(run, 0.05)
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
