export const FIRE_MODES = Object.freeze(['hitscan', 'projectile'])

export const FIRE_MODE_META = Object.freeze({
  hitscan: Object.freeze({
    id: 'hitscan',
    label: 'HITSCAN',
    color: '#7bffe0',
    description: 'One immediate ray. Precise, single-cycle fire with no projectile travel time.',
    roundsPerTrigger: 1,
  }),
  projectile: Object.freeze({
    id: 'projectile',
    label: 'PROJECTILE',
    color: '#ff9a56',
    description: 'Three physical rounds fire in sequence. Each round can home, pierce, or miss.',
    roundsPerTrigger: 3,
  }),
})

export function normalizeFireMode(mode) {
  return FIRE_MODES.includes(mode) ? mode : 'projectile'
}

export function fireModeFor(mode) {
  return FIRE_MODE_META[normalizeFireMode(mode)]
}

export function emptyWeaponState() {
  return { fireMode: 'projectile' }
}

export function setWeaponFireMode(progression, mode) {
  const fireMode = normalizeFireMode(mode)
  return {
    ...progression,
    weapon: {
      ...emptyWeaponState(),
      ...(progression.weapon ?? {}),
      fireMode,
    },
  }
}

export function roundsPerTrigger(mode) {
  return fireModeFor(mode).roundsPerTrigger
}
