import { APPARATUS_CONFIG, tunnelAxisAt } from './config.js'
import { patternOffset } from './simulation.js'

export function enemyWorldPosition(enemy, run, config = APPARATUS_CONFIG) {
  const distanceAhead = enemy.routeZ - run.travelDistance
  const offset = patternOffset(enemy, distanceAhead, run.elapsed)
  const enemyAxis = tunnelAxisAt(enemy.routeZ, config)
  const currentAxis = tunnelAxisAt(run.travelDistance, config)
  return {
    x: enemyAxis.x - currentAxis.x + offset.x * config.TUBE_RADIUS,
    y: enemyAxis.y - currentAxis.y + offset.y * config.TUBE_RADIUS,
    z: -distanceAhead,
  }
}
