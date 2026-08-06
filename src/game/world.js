import { APPARATUS_CONFIG, tunnelAxisAt } from './config.js'
import { patternOffset } from './simulation.js'

export function enemyWorldPosition(enemy, run, config = APPARATUS_CONFIG) {
  const parked = enemy.state === 'parked'
  const distanceAhead = parked ? config.INTERACTION_DISTANCE : enemy.routeZ - run.travelDistance
  const offset = patternOffset(enemy, distanceAhead, run.elapsed)

  if (parked) {
    return {
      x: offset.x * config.TUBE_RADIUS,
      y: offset.y * config.TUBE_RADIUS,
      z: -config.INTERACTION_DISTANCE,
    }
  }

  const enemyAxis = tunnelAxisAt(enemy.routeZ, config)
  const currentAxis = tunnelAxisAt(run.travelDistance, config)
  return {
    x: enemyAxis.x - currentAxis.x + offset.x * config.TUBE_RADIUS,
    y: enemyAxis.y - currentAxis.y + offset.y * config.TUBE_RADIUS,
    z: -distanceAhead,
  }
}
