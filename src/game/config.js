export const APPARATUS_CONFIG = Object.freeze({
  STARTING_HP: 6,
  TRAVEL_SPEED: 9,
  INTERACTION_DISTANCE: 8,
  APPROACHING_DISTANCE: 54,
  SPAWN_DISTANCE: 58,

  // The opening remains readable, then the tunnel switches to increasingly
  // dense waves. Wave members are clustered in depth so they reach the player
  // as a group instead of behaving like unrelated single spawns.
  FIRST_WAVE_AT: 0.65,
  OPENING_WAVE_SECONDS: 6,
  INITIAL_WAVE_INTERVAL: 2.35,
  MIN_WAVE_INTERVAL: 1.7,
  WAVE_INTERVAL_RAMP_PER_SECOND: 0.012,
  WAVE_SIZE_RAMP_SECONDS: 14,
  MAX_WAVE_SIZE: 4,
  WAVE_DEPTH_SPACING: 0.72,
  WAVE_DEPTH_JITTER: 1.15,

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

  // The ordinary descent lasts one minute. At that point normal spawning ends,
  // travel stops, and the shape-face boss assembles at the end of the tunnel.
  ROUND_SECONDS: 60,
  BOSS_INTRO_SECONDS: 1.35,
  BOSS_FACE_Z: -38,
  BOSS_FACE_SPACING: 0.72,
  BOSS_FACE_PIECE_RADIUS: 0.46,
  BOSS_TENTACLE_COUNT: 3,
  BOSS_TENTACLE_SEGMENTS: 8,
  BOSS_TENTACLE_NEAR_Z: -2.8,
  BOSS_TENTACLE_TRAVEL_SECONDS: 4.2,
  BOSS_TENTACLE_COOLDOWN_SECONDS: 1.1,
  BOSS_TENTACLE_PIECE_RADIUS: 0.5,
  BOSS_REGEN_INTERVALS: Object.freeze({
    3: 0.22,
    2: 0.52,
    1: 1.15,
    0: Number.POSITIVE_INFINITY,
  }),
  BOSS_REWARD: Object.freeze({
    drift: 2,
    zigzag: 2,
    orbit: 2,
    corkscrew: 2,
  }),
})

export const ENEMY_PATTERNS = Object.freeze(['drift', 'zigzag', 'orbit', 'corkscrew'])

export function tunnelAxisAt(depth, config = APPARATUS_CONFIG) {
  const t = depth * config.UNDULATION_FREQ
  return {
    x: Math.sin(t) * config.UNDULATION_X,
    y: Math.cos(t * 0.73) * config.UNDULATION_Y,
  }
}
