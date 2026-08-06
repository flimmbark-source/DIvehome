export const SHAPE_KEYS = Object.freeze(['drift', 'zigzag', 'orbit', 'corkscrew'])

export const SHAPE_META = Object.freeze({
  drift: Object.freeze({ label: 'ICOSA', symbol: '◆', color: '#f0e4bf' }),
  zigzag: Object.freeze({ label: 'CONE', symbol: '▲', color: '#ff766e' }),
  orbit: Object.freeze({ label: 'TETRA', symbol: '△', color: '#83d7ff' }),
  corkscrew: Object.freeze({ label: 'OCTA', symbol: '◇', color: '#d790ff' }),
})

export const FURNITURE_RECIPES = Object.freeze({
  toaster: Object.freeze({
    id: 'toaster',
    label: 'TOASTER',
    category: 'APPLIANCE',
    description: 'Consumes one loaded shape when a run begins and converts it into a body or reload effect.',
    cost: Object.freeze({ drift: 2, zigzag: 1 }),
  }),
  workbench: Object.freeze({
    id: 'workbench',
    label: 'WORKBENCH',
    category: 'FURNITURE',
    description: 'Consumes one loaded shape when a run begins and changes the projectile itself.',
    cost: Object.freeze({ orbit: 2, corkscrew: 1 }),
  }),
})

export function emptyShapeInventory() {
  return Object.fromEntries(SHAPE_KEYS.map((key) => [key, 0]))
}

export function emptyFurnitureState() {
  return Object.fromEntries(Object.keys(FURNITURE_RECIPES).map((key) => [key, false]))
}

export function emptyFuelState() {
  return Object.fromEntries(Object.keys(FURNITURE_RECIPES).map((key) => [key, null]))
}

export function totalShapes(inventory) {
  return SHAPE_KEYS.reduce((total, key) => total + (inventory?.[key] ?? 0), 0)
}

export function addShapeDrops(inventory, drops) {
  const next = { ...emptyShapeInventory(), ...inventory }
  for (const key of SHAPE_KEYS) next[key] += Math.max(0, drops?.[key] ?? 0)
  return next
}

export function canAffordRecipe(inventory, recipeId) {
  const recipe = FURNITURE_RECIPES[recipeId]
  if (!recipe) return false
  return Object.entries(recipe.cost).every(([shape, amount]) => (inventory?.[shape] ?? 0) >= amount)
}

export function craftFurniture(progression, recipeId) {
  const recipe = FURNITURE_RECIPES[recipeId]
  if (!recipe || progression.built?.[recipeId] || !canAffordRecipe(progression.inventory, recipeId)) {
    return progression
  }

  const inventory = { ...progression.inventory }
  for (const [shape, amount] of Object.entries(recipe.cost)) inventory[shape] -= amount

  return {
    ...progression,
    inventory,
    built: { ...progression.built, [recipeId]: true },
  }
}

export function loadFurnitureFuel(progression, furnitureId, shapeKey) {
  if (!progression.built?.[furnitureId] || !SHAPE_KEYS.includes(shapeKey)) return progression
  const previous = progression.fuel?.[furnitureId] ?? null
  if (previous === shapeKey || (progression.inventory?.[shapeKey] ?? 0) <= 0) return progression

  const inventory = { ...progression.inventory }
  if (previous) inventory[previous] += 1
  inventory[shapeKey] -= 1

  return {
    ...progression,
    inventory,
    fuel: { ...progression.fuel, [furnitureId]: shapeKey },
  }
}

export function unloadFurnitureFuel(progression, furnitureId) {
  const previous = progression.fuel?.[furnitureId] ?? null
  if (!previous) return progression
  return {
    ...progression,
    inventory: {
      ...progression.inventory,
      [previous]: (progression.inventory?.[previous] ?? 0) + 1,
    },
    fuel: { ...progression.fuel, [furnitureId]: null },
  }
}

function baseLoadout() {
  return {
    maxHpBonus: 0,
    startingShield: 0,
    reloadMultiplier: 1,
    projectileSpeedMultiplier: 1,
    projectileRadiusMultiplier: 1,
    projectilePierceBonus: 0,
    homingStrength: 0,
    effects: [],
  }
}

function applyToaster(loadout, shape) {
  switch (shape) {
    case 'drift':
      loadout.maxHpBonus += 2
      loadout.effects.push('ICOSA TOAST: +2 INTEGRITY')
      break
    case 'zigzag':
      loadout.reloadMultiplier *= 0.72
      loadout.effects.push('CONE TOAST: FASTER RELOAD')
      break
    case 'orbit':
      loadout.startingShield += 1
      loadout.effects.push('TETRA TOAST: BLOCK FIRST HIT')
      break
    case 'corkscrew':
      loadout.maxHpBonus += 1
      loadout.reloadMultiplier *= 0.88
      loadout.effects.push('OCTA TOAST: +1 INTEGRITY, QUICKER RELOAD')
      break
    default:
      break
  }
}

function applyWorkbench(loadout, shape) {
  switch (shape) {
    case 'drift':
      loadout.projectileRadiusMultiplier *= 1.65
      loadout.effects.push('ICOSA TOOLING: LARGER PROJECTILE')
      break
    case 'zigzag':
      loadout.projectileSpeedMultiplier *= 1.5
      loadout.effects.push('CONE TOOLING: FASTER PROJECTILE')
      break
    case 'orbit':
      loadout.homingStrength += 3.6
      loadout.effects.push('TETRA TOOLING: GUIDED PROJECTILE')
      break
    case 'corkscrew':
      loadout.projectilePierceBonus += 1
      loadout.effects.push('OCTA TOOLING: PIERCE ONE TARGET')
      break
    default:
      break
  }
}

export function prepareRunFromFurniture(progression) {
  const loadout = baseLoadout()
  const consumed = []

  for (const [furnitureId, shape] of Object.entries(progression.fuel ?? {})) {
    if (!shape || !progression.built?.[furnitureId]) continue
    consumed.push({ furnitureId, shape })
    if (furnitureId === 'toaster') applyToaster(loadout, shape)
    if (furnitureId === 'workbench') applyWorkbench(loadout, shape)
  }

  return {
    loadout,
    progression: {
      ...progression,
      fuel: emptyFuelState(),
    },
    consumed,
  }
}
