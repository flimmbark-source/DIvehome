import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fireModeFor,
  normalizeFireMode,
  roundsPerTrigger,
  setWeaponFireMode,
} from '../src/game/weapon.js'

test('projectile mode is the safe default and fires three rounds', () => {
  assert.equal(normalizeFireMode('unknown'), 'projectile')
  assert.equal(roundsPerTrigger('projectile'), 3)
  assert.equal(fireModeFor('projectile').label, 'PROJECTILE')
})

test('hitscan mode fires one immediate round', () => {
  assert.equal(roundsPerTrigger('hitscan'), 1)
  assert.equal(fireModeFor('hitscan').label, 'HITSCAN')
})

test('changing fire mode preserves the rest of progression', () => {
  const progression = {
    inventory: { drift: 4 },
    weapon: { fireMode: 'projectile' },
  }
  const next = setWeaponFireMode(progression, 'hitscan')
  assert.equal(next.weapon.fireMode, 'hitscan')
  assert.equal(next.inventory.drift, 4)
})
