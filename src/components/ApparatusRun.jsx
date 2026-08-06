import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useGameAudio from '../audio/useGameAudio.js'
import { APPARATUS_CONFIG, tunnelAxisAt } from '../game/config.js'
import { activeTentacleCount, bossRegenerationLabel } from '../game/boss.js'
import { SHAPE_KEYS, SHAPE_META } from '../game/progression.js'
import {
  advanceRun,
  createRun,
  isCombatPhase,
  shapePayout,
  shootTarget,
} from '../game/simulation.js'
import { fireModeFor, normalizeFireMode, roundsPerTrigger } from '../game/weapon.js'
import { enemyWorldPosition } from '../game/world.js'
import BossEncounter from './BossEncounter.jsx'
import ProjectileLayer from './ProjectileLayer.jsx'
import WeaponMesh from './WeaponMesh.jsx'

const ENEMY_COLORS = Object.freeze(
  Object.fromEntries(SHAPE_KEYS.map((key) => [key, SHAPE_META[key].color])),
)
const FORWARD = new THREE.Vector3(0, 0, -1)
const RIGHT = new THREE.Vector3(1, 0, 0)
const FAR_AIM_DEPTH = 1
const PROJECTILE_BURST_GAP_MS = 92

function Tunnel({ runRef }) {
  const ringsRef = useRef([])
  const ringColors = useMemo(
    () =>
      Array.from({ length: APPARATUS_CONFIG.RING_COUNT }, (_, index) => {
        const t = index / APPARATUS_CONFIG.RING_COUNT
        return new THREE.Color().setHSL(0.52 + t * 0.08, 0.32, 0.19 + t * 0.08)
      }),
    [],
  )

  useFrame(() => {
    const run = runRef.current
    const travel = run.travelDistance
    const anchor = Math.floor(travel / APPARATUS_CONFIG.RING_SPACING) * APPARATUS_CONFIG.RING_SPACING
    const currentAxis = tunnelAxisAt(travel)

    for (let index = 0; index < APPARATUS_CONFIG.RING_COUNT; index += 1) {
      const ring = ringsRef.current[index]
      if (!ring) continue
      const depth = anchor + index * APPARATUS_CONFIG.RING_SPACING
      const axis = tunnelAxisAt(depth)
      ring.position.set(axis.x - currentAxis.x, axis.y - currentAxis.y, travel - depth)
      ring.rotation.z = depth * APPARATUS_CONFIG.TWIST_PER_UNIT
    }
  })

  return (
    <group>
      {ringColors.map((color, index) => (
        <mesh
          key={index}
          ref={(node) => {
            ringsRef.current[index] = node
          }}
        >
          <torusGeometry args={[APPARATUS_CONFIG.TUBE_RADIUS, 0.14, 4, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.42} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function EnemyGeometry({ pattern }) {
  switch (pattern) {
    case 'zigzag':
      return <coneGeometry args={[0.72, 1.5, 5]} />
    case 'orbit':
      return <tetrahedronGeometry args={[0.92, 0]} />
    case 'corkscrew':
      return <octahedronGeometry args={[0.9, 0]} />
    default:
      return <icosahedronGeometry args={[0.86, 0]} />
  }
}

function Enemy({ enemyId, runRef }) {
  const meshRef = useRef()

  useFrame(({ clock }) => {
    const run = runRef.current
    const enemy = run.enemies.find((candidate) => candidate.id === enemyId)
    const mesh = meshRef.current
    if (!enemy || !mesh) {
      if (mesh) mesh.visible = false
      return
    }

    const world = enemyWorldPosition(enemy, run)
    mesh.visible = true
    mesh.position.set(world.x, world.y, world.z)
    const parked = enemy.state === 'parked'
    const pulse = parked ? 1.06 + Math.sin(clock.elapsedTime * 8 + enemy.phase) * 0.05 : 1
    mesh.scale.setScalar(pulse)
    mesh.rotation.x += 0.012
    mesh.rotation.y += parked ? 0.018 : 0.026
  })

  const enemy = runRef.current.enemies.find((candidate) => candidate.id === enemyId)
  if (!enemy) return null
  const color = ENEMY_COLORS[enemy.pattern]

  return (
    <mesh ref={meshRef} userData={{ enemyId }}>
      <EnemyGeometry pattern={enemy.pattern} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={enemy.state === 'parked' ? 0.85 : 0.35}
        flatShading
      />
    </mesh>
  )
}

function CameraFall({ runRef }) {
  const { camera } = useThree()
  useFrame(() => {
    const travel = runRef.current.travelDistance
    const wobbleX = Math.sin(travel * 0.055) * 0.17
    const wobbleY = Math.cos(travel * 0.041) * 0.12
    camera.position.set(wobbleX, wobbleY, 0)
    camera.up.set(0, 1, 0)
    camera.lookAt(wobbleX * 0.3, wobbleY * 0.3, -18)
    camera.rotation.z += Math.sin(travel * 0.045) * 0.055
  })
  return null
}

function GunModel({ shotPulse, aimRef, reloading, fireMode, loadedShape }) {
  const groupRef = useRef()
  const flashRef = useRef()
  const { camera } = useThree()
  const recoilRef = useRef(0)
  const reloadPoseRef = useRef(0)
  const flashUntilRef = useRef(0)
  const lastPulseRef = useRef(shotPulse)
  const smoothedAimRef = useRef({ x: 0, y: 0 })
  const transforms = useMemo(
    () => ({
      localPosition: new THREE.Vector3(),
      targetPosition: new THREE.Vector3(),
      targetPoint: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      aimQuaternion: new THREE.Quaternion(),
      rollQuaternion: new THREE.Quaternion(),
      recoilQuaternion: new THREE.Quaternion(),
      targetQuaternion: new THREE.Quaternion(),
    }),
    [],
  )

  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const group = groupRef.current
    if (!group) return

    if (shotPulse !== lastPulseRef.current) {
      lastPulseRef.current = shotPulse
      recoilRef.current = 1
      flashUntilRef.current = clock.elapsedTime + 0.065
    }

    const aim = aimRef.current
    const smoothedAim = smoothedAimRef.current
    smoothedAim.x = THREE.MathUtils.damp(smoothedAim.x, aim.x, 22, delta)
    smoothedAim.y = THREE.MathUtils.damp(smoothedAim.y, aim.y, 22, delta)
    recoilRef.current = THREE.MathUtils.damp(recoilRef.current, 0, 17, delta)
    reloadPoseRef.current = THREE.MathUtils.damp(reloadPoseRef.current, reloading ? 1 : 0, 13, delta)

    const recoil = recoilRef.current
    const reloadPose = reloadPoseRef.current
    transforms.localPosition.set(
      0.36 + smoothedAim.x * 0.46,
      -0.46 + smoothedAim.y * 0.29 - reloadPose * 0.25,
      -1.34 + recoil * 0.42,
    )
    transforms.targetPosition
      .copy(transforms.localPosition)
      .applyQuaternion(camera.quaternion)
      .add(camera.position)
    group.position.lerp(transforms.targetPosition, 1 - Math.exp(-delta * 28))

    transforms.targetPoint.set(smoothedAim.x, smoothedAim.y, FAR_AIM_DEPTH).unproject(camera)
    transforms.direction.copy(transforms.targetPoint).sub(group.position).normalize()
    transforms.aimQuaternion.setFromUnitVectors(FORWARD, transforms.direction)
    transforms.rollQuaternion.setFromAxisAngle(FORWARD, reloadPose * 0.42 - smoothedAim.x * 0.035)
    transforms.recoilQuaternion.setFromAxisAngle(RIGHT, recoil * 0.2)
    transforms.targetQuaternion
      .copy(transforms.aimQuaternion)
      .multiply(transforms.recoilQuaternion)
      .multiply(transforms.rollQuaternion)
    group.quaternion.slerp(transforms.targetQuaternion, 1 - Math.exp(-delta * 30))

    if (flashRef.current) {
      const visible = clock.elapsedTime < flashUntilRef.current
      flashRef.current.visible = visible
      if (visible) {
        const flicker = 0.9 + Math.sin(clock.elapsedTime * 760) * 0.18
        flashRef.current.scale.setScalar(flicker)
        flashRef.current.rotation.z += 0.32
      }
    }
  })

  return (
    <group ref={groupRef} renderOrder={30}>
      <WeaponMesh
        depthTest={false}
        fireMode={fireMode}
        loadedShape={loadedShape}
        flashRef={flashRef}
      />
    </group>
  )
}

function RunStepper({ runRef, onSnapshot }) {
  const frameRef = useRef(0)
  useFrame((_, delta) => {
    runRef.current = advanceRun(runRef.current, delta)
    frameRef.current += 1
    if (frameRef.current % 4 === 0 || !isCombatPhase(runRef.current)) {
      onSnapshot(runRef.current)
    }
  })
  return null
}

function ApparatusScene({ runRef, snapshot, onSnapshot, onProjectileHit, shotRequest, shotPulse, aimRef, reloading, loadout }) {
  return (
    <>
      <color attach="background" args={['#07090a']} />
      <fog attach="fog" args={['#07090a', 18, 66]} />
      <ambientLight intensity={0.72} />
      <pointLight position={[0, 0, 1]} intensity={3.2} distance={38} color="#b5f5e3" />
      <CameraFall runRef={runRef} />
      <RunStepper runRef={runRef} onSnapshot={onSnapshot} />
      <Tunnel runRef={runRef} />
      {snapshot.enemies.map((enemy) => (
        <Enemy key={enemy.id} enemyId={enemy.id} runRef={runRef} />
      ))}
      <BossEncounter snapshot={snapshot} runRef={runRef} />
      <ProjectileLayer
        shotRequest={shotRequest}
        runRef={runRef}
        loadout={loadout}
        onHit={onProjectileHit}
      />
      <GunModel
        shotPulse={shotPulse}
        aimRef={aimRef}
        reloading={reloading}
        fireMode={loadout.fireMode}
        loadedShape={loadout.toolingShape}
      />
    </>
  )
}

function ShapeReward({ payout }) {
  return (
    <div className="shape-payout">
      {SHAPE_KEYS.map((shape) => (
        <div key={shape} style={{ '--shape-color': SHAPE_META[shape].color }}>
          <strong>{SHAPE_META[shape].symbol} {payout[shape]}</strong>
          <small>{SHAPE_META[shape].label}</small>
        </div>
      ))}
    </div>
  )
}

export default function ApparatusRun({ loadout = {}, onReturn }) {
  const runRef = useRef(createRun(Date.now(), APPARATUS_CONFIG, loadout))
  const [snapshot, setSnapshot] = useState(runRef.current)
  const [loaded, setLoaded] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [reloadCycle, setReloadCycle] = useState(0)
  const [shotPulse, setShotPulse] = useState(0)
  const [shotRequest, setShotRequest] = useState(null)
  const [impactPulse, setImpactPulse] = useState(null)
  const loadedRef = useRef(true)
  const reloadingRef = useRef(false)
  const reticleRef = useRef(null)
  const reloadTimerRef = useRef(null)
  const burstTimersRef = useRef([])
  const shotIdRef = useRef(1)
  const lastDryAtRef = useRef(0)
  const lastHitsRef = useRef(0)
  const lastPhaseRef = useRef('running')
  const aimRef = useRef({
    x: 0,
    y: 0,
    clientX: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    clientY: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  })
  const audio = useGameAudio()
  const reloadDuration = APPARATUS_CONFIG.RELOAD_SECONDS * (loadout.reloadMultiplier ?? 1)
  const fireMode = normalizeFireMode(loadout.fireMode)
  const fireModeMeta = fireModeFor(fireMode)

  const beginReload = useCallback(() => {
    if (!isCombatPhase(runRef.current) || reloadingRef.current || loadedRef.current) return
    reloadingRef.current = true
    setReloading(true)
    setReloadCycle((value) => value + 1)
    audio.playReloadStart()

    reloadTimerRef.current = window.setTimeout(() => {
      reloadingRef.current = false
      setReloading(false)
      reloadTimerRef.current = null
      if (!isCombatPhase(runRef.current)) return
      loadedRef.current = true
      setLoaded(true)
      audio.playReloadComplete()
    }, reloadDuration * 1000)
  }, [audio, reloadDuration])

  const emitRound = useCallback(() => {
    if (!isCombatPhase(runRef.current)) return
    const id = shotIdRef.current
    shotIdRef.current += 1
    setShotPulse((value) => value + 1)
    setShotRequest({
      id,
      mode: fireMode,
      aim: { x: aimRef.current.x, y: aimRef.current.y },
    })
    audio.playShot()
  }, [audio, fireMode])

  const fire = useCallback(() => {
    if (!isCombatPhase(runRef.current)) return
    if (!loadedRef.current || reloadingRef.current) {
      const now = performance.now()
      if (now - lastDryAtRef.current > 140) {
        lastDryAtRef.current = now
        audio.playDry()
      }
      return
    }

    loadedRef.current = false
    setLoaded(false)

    const roundCount = roundsPerTrigger(fireMode)
    if (roundCount === 1) {
      emitRound()
      beginReload()
      return
    }

    burstTimersRef.current = Array.from({ length: roundCount }, (_, index) =>
      window.setTimeout(() => {
        emitRound()
        if (index === roundCount - 1) beginReload()
      }, index * PROJECTILE_BURST_GAP_MS),
    )
  }, [audio, beginReload, emitRound, fireMode])

  const onProjectileHit = useCallback(
    (target, screenPosition) => {
      const next = shootTarget(runRef.current, target.id)
      if (next === runRef.current) return
      runRef.current = next
      setSnapshot(next)
      audio.playEnemyHit()
      setImpactPulse({ id: performance.now(), ...screenPosition })
    },
    [audio],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'KeyR') beginReload()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [beginReload])

  useEffect(() => {
    if (snapshot.hitsTaken > lastHitsRef.current) audio.playDamage()
    lastHitsRef.current = snapshot.hitsTaken

    if (snapshot.phase === 'overwhelmed' && lastPhaseRef.current !== 'overwhelmed') {
      audio.playOverload()
    }
    lastPhaseRef.current = snapshot.phase
  }, [audio, snapshot.hitsTaken, snapshot.phase])

  useEffect(
    () => () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current)
      for (const timer of burstTimersRef.current) window.clearTimeout(timer)
    },
    [],
  )

  const payout = shapePayout(snapshot)
  const bossTentacles = activeTentacleCount(snapshot.boss)
  const bossRegen = bossRegenerationLabel(snapshot.boss)
  const roundSeconds = Math.max(0, Math.ceil(APPARATUS_CONFIG.ROUND_SECONDS - snapshot.elapsed))

  const returnToRoom = () => {
    document.getElementById('root')?.requestPointerLock?.()
    onReturn(payout)
  }

  return (
    <main
      className="game-shell apparatus-shell"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const x = THREE.MathUtils.clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1)
        const y = THREE.MathUtils.clamp(1 - ((event.clientY - bounds.top) / bounds.height) * 2, -1, 1)
        aimRef.current = { x, y, clientX: event.clientX, clientY: event.clientY }
        if (reticleRef.current) {
          reticleRef.current.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`
        }
      }}
    >
      <Canvas
        flat
        dpr={0.75}
        shadows={false}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        camera={{ fov: 68, near: 0.05, far: 90 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#07090a')
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.NoToneMapping
        }}
      >
        <ApparatusScene
          runRef={runRef}
          snapshot={snapshot}
          onSnapshot={setSnapshot}
          onProjectileHit={onProjectileHit}
          shotRequest={shotRequest}
          shotPulse={shotPulse}
          aimRef={aimRef}
          reloading={reloading}
          loadout={loadout}
        />
      </Canvas>

      {isCombatPhase(snapshot) && (
        <div
          className="fire-capture"
          onPointerDown={(event) => {
            if (event.button === 0) fire()
          }}
          aria-hidden="true"
        />
      )}
      <div className="ps1-overlay" aria-hidden="true" />
      <div className="apparatus-hud">
        <div>
          <span>INTEGRITY</span>
          <strong>{'■'.repeat(snapshot.hp)}{'□'.repeat(snapshot.maxHp - snapshot.hp)}</strong>
        </div>
        <div>
          <span>SHIELD</span>
          <strong>{snapshot.shield > 0 ? '◆'.repeat(snapshot.shield) : '—'}</strong>
        </div>
        {snapshot.phase === 'running' ? (
          <>
            <div>
              <span>ROUND</span>
              <strong>{String(roundSeconds).padStart(2, '0')} SEC</strong>
            </div>
            <div>
              <span>COLLECTED</span>
              <strong>{String(snapshot.kills).padStart(3, '0')}</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>TENTACLES</span>
              <strong>{bossTentacles} / {APPARATUS_CONFIG.BOSS_TENTACLE_COUNT}</strong>
            </div>
            <div className={`boss-regen-status regen-${bossRegen.toLowerCase()}`}>
              <span>REGENERATION</span>
              <strong>{bossRegen}</strong>
            </div>
          </>
        )}
      </div>

      {snapshot.phase === 'boss' && snapshot.boss?.elapsed < APPARATUS_CONFIG.BOSS_INTRO_SECONDS && (
        <div className="boss-arrival" aria-hidden="true">
          <span>END OF ROUND</span>
          <strong>STRUCTURE FORMING</strong>
        </div>
      )}

      {loadout.effects?.length > 0 && (
        <div className="active-loadout">
          {loadout.effects.map((effect) => <span key={effect}>{effect}</span>)}
        </div>
      )}

      <div className={`weapon-status ${loaded ? 'is-loaded' : ''} ${reloading ? 'is-reloading' : ''}`}>
        <div className="weapon-status-line">
          <span>{fireModeMeta.label} ×{fireModeMeta.roundsPerTrigger}</span>
          <strong>{reloading ? 'CYCLING' : loaded ? 'READY' : 'EMPTY'}</strong>
        </div>
        <div className="reload-track" aria-hidden="true">
          {reloading ? (
            <i
              key={reloadCycle}
              className="reload-fill is-cycling"
              style={{ '--reload-duration': `${reloadDuration}s` }}
            />
          ) : (
            <i className={`reload-fill ${loaded ? 'is-full' : ''}`} />
          )}
        </div>
      </div>

      <div
        ref={reticleRef}
        className={`aim-reticle ${loaded ? 'is-loaded' : 'is-empty'}`}
        style={{
          transform: `translate(${typeof window === 'undefined' ? 0 : window.innerWidth / 2}px, ${
            typeof window === 'undefined' ? 0 : window.innerHeight / 2
          }px)`,
        }}
        aria-hidden="true"
      >
        <i />
      </div>

      {shotPulse > 0 && (
        <div key={`shot-${shotPulse}`} className="shot-screen-flash" aria-hidden="true">
          <i
            className="shot-reticle-burst"
            style={{ left: aimRef.current.clientX, top: aimRef.current.clientY }}
          />
        </div>
      )}
      {impactPulse && (
        <div
          key={impactPulse.id}
          className="impact-flash"
          style={{ left: impactPulse.x, top: impactPulse.y }}
          aria-hidden="true"
        />
      )}

      {snapshot.hitsTaken > 0 && <div key={snapshot.hitsTaken} className="damage-flash" aria-hidden="true" />}

      {snapshot.phase === 'overwhelmed' && (
        <section className="overwhelm-panel">
          <span>CAPACITY EXCEEDED</span>
          <h1>OVERWHELMED</h1>
          <ShapeReward payout={payout} />
          <button type="button" onClick={returnToRoom}>
            RETURN TO WHITE SPACE
          </button>
        </section>
      )}

      {snapshot.phase === 'victory' && (
        <section className="overwhelm-panel victory-panel">
          <span>REGENERATION TERMINATED</span>
          <h1>STRUCTURE DISMANTLED</h1>
          <p>BOSS CACHE RECOVERED</p>
          <ShapeReward payout={payout} />
          <button type="button" onClick={returnToRoom}>
            RETURN TO WHITE SPACE
          </button>
        </section>
      )}
    </main>
  )
}
