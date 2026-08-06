import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useGameAudio from '../audio/useGameAudio.js'

const APPARATUS_POSITION = new THREE.Vector3(0, 0, -4.4)
const PLAYER_HEIGHT = 1.62
const PLAYER_SPEED = 3.1

function PlayerRig({ onNearChange, onStep, onUnlockAudio }) {
  const { camera, gl } = useThree()
  const keysRef = useRef(new Set())
  const yawRef = useRef(0)
  const pitchRef = useRef(-0.04)
  const nearRef = useRef(false)
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
      keysRef.current.add(event.code)
    }
    const onKeyUp = (event) => keysRef.current.delete(event.code)
    const clearKeys = () => keysRef.current.clear()
    const onMouseMove = (event) => {
      if (document.pointerLockElement !== gl.domElement) return
      yawRef.current -= event.movementX * 0.0022
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - event.movementY * 0.002,
        -1.15,
        1.15,
      )
    }
    const requestLock = (event) => {
      if (event.button !== 0 || document.pointerLockElement === gl.domElement) return
      onUnlockAudio()
      gl.domElement.requestPointerLock?.()
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
  }, [camera, gl, onUnlockAudio])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    camera.rotation.set(pitchRef.current, yawRef.current, 0)

    const forward = forwardRef.current.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current))
    const right = rightRef.current.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current))
    const movement = movementRef.current.set(0, 0, 0)
    const keys = keysRef.current

    if (keys.has('KeyW')) movement.add(forward)
    if (keys.has('KeyS')) movement.sub(forward)
    if (keys.has('KeyD')) movement.add(right)
    if (keys.has('KeyA')) movement.sub(right)

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

    const distance = Math.hypot(
      camera.position.x - APPARATUS_POSITION.x,
      camera.position.z - APPARATUS_POSITION.z,
    )
    const near = distance < 2.65
    if (near !== nearRef.current) {
      nearRef.current = near
      onNearChange(near)
    }
  })

  return null
}

function Apparatus({ active, onUse }) {
  const rootRef = useRef()
  const screenRef = useRef()

  useFrame(({ clock }) => {
    if (rootRef.current) {
      rootRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.45) * 0.018
    }
    if (screenRef.current) {
      screenRef.current.material.emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 4.2) * 0.35
    }
  })

  return (
    <group
      ref={rootRef}
      position={[APPARATUS_POSITION.x, APPARATUS_POSITION.y, APPARATUS_POSITION.z]}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (active) onUse()
      }}
    >
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

function WhiteRoom({ near, onUse }) {
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

      <Apparatus active={near} onUse={onUse} />
    </>
  )
}

export default function WhiteSpace({ currency, onUseApparatus }) {
  const [near, setNear] = useState(false)
  const [pointerLocked, setPointerLocked] = useState(false)
  const audio = useGameAudio()

  useEffect(() => {
    const update = () => setPointerLocked(Boolean(document.pointerLockElement))
    document.addEventListener('pointerlockchange', update)
    return () => document.removeEventListener('pointerlockchange', update)
  }, [])

  const useApparatus = useCallback(() => {
    if (!near) return
    audio.playEnter()
    document.exitPointerLock?.()
    onUseApparatus()
  }, [audio, near, onUseApparatus])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'KeyE') useApparatus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [useApparatus])

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
        <PlayerRig onNearChange={setNear} onStep={audio.playStep} onUnlockAudio={audio.unlock} />
        <WhiteRoom near={near} onUse={useApparatus} />
      </Canvas>

      <div className="ps1-overlay" aria-hidden="true" />
      <div className="room-currency">MATERIAL {String(currency).padStart(4, '0')}</div>
      <div className="room-crosshair" aria-hidden="true">+</div>
      {!pointerLocked && <div className="room-help">CLICK TO CAPTURE MOUSE · WASD TO MOVE</div>}
      {near && (
        <button className="apparatus-prompt" type="button" onClick={useApparatus}>
          <strong>THE APPARATUS</strong>
          <span>PRESS E TO ENTER</span>
        </button>
      )}
    </main>
  )
}
