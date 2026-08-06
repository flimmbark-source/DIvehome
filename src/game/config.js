export const APPARATUS_CONFIG = Object.freeze({
  STARTING_HP: 6,
  TRAVEL_SPEED: 9,
  INTERACTION_DISTANCE: 8,
  APPROACHING_DISTANCE: 54,
  SPAWN_DISTANCE: 58,
  INITIAL_SPAWN_INTERVAL: 1.55,
  MIN_SPAWN_INTERVAL: 0.42,
  SPAWN_RAMP_PER_SECOND: 0.015,
  MAX_OFFSET: 0.76,
  TUBE_RADIUS: 4.8,
  RING_SPACING: 4,
  RING_COUNT: 30,
  UNDULATION_X: 1.45,
  UNDULATION_Y: 1.05,
  UNDULATION_FREQ: 0.05,
  TWIST_PER_UNIT: 0.017,
  RELOAD_SECONDS: 0.78,
  PROJECTILE_SPEED: 42,
  PROJECTILE_RADIUS: 0.18,
  PROJECTILE_MAX_AGE: 2.2,
  ENEMY_HIT_RADIUS: 0.86,
})

export const ENEMY_PATTERNS = Object.freeze(['drift', 'zigzag', 'orbit', 'corkscrew'])

export function tunnelAxisAt(depth, config = APPARATUS_CONFIG) {
  const t = depth * config.UNDULATION_FREQ
  return {
    x: Math.sin(t) * config.UNDULATION_X,
    y: Math.cos(t * 0.73) * config.UNDULATION_Y,
  }
}
