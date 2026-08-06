import test from 'node:test'
import assert from 'node:assert/strict'
import { APPARATUS_CONFIG } from '../src/game/config.js'
import { advanceBoss, createBoss } from '../src/game/boss.js'
import { difficultyFor, normalizeDifficultyLevel } from '../src/game/difficulty.js'
import {
  createRun,
  shapePayout,
  shootTarget,
  spawnIntervalAt,
  waveSizeAt,
} from '../src/game/simulation.js'

function enemy(id, pattern = 'drift') {
  return {
    id,
    pattern,
    routeZ: 40,
    offset: { x: 0, y: 0 },
    phase: 0,
    state: 'approaching',
    hasDamaged: false,
    parkedOffset: null,
  }
}

function collectKills(level, count) {
  let run = createRun(1, APPARATUS_CONFIG, { difficultyLevel: level })
  for (let index = 0; index < count; index += 1) {
    const target = enemy(`enemy-${index}`)
    run = { ...run, enemies: [...run.enemies, target] }
    run = shootTarget(run, target.id)
  }
  return run
}

test('difficulty levels normalize to the supported range', () => {
  assert.equal(normalizeDifficultyLevel(-20), 0)
  assert.equal(normalizeDifficultyLevel(2.4), 2)
  assert.equal(normalizeDifficultyLevel(99), 3)
  assert.equal(difficultyFor('not-a-number').level, 0)
})

test('difficulty zero preserves the current wave schedule exactly', () => {
  const elapsed = APPARATUS_CONFIG.OPENING_WAVE_SECONDS + 1
  assert.equal(
    spawnIntervalAt(elapsed, APPARATUS_CONFIG, 0),
    Math.max(
      APPARATUS_CONFIG.MIN_WAVE_INTERVAL,
      APPARATUS_CONFIG.INITIAL_WAVE_INTERVAL -
        elapsed * APPARATUS_CONFIG.WAVE_INTERVAL_RAMP_PER_SECOND,
    ),
  )
  assert.equal(waveSizeAt(elapsed, APPARATUS_CONFIG, 0), 2)
  assert.equal(waveSizeAt(APPARATUS_CONFIG.ROUND_SECONDS - 1, APPARATUS_CONFIG, 0), 4)
})

test('the readable opening remains a single enemy at every difficulty', () => {
  for (let level = 0; level <= 3; level += 1) {
    assert.equal(waveSizeAt(APPARATUS_CONFIG.OPENING_WAVE_SECONDS - 0.01, APPARATUS_CONFIG, level), 1)
  }
})

test('higher difficulty adds wave members and shortens wave intervals', () => {
  const elapsed = APPARATUS_CONFIG.OPENING_WAVE_SECONDS + 1
  assert.equal(waveSizeAt(elapsed, APPARATUS_CONFIG, 1), 3)
  assert.equal(waveSizeAt(elapsed, APPARATUS_CONFIG, 2), 4)
  assert.equal(waveSizeAt(elapsed, APPARATUS_CONFIG, 3), 5)
  assert.ok(spawnIntervalAt(elapsed, APPARATUS_CONFIG, 3) < spawnIntervalAt(elapsed, APPARATUS_CONFIG, 0))
})

test('fractional difficulty yield accumulates deterministically on the killed shape', () => {
  assert.equal(shapePayout(collectKills(0, 4)).drift, 4)
  assert.equal(shapePayout(collectKills(1, 4)).drift, 5)
  assert.equal(shapePayout(collectKills(2, 4)).drift, 6)
  assert.equal(shapePayout(collectKills(3, 4)).drift, 8)
})

test('boss cache scales once without making boss pieces farmable', () => {
  const base = { ...createRun(1, APPARATUS_CONFIG, { difficultyLevel: 0 }), bossRewardGranted: true }
  const maximum = { ...createRun(1, APPARATUS_CONFIG, { difficultyLevel: 3 }), bossRewardGranted: true }
  assert.equal(shapePayout(base).drift, 2)
  assert.equal(shapePayout(maximum).drift, 4)
})

test('higher difficulty advances boss tentacles faster', () => {
  const baseBoss = createBoss(APPARATUS_CONFIG, 0)
  const hardBoss = createBoss(APPARATUS_CONFIG, 3)
  const prepare = (boss) => ({
    ...boss,
    elapsed: APPARATUS_CONFIG.BOSS_INTRO_SECONDS,
    tentacles: boss.tentacles.map((tentacle, index) =>
      index === 0 ? { ...tentacle, cooldown: 0, extension: 0.25 } : { ...tentacle, cooldown: 999 },
    ),
  })

  const baseAdvanced = advanceBoss(prepare(baseBoss), 0.05).boss
  const hardAdvanced = advanceBoss(prepare(hardBoss), 0.05).boss
  assert.ok(hardAdvanced.tentacles[0].extension > baseAdvanced.tentacles[0].extension)
})
