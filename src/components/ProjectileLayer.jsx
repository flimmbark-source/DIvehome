import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { APPARATUS_CONFIG } from '../game/config.js'
import {
  raySphereIntersectionDistance,
  segmentIntersectsSphere,
} from '../game/projectileMath.js'
import { isCombatPhase } from '../game/simulation.js'
import { combatTargets } from '../game/targets.js'
import { normalizeFireMode } from '../game/weapon.js'

const FORWARD = new THREE.Vector3(0, 0, -1)
const UP = new THREE.Vector3(0, 1, 0)
const FAR_AIM_DEPTH = 1
const HITSCAN_RANGE = 84

function targetDistanceSquared(target, point) {
  const dx = target.position.x - point.x
  const dy = target.position.y - point.y
  const dz = target.position.z - point.z
  return dx * dx + dy * dy + dz * dz
}

function ProjectileVisual({ projectileId, projectilesRef, meshRefs }) {
  const projectile = projectilesRef.current.get(projectileId)
  const radius = projectile?.radius ?? APPARATUS_CONFIG.PROJECTILE_RADIUS
  return (
    <group
      ref={(node) => {
        if (node) meshRefs.current.set(projectileId, node)
        else meshRefs.current.delete(projectileId)
      }}
    >
      <mesh>
        <octahedronGeometry args={[radius * 1.2, 0]} />
        <meshBasicMaterial color="#fff4b2" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, radius * 2.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.2, radius * 0.75, radius * 4.8, 5]} />
        <meshBasicMaterial color="#ff8e45" transparent opacity={0.72} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

function HitscanTracerVisual({ tracerId, tracersRef }) {
  const tracer = tracersRef.current.get(tracerId)
  const transform = useMemo(() => {
    if (!tracer) return null
    const direction = tracer.end.clone().sub(tracer.start)
    const length = direction.length()
    const midpoint = tracer.start.clone().add(tracer.end).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize())
    return { length, midpoint, quaternion }
  }, [tracer])

  if (!tracer || !transform) return null
  return (
    <mesh position={transform.midpoint} quaternion={transform.quaternion} renderOrder={35}>
      <cylinderGeometry args={[0.022, 0.052, transform.length, 5]} />
      <meshBasicMaterial
        color="#7bffe0"
        transparent
        opacity={0.88}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export default function ProjectileLayer({ shotRequest, runRef, loadout, onHit }) {
  const { camera, size } = useThree()
  const projectilesRef = useRef(new Map())
  const meshRefs = useRef(new Map())
  const tracersRef = useRef(new Map())
  const [ids, setIds] = useState([])
  const [tracerIds, setTracerIds] = useState([])
  const lastShotRef = useRef(null)
  const nextIdRef = useRef(1)
  const nextTracerIdRef = useRef(1)
  const scratch = useMemo(
    () => ({
      muzzle: new THREE.Vector3(),
      target: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      targetPosition: new THREE.Vector3(),
      projected: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
    }),
    [],
  )

  useEffect(() => {
    if (!shotRequest || shotRequest.id === lastShotRef.current) return
    lastShotRef.current = shotRequest.id
    if (!isCombatPhase(runRef.current)) return

    const aim = shotRequest.aim
    const origin = shotRequest.origin
    if (
      origin &&
      Number.isFinite(origin.x) &&
      Number.isFinite(origin.y) &&
      Number.isFinite(origin.z)
    ) {
      scratch.muzzle.set(origin.x, origin.y, origin.z)
    } else {
      scratch.muzzle
        .set(0.42 + aim.x * 0.44, -0.42 + aim.y * 0.3, -1.62)
        .applyQuaternion(camera.quaternion)
        .add(camera.position)
    }

    scratch.target.set(aim.x, aim.y, FAR_AIM_DEPTH).unproject(camera)
    scratch.direction.copy(scratch.target).sub(scratch.muzzle).normalize()

    const fireMode = normalizeFireMode(shotRequest.mode ?? loadout?.fireMode)
    if (fireMode === 'hitscan') {
      const intersections = combatTargets(runRef.current)
        .map((target) => {
          scratch.targetPosition.set(target.position.x, target.position.y, target.position.z)
          const distance = raySphereIntersectionDistance(
            scratch.muzzle,
            scratch.direction,
            scratch.targetPosition,
            target.hitRadius + 0.045,
          )
          return distance == null ? null : { target, distance }
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance)

      const maximumHits = 1 + Math.max(0, loadout?.projectilePierceBonus ?? 0)
      const resolvedHits = intersections.slice(0, maximumHits)
      let tracerDistance = HITSCAN_RANGE

      for (const hit of resolvedHits) {
        tracerDistance = Math.max(tracerDistance === HITSCAN_RANGE ? 0 : tracerDistance, hit.distance)
        scratch.targetPosition.set(hit.target.position.x, hit.target.position.y, hit.target.position.z)
        scratch.projected.copy(scratch.targetPosition).project(camera)
        onHit(hit.target, {
          x: (scratch.projected.x * 0.5 + 0.5) * size.width,
          y: (-scratch.projected.y * 0.5 + 0.5) * size.height,
        })
      }

      const tracerId = `hitscan-${nextTracerIdRef.current}`
      nextTracerIdRef.current += 1
      tracersRef.current.set(tracerId, {
        id: tracerId,
        start: scratch.muzzle.clone(),
        end: scratch.muzzle.clone().addScaledVector(scratch.direction, tracerDistance),
        age: 0,
      })
      setTracerIds([...tracersRef.current.keys()])
      return
    }

    const id = `projectile-${nextIdRef.current}`
    nextIdRef.current += 1
    projectilesRef.current.set(id, {
      id,
      position: scratch.muzzle.clone(),
      direction: scratch.direction.clone(),
      age: 0,
      speed: APPARATUS_CONFIG.PROJECTILE_SPEED * (loadout?.projectileSpeedMultiplier ?? 1),
      radius: APPARATUS_CONFIG.PROJECTILE_RADIUS * (loadout?.projectileRadiusMultiplier ?? 1),
      pierceRemaining: Math.max(0, loadout?.projectilePierceBonus ?? 0),
      homingStrength: Math.max(0, loadout?.homingStrength ?? 0),
      hitIds: new Set(),
    })
    setIds([...projectilesRef.current.keys()])
  }, [camera, loadout, onHit, runRef, scratch, shotRequest, size.height, size.width])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const run = runRef.current
    const combatActive = isCombatPhase(run)
    const frameTargets = combatActive ? combatTargets(run) : []
    let changed = false
    let tracersChanged = false

    if (!combatActive && projectilesRef.current.size) {
      projectilesRef.current.clear()
      setIds([])
    }

    for (const [tracerId, tracer] of tracersRef.current) {
      tracer.age += delta
      if (tracer.age >= 0.085) {
        tracersRef.current.delete(tracerId)
        tracersChanged = true
      }
    }

    for (const [id, projectile] of projectilesRef.current) {
      projectile.age += delta
      scratch.start.copy(projectile.position)

      if (projectile.homingStrength > 0 && frameTargets.length) {
        let nearestTarget = null
        let nearestDistance = Infinity
        for (const target of frameTargets) {
          if (projectile.hitIds.has(target.id)) continue
          const distance = targetDistanceSquared(target, projectile.position)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestTarget = target
          }
        }
        if (nearestTarget) {
          scratch.targetPosition.set(
            nearestTarget.position.x,
            nearestTarget.position.y,
            nearestTarget.position.z,
          )
          scratch.desired.copy(scratch.targetPosition).sub(projectile.position).normalize()
          projectile.direction
            .lerp(scratch.desired, Math.min(1, projectile.homingStrength * delta))
            .normalize()
        }
      }

      projectile.position.addScaledVector(projectile.direction, projectile.speed * delta)
      scratch.end.copy(projectile.position)

      const mesh = meshRefs.current.get(id)
      if (mesh) {
        mesh.position.copy(projectile.position)
        scratch.quaternion.setFromUnitVectors(FORWARD, projectile.direction)
        mesh.quaternion.copy(scratch.quaternion)
      }

      // Resolve only targets that actually intersect this short movement
      // segment. Avoid rebuilding and sorting the whole target array for every
      // projectile every frame; piercing performs at most one extra scan.
      const maximumSegmentHits = 1 + projectile.pierceRemaining
      for (let hitIndex = 0; hitIndex < maximumSegmentHits; hitIndex += 1) {
        let nearestHit = null
        let nearestHitDistance = Infinity

        for (const target of frameTargets) {
          if (projectile.hitIds.has(target.id)) continue
          scratch.targetPosition.set(target.position.x, target.position.y, target.position.z)
          const hitRadius = target.hitRadius + projectile.radius
          if (!segmentIntersectsSphere(scratch.start, scratch.end, scratch.targetPosition, hitRadius)) continue

          const distance = targetDistanceSquared(target, scratch.start)
          if (distance < nearestHitDistance) {
            nearestHitDistance = distance
            nearestHit = target
          }
        }

        if (!nearestHit) break

        projectile.hitIds.add(nearestHit.id)
        scratch.targetPosition.set(
          nearestHit.position.x,
          nearestHit.position.y,
          nearestHit.position.z,
        )
        scratch.projected.copy(scratch.targetPosition).project(camera)
        onHit(nearestHit, {
          x: (scratch.projected.x * 0.5 + 0.5) * size.width,
          y: (-scratch.projected.y * 0.5 + 0.5) * size.height,
        })

        if (projectile.pierceRemaining > 0) {
          projectile.pierceRemaining -= 1
          continue
        }

        projectilesRef.current.delete(id)
        changed = true
        break
      }

      if (
        projectilesRef.current.has(id) &&
        (projectile.age >= APPARATUS_CONFIG.PROJECTILE_MAX_AGE || projectile.position.lengthSq() > 10000)
      ) {
        projectilesRef.current.delete(id)
        changed = true
      }
    }

    if (changed) setIds([...projectilesRef.current.keys()])
    if (tracersChanged) setTracerIds([...tracersRef.current.keys()])
  })

  return (
    <group>
      {ids.map((id) => (
        <ProjectileVisual
          key={id}
          projectileId={id}
          projectilesRef={projectilesRef}
          meshRefs={meshRefs}
        />
      ))}
      {tracerIds.map((id) => (
        <HitscanTracerVisual key={id} tracerId={id} tracersRef={tracersRef} />
      ))}
    </group>
  )
}
