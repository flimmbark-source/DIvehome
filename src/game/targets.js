import { APPARATUS_CONFIG } from './config.js'
import { bossCombatTargets } from './boss.js'
import { enemyWorldPosition } from './world.js'

export function combatTargets(run, config = APPARATUS_CONFIG) {
  const targets = run.enemies
    .filter((enemy) => enemy.routeZ - run.travelDistance > config.CRAFT_PLANE_DISTANCE)
    .map((enemy) => ({
      id: enemy.id,
      type: 'enemy',
      pattern: enemy.pattern,
      position: enemyWorldPosition(enemy, run),
      hitRadius: config.ENEMY_HIT_RADIUS,
    }))

  if (run.phase === 'boss' && run.boss) {
    targets.push(...bossCombatTargets(run.boss, config))
  }

  return targets
}
