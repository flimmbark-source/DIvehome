import test from 'node:test'
import assert from 'node:assert/strict'
import {
  craftFurniture,
  emptyFuelState,
  emptyFurnitureState,
  emptyShapeInventory,
  loadFurnitureFuel,
  prepareRunFromFurniture,
} from '../src/game/progression.js'
import { emptyWeaponState, setWeaponFireMode } from '../src/game/weapon.js'

function progression(inventory = {}) {
  return {
    inventory: { ...emptyShapeInventory(), ...inventory },
    built: emptyFurnitureState(),
    fuel: emptyFuelState(),
    weapon: emptyWeaponState(),
    mechanismUnlocked: true,
  }
}

test('crafting deducts shape costs and builds the object', () => {
  const crafted = craftFurniture(progression({ drift: 2, zigzag: 1 }), 'toaster')
  assert.equal(crafted.built.toaster, true)
  assert.equal(crafted.inventory.drift, 0)
  assert.equal(crafted.inventory.zigzag, 0)
})

test('loaded furniture fuel is consumed into the next run loadout', () => {
  let state = craftFurniture(progression({ drift: 3, zigzag: 1 }), 'toaster')
  state = loadFurnitureFuel(state, 'toaster', 'drift')
  assert.equal(state.inventory.drift, 0)
  assert.equal(state.fuel.toaster, 'drift')

  const prepared = prepareRunFromFurniture(state)
  assert.equal(prepared.loadout.maxHpBonus, 2)
  assert.equal(prepared.progression.fuel.toaster, null)
})

test('gun mode persists while workbench tooling is consumed into the run', () => {
  let state = progression({ orbit: 3, corkscrew: 1 })
  state = craftFurniture(state, 'workbench')
  state = loadFurnitureFuel(state, 'workbench', 'orbit')
  state = setWeaponFireMode(state, 'hitscan')

  const prepared = prepareRunFromFurniture(state)
  assert.equal(prepared.loadout.fireMode, 'hitscan')
  assert.equal(prepared.loadout.toolingShape, 'orbit')
  assert.equal(prepared.loadout.homingStrength, 3.6)
  assert.equal(prepared.progression.weapon.fireMode, 'hitscan')
  assert.equal(prepared.progression.fuel.workbench, null)
})
