import test from 'node:test'
import assert from 'node:assert/strict'
import { APPARATUS_CONFIG } from '../src/game/config.js'
import {
  activeTentacleCount,
  advanceBoss,
  bossRegenerationLabel,
  createBoss,
  destroyBossTarget,
  tentacleSegmentPosition,
} from '../src/game/boss.js'

function stepBoss(boss, seconds) {
  let current = boss
  let remaining = seconds
  while (remaining > 0) {
    const delta = Math.min(0.05, remaining)
    current = advanceBoss(current, delta).boss
    remaining -= delta
  }
  return current
}

function destroyTentacle(boss, tentacleIndex) {
  let current = boss
  const segmentIds = current.tentacles[tentacleIndex].segments.map((segment) => segment.id)
  for (const segmentId of segmentIds) {
    current = destroyBossTarget(current, segmentId).boss
  }
  return current
}

test('face pieces regenerate rapidly while all tentacles remain', () => {
  let boss = createBoss()
  boss = stepBoss(boss, APPARATUS_CONFIG.BOSS_INTRO_SECONDS)
  const pieceId = boss.facePieces[0].id
  boss = destroyBossTarget(boss, pieceId).boss
  assert.equal(boss.facePieces[0].active, false)
  assert.equal(bossRegenerationLabel(boss), 'RAPID')

  boss = stepBoss(boss, APPARATUS_CONFIG.BOSS_REGEN_INTERVALS[3] + 0.05)
  assert.equal(boss.facePieces[0].active, true)
})

test('destroying a whole tentacle permanently slows regeneration', () => {
  let boss = createBoss()
  boss = stepBoss(boss, APPARATUS_CONFIG.BOSS_INTRO_SECONDS)
  boss = destroyTentacle(boss, 0)
  assert.equal(activeTentacleCount(boss), 2)
  assert.equal(bossRegenerationLabel(boss), 'SLOWED')

  const pieceId = boss.facePieces[0].id
  boss = destroyBossTarget(boss, pieceId).boss
  boss = stepBoss(boss, APPARATUS_CONFIG.BOSS_REGEN_INTERVALS[3] + 0.03)
  assert.equal(boss.facePieces[0].active, false)

  boss = stepBoss(boss, APPARATUS_CONFIG.BOSS_REGEN_INTERVALS[2])
  assert.equal(boss.facePieces[0].active, true)
})

test('destroying every tentacle turns regeneration off', () => {
  let boss = createBoss()
  boss = stepBoss(boss, APPARATUS_CONFIG.BOSS_INTRO_SECONDS)
  for (let index = 0; index < boss.tentacles.length; index += 1) {
    boss = destroyTentacle(boss, index)
  }
  assert.equal(activeTentacleCount(boss), 0)
  assert.equal(bossRegenerationLabel(boss), 'OFF')

  const pieceId = boss.facePieces[0].id
  boss = destroyBossTarget(boss, pieceId).boss
  boss = stepBoss(boss, 4)
  assert.equal(boss.facePieces[0].active, false)
})

test('a damaged tentacle redistributes its surviving shapes to retain a visible attacking tip', () => {
  let boss = createBoss()
  const segmentIdsToDestroy = boss.tentacles[0].segments.slice(1).map((segment) => segment.id)
  for (const segmentId of segmentIdsToDestroy) {
    boss = destroyBossTarget(boss, segmentId).boss
  }

  const tentacle = { ...boss.tentacles[0], extension: 1 }
  const remainingSegment = tentacle.segments.find((segment) => segment.alive)
  const position = tentacleSegmentPosition(tentacle, remainingSegment, boss)
  assert.ok(Math.abs(position.z - APPARATUS_CONFIG.BOSS_TENTACLE_NEAR_Z) < 0.000001)
})

test('the boss is defeated only when every active face socket is destroyed', () => {
  let boss = createBoss()
  boss = stepBoss(boss, APPARATUS_CONFIG.BOSS_INTRO_SECONDS)
  let finalResult = null
  for (const piece of boss.facePieces) {
    finalResult = destroyBossTarget(boss, piece.id)
    boss = finalResult.boss
  }

  assert.equal(finalResult.defeated, true)
  assert.equal(boss.defeated, true)
  assert.equal(boss.facePieces.every((piece) => !piece.active), true)
})
