import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { APPARATUS_CONFIG, tunnelAxisAt } from '../game/config.js'
import {
  advanceRun,
  createRun,
  patternOffset,
  prototypePayout,
  shootEnemy,
} from '../game/simulation.js'

const ENEMY_COLORS = Object.freeze({
  drift: '#f0e4bf',
  zigzag: '#ff766e',
  orbit: '#83d7ff',
  corkscrew: '#d790ff',
})

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

function Enemy({ enemyId, runRef, onFire }) {
  const meshRef = useRef()

  useFrame(({ clock }) => {
    const run = runRef.current
    const enemy = run.enemies.find((candidate) => candidate.id === enemyId)
    const mesh = meshRef.current
    if (!enemy || !mesh) {
      if (mesh) mesh.visible = false
      return
    }

    mesh.visible = true
    const parked = enemy.state === 'parked'
    const distanceAhead = parked
      ? APPARATUS_CONFIG.INTERACTION_DISTANCE
      : enemy.routeZ - run.travelDistance
    const offset = patternOffset(enemy, distanceAhead, run.elapsed)

    if (parked) {
      mesh.position.set(
        offset.x * APPARATUS_CONFIG.TUBE_RADIUS,
        offset.y * APPARATUS_CONFIG.TUBE_RADIUS,
        -APPARATUS_CONFIG.INTERACTION_DISTANCE,
      )
    } else {
      const enemyAxis = tunnelAxisAt(enemy.routeZ)
      const currentAxis = tunnelAxisAt(run.travelDistance)
      mesh.position.set(
        enemyAxis.x - currentAxis.x + offset.x * APPARATUS_CONFIG.TUBE_RADIUS,
        enemyAxis.y - currentAxis.y + offset.y * APPARATUS_CONFIG.TUBE_RADIUS,
        -distanceAhead,
      )
    }

    const pulse = parked ? 1.06 + Math.sin(clock.elapsedTime * 8 + enemy.phase) * 0.05 : 1
    mesh.scale.setScalar(pulse)
    mesh.rotation.x += 0.012
    mesh.rotation.y += parked ? 0.018 : 0.026
  })

  const enemy = runRef.current.enemies.find((candidate) => candidate.id === enemyId)
  if (!enemy) return null
  const color = ENEMY_COLORS[enemy.pattern]

  return (
    <mesh
      ref={meshRef}
      userData={{ enemyId }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onFire(enemyId)
      }}
    >
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

function GunModel({ recoilPulse }) {
  const groupRef = useRef()
  const { camera, pointer } = useThree()
  const recoilRef = useRef(0)
  const lastPulseRef = useRef(recoilPulse)
  const local = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    if (recoilPulse !== lastPulseRef.current) {
      lastPulseRef.current = recoilPulse
      recoilRef.current = 0.24
    }
    recoilRef.current = THREE.MathUtils.damp(recoilRef.current, 0, 15, delta)

    local.set(0.62 + pointer.x * 0.08, -0.57 + pointer.y * 0.05, -1.45 + recoilRef.current)
    local.applyQuaternion(camera.quaternion).add(camera.position)
    group.position.copy(local)
    group.quaternion.copy(camera.quaternion)
  })

  return (
    <group ref={groupRef}>
      <mesh rotation={[0, 0, -0.06]}>
        <boxGeometry args={[0.28, 0.34, 1.12]} />
        <meshLambertMaterial color="#272a2b" flatShading />
      </mesh>
      <mesh position={[0, -0.24, 0.2]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.22, 0.55, 0.28]} />
        <meshLambertMaterial color="#3c3430" flatShading />
      </mesh>
      <mesh position={[0, 0.02, -0.73]}>
        <cylinderGeometry args={[0.075, 0.095, 0.65, 6]} />
        <meshLambertMaterial color="#17191a" flatShading />
      </mesh>
    </group>
  )
}

function RunStepper({ runRef, onSnapshot }) {
  const frameRef = useRef(0)
  useFrame((_, delta) => {
    runRef.current = advanceRun(runRef.current, delta)
    frameRef.current += 1
    if (frameRef.current % 4 === 0 || runRef.current.phase === 'overwhelmed') {
      onSnapshot(runRef.current)
    }
  })
  return null
}

function ApparatusScene({ runRef, snapshot, onSnapshot, onFire, recoilPulse }) {
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
        <Enemy key={enemy.id} enemyId={enemy.id} runRef={runRef} onFire={onFire} />
      ))}
      <GunModel recoilPulse={recoilPulse} />
    </>
  )
}

export default function ApparatusRun({ onReturn }) {
  const runRef = useRef(createRun())
  const [snapshot, setSnapshot] = useState(runRef.current)
  const [loaded, setLoaded] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [recoilPulse, setRecoilPulse] = useState(0)
  const loadedRef = useRef(true)
  const reloadingRef = useRef(false)
  const reticleRef = useRef(null)
  const reloadTimerRef = useRef(null)

  const fire = useCallback(
    (enemyId) => {
      if (runRef.current.phase !== 'running' || !loadedRef.current || reloadingRef.current) return
      loadedRef.current = false
      setLoaded(false)
      setRecoilPulse((value) => value + 1)
      if (enemyId) {
        runRef.current = shootEnemy(runRef.current, enemyId)
        setSnapshot(runRef.current)
      }
    },
    [],
  )

  const reload = useCallback(() => {
    if (runRef.current.phase !== 'running' || loadedRef.current || reloadingRef.current) return
    reloadingRef.current = true
    setReloading(true)
    reloadTimerRef.current = window.setTimeout(() => {
      loadedRef.current = true
      reloadingRef.current = false
      setLoaded(true)
      setReloading(false)
      reloadTimerRef.current = null
    }, APPARATUS_CONFIG.RELOAD_SECONDS * 1000)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'KeyR') reload()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reload])

  useEffect(
    () => () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current)
    },
    [],
  )

  const payout = prototypePayout(snapshot)

  return (
    <main
      className="game-shell apparatus-shell"
      onPointerMove={(event) => {
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
        onPointerMissed={() => fire(null)}
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
          onFire={fire}
          recoilPulse={recoilPulse}
        />
      </Canvas>

      <div className="ps1-overlay" aria-hidden="true" />
      <div className="apparatus-hud">
        <div>
          <span>INTEGRITY</span>
          <strong>{'■'.repeat(snapshot.hp)}{'□'.repeat(APPARATUS_CONFIG.STARTING_HP - snapshot.hp)}</strong>
        </div>
        <div>
          <span>DEPTH</span>
          <strong>{Math.floor(snapshot.travelDistance).toString().padStart(4, '0')}</strong>
        </div>
        <div>
          <span>CLEARED</span>
          <strong>{String(snapshot.kills).padStart(3, '0')}</strong>
        </div>
      </div>

      <div className={`weapon-status ${loaded ? 'is-loaded' : ''} ${reloading ? 'is-reloading' : ''}`}>
        {reloading ? 'RELOADING' : loaded ? 'CHAMBERED' : 'PRESS R'}
      </div>

      <div
        ref={reticleRef}
        className={`aim-reticle ${loaded ? 'is-loaded' : 'is-empty'}`}
        style={{ transform: `translate(${window.innerWidth / 2}px, ${window.innerHeight / 2}px)` }}
        aria-hidden="true"
      >
        <i />
      </div>

      {snapshot.hitsTaken > 0 && <div key={snapshot.hitsTaken} className="damage-flash" aria-hidden="true" />}

      {snapshot.phase === 'overwhelmed' && (
        <section className="overwhelm-panel">
          <span>CAPACITY EXCEEDED</span>
          <h1>OVERWHELMED</h1>
          <p>{payout} MATERIAL RECOVERED</p>
          <button type="button" onClick={() => onReturn(payout)}>
            RETURN TO WHITE SPACE
          </button>
        </section>
      )}
    </main>
  )
}
