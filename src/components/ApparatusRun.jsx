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
import CraftMesh from './CraftMesh.jsx'
import ProjectileLayer from './ProjectileLayer.jsx'

const ENEMY_COLORS = Object.freeze(
  Object.fromEntries(SHAPE_KEYS.map((key) => [key, SHAPE_META[key].color])),
)
const PROJECTILE_BURST_GAP_MS = 92
const POINTER_SENSITIVITY = 1.3

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
    const distanceAhead = enemy.routeZ - run.travelDistance
    mesh.visible = true
    mesh.position.set(world.x, world.y, world.z)
    const closePulse = THREE.MathUtils.clamp(1 - distanceAhead / 12, 0, 1)
    const pulse = 1 + closePulse * (0.04 + Math.sin(clock.elapsedTime * 9 + enemy.phase) * 0.025)
    mesh.scale.setScalar(pulse)
    mesh.rotation.x += 0.012
    mesh.rotation.y += enemy.state === 'passed' ? 0.04 : 0.026
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
        emissiveIntensity={enemy.state === 'passed' ? 0.18 : 0.35}
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

function ApparatusCraft({
  shotPulse,
  aimRef,
  reloading,
  fireMode,
  bodyShape,
  clipShape,
  craftRef,
  diving,
}) {
  const groupRef = useRef()
  const flashRef = useRef()
  const { camera } = useThree()
  const recoilRef = useRef(0)
  const reloadPoseRef = useRef(0)
  const flashUntilRef = useRef(0)
  const lastPulseRef = useRef(shotPulse)
  const currentLocalRef = useRef({ x: 0, y: 0 })
  const transforms = useMemo(
    () => ({
      localPosition: new THREE.Vector3(),
      worldPosition: new THREE.Vector3(),
      muzzleOffset: new THREE.Vector3(0, 0, -1.18),
      muzzleWorld: new THREE.Vector3(),
      localQuaternion: new THREE.Quaternion(),
      worldQuaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
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

    recoilRef.current = THREE.MathUtils.damp(recoilRef.current, 0, 18, delta)
    reloadPoseRef.current = THREE.MathUtils.damp(reloadPoseRef.current, reloading ? 1 : 0, 11, delta)

    const desiredX = aimRef.current.x * APPARATUS_CONFIG.CRAFT_MAX_X
    const desiredY = aimRef.current.y * APPARATUS_CONFIG.CRAFT_MAX_Y
    const current = currentLocalRef.current
    const previousX = current.x
    const previousY = current.y
    current.x = THREE.MathUtils.damp(current.x, desiredX, APPARATUS_CONFIG.CRAFT_FOLLOW_RATE, delta)
    current.y = THREE.MathUtils.damp(current.y, desiredY, APPARATUS_CONFIG.CRAFT_FOLLOW_RATE, delta)

    const recoil = recoilRef.current
    const reloadPose = reloadPoseRef.current
    transforms.localPosition.set(
      current.x,
      current.y - reloadPose * 0.08,
      -APPARATUS_CONFIG.CRAFT_PLANE_DISTANCE + recoil * 0.16,
    )
    transforms.worldPosition
      .copy(transforms.localPosition)
      .applyQuaternion(camera.quaternion)
      .add(camera.position)
    group.position.lerp(transforms.worldPosition, 1 - Math.exp(-delta * 32))

    const velocityX = (current.x - previousX) / Math.max(delta, 0.001)
    const velocityY = (current.y - previousY) / Math.max(delta, 0.001)
    transforms.euler.set(
      (diving ? -0.18 : -0.04) + THREE.MathUtils.clamp(velocityY * 0.012, -0.12, 0.12),
      0,
      THREE.MathUtils.clamp(-velocityX * 0.02, -0.34, 0.34),
      'YXZ',
    )
    transforms.localQuaternion.setFromEuler(transforms.euler)
    transforms.worldQuaternion.copy(camera.quaternion).multiply(transforms.localQuaternion)
    group.quaternion.slerp(transforms.worldQuaternion, 1 - Math.exp(-delta * 15))
    group.scale.setScalar(0.84)

    transforms.muzzleWorld
      .copy(transforms.muzzleOffset)
      .applyQuaternion(group.quaternion)
      .add(group.position)
    craftRef.current = {
      x: group.position.x,
      y: group.position.y,
      z: group.position.z,
      localX: current.x,
      localY: current.y,
      muzzle: {
        x: transforms.muzzleWorld.x,
        y: transforms.muzzleWorld.y,
        z: transforms.muzzleWorld.z,
      },
    }

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
      <CraftMesh
        depthTest={false}
        fireMode={fireMode}
        bodyShape={bodyShape}
        clipShape={clipShape}
        flashRef={flashRef}
        diving={diving}
      />
    </group>
  )
}

function RunStepper({ runRef, onSnapshot, craftRef, diveRef }) {
  const frameRef = useRef(0)
  useFrame((_, delta) => {
    runRef.current = advanceRun(runRef.current, delta, APPARATUS_CONFIG, {
      diving: diveRef.current && runRef.current.phase === 'running',
      craftPosition: { x: craftRef.current.x, y: craftRef.current.y },
    })
    frameRef.current += 1
    if (frameRef.current % 4 === 0 || !isCombatPhase(runRef.current)) {
      onSnapshot(runRef.current)
    }
  })
  return null
}

function ApparatusScene({
  runRef,
  snapshot,
  onSnapshot,
  onProjectileHit,
  shotRequest,
  shotPulse,
  aimRef,
  reloading,
  loadout,
  craftRef,
  diveRef,
  diving,
}) {
  return (
    <>
      <color attach="background" args={['#07090a']} />
      <fog attach="fog" args={['#07090a', 18, 66]} />
      <ambientLight intensity={0.72} />
      <pointLight position={[0, 0, 1]} intensity={3.2} distance={38} color="#b5f5e3" />
      <CameraFall runRef={runRef} />
      <RunStepper
        runRef={runRef}
        onSnapshot={onSnapshot}
        craftRef={craftRef}
        diveRef={diveRef}
      />
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
      <ApparatusCraft
        shotPulse={shotPulse}
        aimRef={aimRef}
        reloading={reloading}
        fireMode={loadout.fireMode}
        bodyShape={loadout.bodyShape}
        clipShape={loadout.clipShape}
        craftRef={craftRef}
        diving={diving}
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
  const craftRef = useRef({
    x: 0,
    y: 0,
    z: -APPARATUS_CONFIG.CRAFT_PLANE_DISTANCE,
    muzzle: { x: 0, y: 0, z: -APPARATUS_CONFIG.CRAFT_PLANE_DISTANCE - 1.18 },
  })
  const diveRef = useRef(false)
  const [snapshot, setSnapshot] = useState(runRef.current)
  const [loaded, setLoaded] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [reloadCycle, setReloadCycle] = useState(0)
  const [shotPulse, setShotPulse] = useState(0)
  const [shotRequest, setShotRequest] = useState(null)
  const [impactPulse, setImpactPulse] = useState(null)
  const [diving, setDiving] = useState(false)
  const [pointerLocked, setPointerLocked] = useState(Boolean(document.pointerLockElement))
  const loadedRef = useRef(true)
  const reloadingRef = useRef(false)
  const burstActiveRef = useRef(false)
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

  const updateReticle = useCallback(() => {
    const aim = aimRef.current
    aim.clientX = (aim.x * 0.5 + 0.5) * window.innerWidth
    aim.clientY = (-aim.y * 0.5 + 0.5) * window.innerHeight
    if (reticleRef.current) {
      reticleRef.current.style.transform = `translate(${aim.clientX}px, ${aim.clientY}px)`
    }
  }, [])

  const beginReload = useCallback(() => {
    if (
      !isCombatPhase(runRef.current) ||
      reloadingRef.current ||
      loadedRef.current ||
      burstActiveRef.current
    ) return
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
      origin: { ...craftRef.current.muzzle },
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
      burstActiveRef.current = false
      emitRound()
      beginReload()
      return
    }

    burstActiveRef.current = true
    burstTimersRef.current = Array.from({ length: roundCount }, (_, index) =>
      window.setTimeout(() => {
        emitRound()
        if (index === roundCount - 1) {
          burstActiveRef.current = false
          burstTimersRef.current = []
          beginReload()
        }
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
    const root = document.getElementById('root')
    if (!document.pointerLockElement) root?.requestPointerLock?.()

    const onPointerLockChange = () => setPointerLocked(Boolean(document.pointerLockElement))
    const onMouseMove = (event) => {
      const aim = aimRef.current
      if (document.pointerLockElement) {
        aim.x = THREE.MathUtils.clamp(
          aim.x + (event.movementX / Math.max(1, window.innerWidth)) * 2 * POINTER_SENSITIVITY,
          -1,
          1,
        )
        aim.y = THREE.MathUtils.clamp(
          aim.y - (event.movementY / Math.max(1, window.innerHeight)) * 2 * POINTER_SENSITIVITY,
          -1,
          1,
        )
      } else if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        aim.x = THREE.MathUtils.clamp((event.clientX / Math.max(1, window.innerWidth)) * 2 - 1, -1, 1)
        aim.y = THREE.MathUtils.clamp(1 - (event.clientY / Math.max(1, window.innerHeight)) * 2, -1, 1)
      }
      updateReticle()
    }
    const onKeyDown = (event) => {
      if (event.code === 'KeyR') beginReload()
      if (event.code === 'KeyW' && runRef.current.phase === 'running') {
        event.preventDefault()
        diveRef.current = true
        setDiving(true)
      }
    }
    const stopDive = (event) => {
      if (!event || event.code === 'KeyW') {
        diveRef.current = false
        setDiving(false)
      }
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', stopDive)
    window.addEventListener('blur', stopDive)
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', stopDive)
      window.removeEventListener('blur', stopDive)
    }
  }, [beginReload, updateReticle])

  useEffect(() => {
    if (snapshot.phase !== 'running' && diving) {
      diveRef.current = false
      setDiving(false)
    }
    if (snapshot.hitsTaken > lastHitsRef.current) audio.playDamage()
    lastHitsRef.current = snapshot.hitsTaken

    if (snapshot.phase === 'overwhelmed' && lastPhaseRef.current !== 'overwhelmed') {
      audio.playOverload()
    }
    lastPhaseRef.current = snapshot.phase
  }, [audio, diving, snapshot.hitsTaken, snapshot.phase])

  useEffect(
    () => () => {
      diveRef.current = false
      burstActiveRef.current = false
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
    <main className="game-shell apparatus-shell">
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
          craftRef={craftRef}
          diveRef={diveRef}
          diving={diving}
        />
      </Canvas>

      {isCombatPhase(snapshot) && (
        <div
          className="fire-capture"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            if (!document.pointerLockElement) {
              document.getElementById('root')?.requestPointerLock?.()
              return
            }
            fire()
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

      {snapshot.phase === 'running' && (
        <div className={`dive-status ${diving ? 'is-diving' : ''}`}>
          <span>{diving ? 'DIVING' : 'HOLD W TO DIVE'}</span>
          <strong>{diving ? `${APPARATUS_CONFIG.DIVE_TIME_SCALE}× FLOW` : 'NORMAL FLOW'}</strong>
        </div>
      )}

      {!pointerLocked && isCombatPhase(snapshot) && (
        <div className="apparatus-lock-warning">CLICK TO RECAPTURE APPARATUS CONTROL</div>
      )}

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
          <span>CRAFT · {fireModeMeta.label} ×{fireModeMeta.roundsPerTrigger}</span>
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
