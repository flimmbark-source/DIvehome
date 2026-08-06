import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { APPARATUS_CONFIG } from '../game/config.js'
import {
  facePiecePosition,
  tentacleSegmentPosition,
} from '../game/boss.js'
import { SHAPE_META } from '../game/progression.js'

function ShapeGeometry({ pattern, radius }) {
  switch (pattern) {
    case 'zigzag':
      return <coneGeometry args={[radius * 0.82, radius * 1.7, 5]} />
    case 'orbit':
      return <tetrahedronGeometry args={[radius * 1.2, 0]} />
    case 'corkscrew':
      return <octahedronGeometry args={[radius * 1.12, 0]} />
    default:
      return <icosahedronGeometry args={[radius, 0]} />
  }
}

function FaceShape({ pieceId, runRef }) {
  const meshRef = useRef()

  useFrame(({ clock }) => {
    const boss = runRef.current.boss
    const piece = boss?.facePieces.find((candidate) => candidate.id === pieceId)
    const mesh = meshRef.current
    if (!mesh || !piece?.active) {
      if (mesh) mesh.visible = false
      return
    }

    const position = facePiecePosition(piece, boss)
    const intro = THREE.MathUtils.clamp(boss.elapsed / APPARATUS_CONFIG.BOSS_INTRO_SECONDS, 0, 1)
    const revival = THREE.MathUtils.clamp((boss.elapsed - piece.revivedAt) / 0.18, 0, 1)
    const pulse = 1 + Math.sin(clock.elapsedTime * 4.7 + piece.phase) * 0.055
    mesh.visible = true
    mesh.position.set(position.x, position.y, position.z)
    mesh.scale.setScalar(Math.max(0.001, intro * revival * pulse))
    mesh.rotation.x += 0.012
    mesh.rotation.y += 0.018
  })

  const piece = runRef.current.boss?.facePieces.find((candidate) => candidate.id === pieceId)
  if (!piece) return null
  const color = SHAPE_META[piece.pattern].color

  return (
    <mesh ref={meshRef}>
      <ShapeGeometry pattern={piece.pattern} radius={0.43} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.72}
        roughness={0.72}
        flatShading
      />
    </mesh>
  )
}

function TentacleShape({ tentacleId, segmentId, runRef }) {
  const meshRef = useRef()

  useFrame(({ clock }) => {
    const boss = runRef.current.boss
    const tentacle = boss?.tentacles.find((candidate) => candidate.id === tentacleId)
    const segment = tentacle?.segments.find((candidate) => candidate.id === segmentId)
    const mesh = meshRef.current
    if (!mesh || !tentacle || tentacle.destroyed || !segment?.alive) {
      if (mesh) mesh.visible = false
      return
    }

    const position = tentacleSegmentPosition(tentacle, segment, boss)
    const intro = THREE.MathUtils.clamp(
      (boss.elapsed - APPARATUS_CONFIG.BOSS_INTRO_SECONDS * 0.55) /
        (APPARATUS_CONFIG.BOSS_INTRO_SECONDS * 0.45),
      0,
      1,
    )
    const tipWeight = (segment.segmentIndex + 1) / tentacle.segments.length
    const pulse = 1 + Math.sin(clock.elapsedTime * 7 + segment.segmentIndex) * 0.06 * tipWeight
    mesh.visible = true
    mesh.position.set(position.x, position.y, position.z)
    mesh.scale.setScalar(Math.max(0.001, intro * pulse))
    mesh.rotation.x += 0.021
    mesh.rotation.y -= 0.026
  })

  const tentacle = runRef.current.boss?.tentacles.find((candidate) => candidate.id === tentacleId)
  const segment = tentacle?.segments.find((candidate) => candidate.id === segmentId)
  if (!segment) return null
  const color = SHAPE_META[segment.pattern].color

  return (
    <mesh ref={meshRef}>
      <ShapeGeometry pattern={segment.pattern} radius={0.46} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.54}
        roughness={0.8}
        flatShading
      />
    </mesh>
  )
}

function BossAura({ runRef }) {
  const groupRef = useRef()
  const ringRef = useRef()
  const leftEyeRef = useRef()
  const rightEyeRef = useRef()

  useFrame(({ clock }) => {
    const boss = runRef.current.boss
    const group = groupRef.current
    if (!boss || !group) return

    const intro = THREE.MathUtils.smoothstep(
      boss.elapsed,
      0,
      APPARATUS_CONFIG.BOSS_INTRO_SECONDS,
    )
    group.scale.setScalar(Math.max(0.001, intro))
    group.position.z = APPARATUS_CONFIG.BOSS_FACE_Z + 0.28
    if (ringRef.current) {
      ringRef.current.rotation.z = clock.elapsedTime * 0.12
      ringRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.025)
    }
    const eyeIntensity = 1.8 + Math.sin(clock.elapsedTime * 6.2) * 0.45
    if (leftEyeRef.current) leftEyeRef.current.material.emissiveIntensity = eyeIntensity
    if (rightEyeRef.current) rightEyeRef.current.material.emissiveIntensity = eyeIntensity
  })

  return (
    <group ref={groupRef}>
      <mesh ref={ringRef}>
        <torusGeometry args={[4.15, 0.11, 4, 20]} />
        <meshBasicMaterial color="#9b425c" transparent opacity={0.42} toneMapped={false} />
      </mesh>
      <mesh ref={leftEyeRef} position={[-1.43, 0.5, 0.18]}>
        <octahedronGeometry args={[0.27, 0]} />
        <meshStandardMaterial color="#19070b" emissive="#ff365f" emissiveIntensity={2} flatShading />
      </mesh>
      <mesh ref={rightEyeRef} position={[1.43, 0.5, 0.18]}>
        <octahedronGeometry args={[0.27, 0]} />
        <meshStandardMaterial color="#19070b" emissive="#ff365f" emissiveIntensity={2} flatShading />
      </mesh>
      <pointLight position={[0, 0, 2]} color="#ff4f74" intensity={3.2} distance={18} />
    </group>
  )
}

export default function BossEncounter({ snapshot, runRef }) {
  const boss = snapshot.boss
  if (!boss) return null

  return (
    <group>
      <BossAura runRef={runRef} />
      {boss.facePieces
        .filter((piece) => piece.active)
        .map((piece) => (
          <FaceShape key={piece.id} pieceId={piece.id} runRef={runRef} />
        ))}
      {boss.tentacles.map((tentacle) =>
        tentacle.segments
          .filter((segment) => segment.alive)
          .map((segment) => (
            <TentacleShape
              key={segment.id}
              tentacleId={tentacle.id}
              segmentId={segment.id}
              runRef={runRef}
            />
          )),
      )}
    </group>
  )
}
