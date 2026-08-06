import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceRun, createRun, shapePayout, shootEnemy } from '../src/game/simulation.js'
import { APPARATUS_CONFIG } from '../src/game/config.js'

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
