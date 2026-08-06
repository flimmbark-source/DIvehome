import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { APPARATUS_CONFIG } from '../game/config.js'
import { enemyWorldPosition } from '../game/world.js'

const FORWARD = new THREE.Vector3(0, 0, -1)

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
      <pointLight color="#ffd27a" intensity={3.5} distance={3.2} decay={2} />
    </group>
  )
}

function distanceToSegmentSquared(point, start, end, scratch) {
  const segment = scratch.segment.copy(end).sub(start)
  const lengthSquared = Math.max(segment.lengthSq(), 0.000001)
  const t = THREE.MathUtils.clamp(scratch.toPoint.copy(point).sub(start).dot(segment) / lengthSquared, 0, 1)
  scratch.closest.copy(start).addScaledVector(segment, t)
  return scratch.closest.distanceToSquared(point)
}

export default function ProjectileLayer({ shotRequest, runRef, loadout, onHit }) {
  const { camera, size } = useThree()
  const projectilesRef = useRef(new Map())
  const meshRefs = useRef(new Map())
  const [ids, setIds] = useState([])
  const lastShotRef = useRef(null)
  const nextIdRef = useRef(1)
  const scratch = useMemo(
    () => ({
      muzzle: new THREE.Vector3(),
      target: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      enemy: new THREE.Vector3(),
      projected: new THREE.Vector3(),
      desired: new THREE.Vector3(),
      segment: new THREE.Vector3(),
      toPoint: new THREE.Vector3(),
      closest: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
    }),
    [],
  )

  useEffect(() => {
    if (!shotRequest || shotRequest.id === lastShotRef.current) return
    lastShotRef.current = shotRequest.id
    if (runRef.current.phase !== 'running') return

    const aim = shotRequest.aim
    scratch.muzzle
      .set(0.42 + aim.x * 0.44, -0.42 + aim.y * 0.3, -1.62)
      .applyQuaternion(camera.quaternion)
      .add(camera.position)
    scratch.target.set(aim.x, aim.y, 0.45).unproject(camera)
    scratch.direction.copy(scratch.target).sub(scratch.muzzle).normalize()

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
  }, [camera, loadout, runRef, scratch, shotRequest])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const run = runRef.current
    let changed = false

    if (run.phase !== 'running' && projectilesRef.current.size) {
      projectilesRef.current.clear()
      setIds([])
      return
    }

    for (const [id, projectile] of projectilesRef.current) {
      projectile.age += delta
      scratch.start.copy(projectile.position)

      if (projectile.homingStrength > 0 && run.enemies.length) {
        let nearest = null
        let nearestDistance = Infinity
        for (const enemy of run.enemies) {
          if (projectile.hitIds.has(enemy.id)) continue
          const world = enemyWorldPosition(enemy, run)
          scratch.enemy.set(world.x, world.y, world.z)
          const distance = scratch.enemy.distanceToSquared(projectile.position)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearest = scratch.enemy.clone()
          }
        }
        if (nearest) {
          scratch.desired.copy(nearest).sub(projectile.position).normalize()
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

      for (const enemy of [...runRef.current.enemies]) {
        if (projectile.hitIds.has(enemy.id)) continue
        const world = enemyWorldPosition(enemy, runRef.current)
        scratch.enemy.set(world.x, world.y, world.z)
        const hitRadius = APPARATUS_CONFIG.ENEMY_HIT_RADIUS + projectile.radius
        if (distanceToSegmentSquared(scratch.enemy, scratch.start, scratch.end, scratch) > hitRadius * hitRadius) {
          continue
        }

        projectile.hitIds.add(enemy.id)
        scratch.projected.copy(scratch.enemy).project(camera)
        onHit(enemy.id, enemy.pattern, {
          x: (scratch.projected.x * 0.5 + 0.5) * size.width,
          y: (-scratch.projected.y * 0.5 + 0.5) * size.height,
        })

        if (projectile.pierceRemaining > 0) {
          projectile.pierceRemaining -= 1
        } else {
          projectilesRef.current.delete(id)
          changed = true
        }
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
    </group>
  )
}
