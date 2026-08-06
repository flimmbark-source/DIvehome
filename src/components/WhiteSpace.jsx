import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useGameAudio from '../audio/useGameAudio.js'
import { FURNITURE_RECIPES, SHAPE_KEYS, SHAPE_META } from '../game/progression.js'
import AssemblerPanel from './AssemblerPanel.jsx'
import FurnitureFuelSelector from './FurnitureFuelSelector.jsx'

const APPARATUS_POSITION = new THREE.Vector3(0, 0, -4.4)
const ASSEMBLER_POSITION = new THREE.Vector3(3.7, 0, -2.8)
const TOASTER_POSITION = new THREE.Vector3(-3.55, 0, -4.45)
const WORKBENCH_POSITION = new THREE.Vector3(-3.65, 0, -1.65)
const PLAYER_HEIGHT = 1.62
const PLAYER_SPEED = 3.1

function PlayerRig({ mechanismUnlocked, built, controlsEnabled, onFocusChange, onStep, onUnlockAudio }) {
  const { camera, gl } = useThree()
  const keysRef = useRef(new Set())
  const yawRef = useRef(0)
  const pitchRef = useRef(-0.04)
  const focusRef = useRef(null)
  const stepDistanceRef = useRef(0)
  const stepPhaseRef = useRef(0)
  const alternateStepRef = useRef(false)
  const forwardRef = useRef(new THREE.Vector3())
  const rightRef = useRef(new THREE.Vector3())
  const movementRef = useRef(new THREE.Vector3())

  useEffect(() => {
    camera.position.set(0, PLAYER_HEIGHT, 3.4)
    camera.rotation.order = 'YXZ'

    const onKeyDown = (event) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault()
      if (controlsEnabled) keysRef.current.add(event.code)
    }
    const onKeyUp = (event) => keysRef.current.delete(event.code)
    const clearKeys = () => keysRef.current.clear()
    const onMouseMove = (event) => {
      if (!document.pointerLockElement || !controlsEnabled) return
      yawRef.current -= event.movementX * 0.0022
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - event.movementY * 0.002,
        -1.15,
        1.15,
      )
    }
    const requestLock = (event) => {
      if (event.button !== 0 || document.pointerLockElement || !controlsEnabled) return
      onUnlockAudio()
      document.getElementById('root')?.requestPointerLock?.()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearKeys)
    window.addEventListener('mousemove', onMouseMove)
    gl.domElement.addEventListener('pointerdown', requestLock)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearKeys)
      window.removeEventListener('mousemove', onMouseMove)
      gl.domElement.removeEventListener('pointerdown', requestLock)
    }
  }, [camera, controlsEnabled, gl, onUnlockAudio])

  useEffect(() => {
    if (!controlsEnabled) keysRef.current.clear()
  }, [controlsEnabled])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    camera.rotation.set(pitchRef.current, yawRef.current, camera.rotation.z)

    const forward = forwardRef.current.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current))
    const right = rightRef.current.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current))
    const movement = movementRef.current.set(0, 0, 0)
    const keys = keysRef.current

    if (controlsEnabled) {
      if (keys.has('KeyW')) movement.add(forward)
      if (keys.has('KeyS')) movement.sub(forward)
      if (keys.has('KeyD')) movement.add(right)
      if (keys.has('KeyA')) movement.sub(right)
    }

    if (movement.lengthSq() > 0) {
      const distance = delta * PLAYER_SPEED
      movement.normalize().multiplyScalar(distance)
      camera.position.add(movement)
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -5.2, 5.2)
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -5.8, 5.2)

      stepPhaseRef.current += delta * 10.5
      stepDistanceRef.current += distance
      if (stepDistanceRef.current >= 0.72) {
        stepDistanceRef.current %= 0.72
        alternateStepRef.current = !alternateStepRef.current
        onStep(alternateStepRef.current)
      }
      camera.position.y = PLAYER_HEIGHT + Math.sin(stepPhaseRef.current) * 0.032
      camera.rotation.z = Math.sin(stepPhaseRef.current * 0.5) * 0.006
    } else {
      stepDistanceRef.current = 0
      camera.position.y = THREE.MathUtils.damp(camera.position.y, PLAYER_HEIGHT, 12, delta)
      camera.rotation.z = THREE.MathUtils.damp(camera.rotation.z, 0, 12, delta)
    }

    const targets = [{ id: 'apparatus', position: APPARATUS_POSITION, reach: 2.65 }]
    if (mechanismUnlocked) targets.push({ id: 'assembler', position: ASSEMBLER_POSITION, reach: 2.45 })
    if (built?.toaster) targets.push({ id: 'toaster', position: TOASTER_POSITION, reach: 2.25 })
    if (built?.workbench) targets.push({ id: 'workbench', position: WORKBENCH_POSITION, reach: 2.55 })

    let focus = null
    let nearest = Infinity
    for (const target of targets) {
      const distance = Math.hypot(
        camera.position.x - target.position.x,
        camera.position.z - target.position.z,
      )
      if (distance < target.reach && distance < nearest) {
        focus = target.id
        nearest = distance
      }
    }

    if (focus !== focusRef.current) {
      focusRef.current = focus
      onFocusChange(focus)
    }
  })

  return null
}

function Apparatus({ active }) {
  const rootRef = useRef()
  const screenRef = useRef()

  useFrame(({ clock }) => {
    if (rootRef.current) rootRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.45) * 0.018
    if (screenRef.current) {
      screenRef.current.material.emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 4.2) * 0.35
    }
  })

  return (
    <group ref={rootRef} position={APPARATUS_POSITION.toArray()}>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[1.55, 2.7, 1.1]} />
        <meshLambertMaterial color="#17191a" flatShading />
      </mesh>
      <mesh position={[0, 1.72, 0.57]} rotation={[-0.08, 0, 0]} ref={screenRef}>
        <boxGeometry args={[0.92, 0.62, 0.08]} />
        <meshStandardMaterial color="#25352f" emissive="#76ffba" emissiveIntensity={1.5} flatShading />
      </mesh>
      <mesh position={[-0.38, 0.93, 0.61]}>
        <cylinderGeometry args={[0.095, 0.095, 0.08, 8]} />
        <meshStandardMaterial color="#512325" emissive="#ff4852" emissiveIntensity={active ? 1.2 : 0.25} />
      </mesh>
      <mesh position={[0.38, 0.93, 0.61]}>
        <cylinderGeometry args={[0.095, 0.095, 0.08, 8]} />
        <meshStandardMaterial color="#1f4734" emissive="#64ff9b" emissiveIntensity={active ? 1.35 : 0.25} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[2.05, 0.24, 1.55]} />
        <meshLambertMaterial color="#252829" flatShading />
      </mesh>
      {[-0.66, 0.66].map((x) => (
        <mesh key={x} position={[x, 0.52, 0.61]}>
          <boxGeometry args={[0.16, 0.58, 0.1]} />
          <meshLambertMaterial color="#3c4142" flatShading />
        </mesh>
      ))}
    </group>
  )
}

function FuelLamp({ shape, position }) {
  if (!shape) return null
  const color = SHAPE_META[shape].color
  return (
    <mesh position={position}>
      <octahedronGeometry args={[0.1, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} flatShading />
      <pointLight color={color} intensity={1.1} distance={2.4} />
    </mesh>
  )
}

function Assembler({ active }) {
  const coreRef = useRef()
  useFrame(({ clock }) => {
    if (coreRef.current) coreRef.current.rotation.y = clock.elapsedTime * 0.65
  })
  return (
    <group position={ASSEMBLER_POSITION.toArray()} rotation={[0, -0.45, 0]}>
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[1.45, 0.96, 1.05]} />
        <meshLambertMaterial color="#6d6b63" flatShading />
      </mesh>
      <mesh position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.38, 0.52, 0.55, 6]} />
        <meshLambertMaterial color="#292d2d" flatShading />
      </mesh>
      <mesh ref={coreRef} position={[0, 1.33, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color={active ? '#fff0a8' : '#7f7763'}
          emissive={active ? '#ffb94a' : '#211b13'}
          emissiveIntensity={active ? 1.65 : 0.25}
          flatShading
        />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.8, 0.16, 1.35]} />
        <meshLambertMaterial color="#343738" flatShading />
      </mesh>
    </group>
  )
}

function BuiltFurniture({ progression, activeId }) {
  const toasterBuilt = progression.built?.toaster
  const workbenchBuilt = progression.built?.workbench
  return (
    <>
      {toasterBuilt && (
        <group position={TOASTER_POSITION.toArray()} rotation={[0, 0.2, 0]}>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[1.3, 1.1, 0.8]} />
            <meshStandardMaterial
              color="#a59d89"
              emissive={activeId === 'toaster' ? '#927a3f' : '#241f17'}
              emissiveIntensity={activeId === 'toaster' ? 0.55 : 0.12}
              flatShading
            />
          </mesh>
          <mesh position={[0, 1.22, 0]}>
            <boxGeometry args={[0.82, 0.42, 0.58]} />
            <meshStandardMaterial color="#d2c6aa" emissive="#443b2a" emissiveIntensity={0.28} flatShading />
          </mesh>
          <mesh position={[0, 1.44, 0]}>
            <boxGeometry args={[0.5, 0.03, 0.22]} />
            <meshBasicMaterial color="#141718" />
          </mesh>
          <FuelLamp shape={progression.fuel?.toaster} position={[0.5, 1.24, 0.32]} />
        </group>
      )}

      {workbenchBuilt && (
        <group position={WORKBENCH_POSITION.toArray()} rotation={[0, 0.35, 0]}>
          <mesh position={[0, 0.82, 0]}>
            <boxGeometry args={[2.1, 0.16, 0.85]} />
            <meshStandardMaterial
              color="#66513b"
              emissive={activeId === 'workbench' ? '#79562f' : '#21160f'}
              emissiveIntensity={activeId === 'workbench' ? 0.65 : 0.12}
              flatShading
            />
          </mesh>
          {[-0.82, 0.82].map((x) => (
            <mesh key={x} position={[x, 0.4, 0]}>
              <boxGeometry args={[0.14, 0.8, 0.68]} />
              <meshLambertMaterial color="#403429" flatShading />
            </mesh>
          ))}
          <mesh position={[0.56, 1.02, 0]} rotation={[0, 0.2, 0]}>
            <boxGeometry args={[0.55, 0.22, 0.36]} />
            <meshLambertMaterial color="#303637" flatShading />
          </mesh>
          <FuelLamp shape={progression.fuel?.workbench} position={[-0.55, 1.03, 0]} />
        </group>
      )}
    </>
  )
}

function WhiteRoom({ focusId, activeInterface, progression }) {
  const activeId = activeInterface ?? focusId
  return (
    <>
      <color attach="background" args={['#d8d7d0']} />
      <fog attach="fog" args={['#d8d7d0', 8.5, 22]} />
      <hemisphereLight args={['#ffffff', '#aaa99f', 1.45]} />
      <directionalLight position={[3, 7, 4]} intensity={1.15} />

      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[12, 0.16, 12]} />
        <meshLambertMaterial color="#d7d5cc" flatShading />
      </mesh>
      <mesh position={[0, 3, -6]}>
        <boxGeometry args={[12, 6, 0.16]} />
        <meshLambertMaterial color="#d7d5cc" flatShading />
      </mesh>
      <mesh position={[-6, 3, 0]}>
        <boxGeometry args={[0.16, 6, 12]} />
        <meshLambertMaterial color="#d7d5cc" flatShading />
      </mesh>
      <mesh position={[6, 3, 0]}>
        <boxGeometry args={[0.16, 6, 12]} />
        <meshLambertMaterial color="#d7d5cc" flatShading />
      </mesh>

      <Apparatus active={activeId === 'apparatus'} />
      {progression.mechanismUnlocked && <Assembler active={activeId === 'assembler'} />}
      <BuiltFurniture progression={progression} activeId={activeId} />
    </>
  )
}

export default function WhiteSpace({ progression, onUseApparatus, onCraft, onFuel, onClearFuel }) {
  const [focusId, setFocusId] = useState(null)
  const [pointerLocked, setPointerLocked] = useState(Boolean(document.pointerLockElement))
  const [activeInterface, setActiveInterface] = useState(null)
  const audio = useGameAudio()
  const interfaceOpen = Boolean(activeInterface)

  useEffect(() => {
    const update = () => setPointerLocked(Boolean(document.pointerLockElement))
    document.addEventListener('pointerlockchange', update)
    return () => document.removeEventListener('pointerlockchange', update)
  }, [])

  const useApparatus = useCallback(() => {
    audio.playEnter()
    document.exitPointerLock?.()
    onUseApparatus()
  }, [audio, onUseApparatus])

  const openInterface = useCallback((interfaceId) => {
    document.exitPointerLock?.()
    setActiveInterface(interfaceId)
  }, [])

  const closeInterface = useCallback(() => {
    setActiveInterface(null)
    window.requestAnimationFrame(() => {
      document.getElementById('root')?.requestPointerLock?.()
    })
  }, [])

  const useFocused = useCallback(() => {
    if (interfaceOpen) return
    if (focusId === 'apparatus') useApparatus()
    if (focusId === 'assembler') openInterface('assembler')
    if (focusId === 'toaster' || focusId === 'workbench') openInterface(focusId)
  }, [focusId, interfaceOpen, openInterface, useApparatus])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'KeyE' && !interfaceOpen) useFocused()
      if (event.code === 'Escape' && interfaceOpen) {
        event.preventDefault()
        closeInterface()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeInterface, interfaceOpen, useFocused])

  const prompt = useMemo(() => {
    if (focusId === 'apparatus') return { title: 'THE APPARATUS', action: 'PRESS E TO ENTER' }
    if (focusId === 'assembler') return { title: 'THE ASSEMBLER', action: 'PRESS E TO BUILD' }
    if (focusId === 'toaster' || focusId === 'workbench') {
      return { title: FURNITURE_RECIPES[focusId].label, action: 'PRESS E TO LOAD FUEL' }
    }
    return null
  }, [focusId])

  return (
    <main className="game-shell white-space-shell">
      <Canvas
        flat
        dpr={0.75}
        shadows={false}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        camera={{ fov: 62, near: 0.05, far: 40 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#d8d7d0')
          gl.outputColorSpace = THREE.SRGBColorSpace
          gl.toneMapping = THREE.NoToneMapping
        }}
      >
        <PlayerRig
          mechanismUnlocked={progression.mechanismUnlocked}
          built={progression.built}
          controlsEnabled={!interfaceOpen}
          onFocusChange={setFocusId}
          onStep={audio.playStep}
          onUnlockAudio={audio.unlock}
        />
        <WhiteRoom focusId={focusId} activeInterface={activeInterface} progression={progression} />
      </Canvas>

      <div className="ps1-overlay" aria-hidden="true" />
      <div className="room-shapes">
        {SHAPE_KEYS.map((shape) => (
          <span key={shape} style={{ '--shape-color': SHAPE_META[shape].color }}>
            {SHAPE_META[shape].symbol} {progression.inventory?.[shape] ?? 0}
          </span>
        ))}
      </div>
      {!interfaceOpen && <div className="room-crosshair" aria-hidden="true">+</div>}
      {!pointerLocked && !interfaceOpen && <div className="room-help">CLICK TO CAPTURE MOUSE · WASD TO MOVE</div>}
      {prompt && !interfaceOpen && (
        <button className="apparatus-prompt" type="button" onClick={useFocused}>
          <strong>{prompt.title}</strong>
          <span>{prompt.action}</span>
        </button>
      )}

      {activeInterface === 'assembler' && (
        <AssemblerPanel
          progression={progression}
          onCraft={onCraft}
          onClose={closeInterface}
        />
      )}

      {(activeInterface === 'toaster' || activeInterface === 'workbench') && (
        <FurnitureFuelSelector
          key={activeInterface}
          furnitureId={activeInterface}
          progression={progression}
          onFuel={onFuel}
          onClearFuel={onClearFuel}
          onClose={closeInterface}
        />
      )}
    </main>
  )
}
