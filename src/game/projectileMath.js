export function segmentIntersectsSphere(start, end, center, radius) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dz = end.z - start.z
  const lengthSquared = Math.max(dx * dx + dy * dy + dz * dz, 0.000001)
  const toCenterX = center.x - start.x
  const toCenterY = center.y - start.y
  const toCenterZ = center.z - start.z
  const t = Math.max(
    0,
    Math.min(1, (toCenterX * dx + toCenterY * dy + toCenterZ * dz) / lengthSquared),
  )
  const closestX = start.x + dx * t
  const closestY = start.y + dy * t
  const closestZ = start.z + dz * t
  const offsetX = center.x - closestX
  const offsetY = center.y - closestY
  const offsetZ = center.z - closestZ
  return offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ <= radius * radius
}

export function raySphereIntersectionDistance(origin, direction, center, radius) {
  const toCenterX = center.x - origin.x
  const toCenterY = center.y - origin.y
  const toCenterZ = center.z - origin.z
  const projection =
    toCenterX * direction.x +
    toCenterY * direction.y +
    toCenterZ * direction.z
  const centerDistanceSquared =
    toCenterX * toCenterX +
    toCenterY * toCenterY +
    toCenterZ * toCenterZ
  const perpendicularSquared = centerDistanceSquared - projection * projection
  const radiusSquared = radius * radius
  if (perpendicularSquared > radiusSquared) return null

  const offset = Math.sqrt(Math.max(0, radiusSquared - perpendicularSquared))
  const nearDistance = projection - offset
  const farDistance = projection + offset
  if (farDistance < 0) return null
  return nearDistance >= 0 ? nearDistance : farDistance
}
