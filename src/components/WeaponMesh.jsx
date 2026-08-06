import { useEffect, useState } from 'react'
import { SHAPE_META } from '../game/progression.js'
import { fireModeFor } from '../game/weapon.js'
import CraftMesh from './CraftMesh.jsx'

function initialPreviewMode() {
  if (typeof window === 'undefined') return 'holster'
  return window.__divehomeWeaponPreview === 'apparatus' ? 'apparatus' : 'holster'
}

export default function WeaponMesh({
  depthTest = true,
  fireMode = 'projectile',
  loadedShape = null,
  bodyShape = null,
  clipShape = null,
  flashRef = null,
}) {
  const mode = fireModeFor(fireMode)
  const resolvedClipShape = clipShape ?? loadedShape
  const bodyColor = bodyShape ? SHAPE_META[bodyShape]?.color : '#d7ccb1'
  const clipColor = resolvedClipShape ? SHAPE_META[resolvedClipShape]?.color : '#7b8580'
  const commonBasic = { depthTest, toneMapped: false }
  const commonStandard = { depthTest, flatShading: true }
  const inspection = !depthTest && !flashRef
  const [previewMode, setPreviewMode] = useState(initialPreviewMode)
  const inspectionRotation = inspection
    ? [-0.08, Math.PI / 2, -0.04]
    : [0, 0, 0]

  useEffect(() => {
    if (!inspection) return undefined
    const onPreview = (event) => {
      setPreviewMode(event.detail === 'apparatus' ? 'apparatus' : 'holster')
    }
    window.addEventListener('divehome-weapon-preview', onPreview)
    return () => window.removeEventListener('divehome-weapon-preview', onPreview)
  }, [inspection])

  if (inspection && previewMode === 'apparatus') {
    return (
      <group rotation={inspectionRotation} scale={0.88}>
        <CraftMesh
          depthTest={false}
          fireMode={fireMode}
          bodyShape={bodyShape}
          clipShape={resolvedClipShape}
        />
      </group>
    )
  }

  return (
    <group rotation={inspectionRotation}>
      <mesh>
        <boxGeometry args={[0.34, 0.4, 1.18]} />
        <meshBasicMaterial color="#151719" {...commonBasic} />
      </mesh>
      <mesh position={[0, 0.015, -0.01]}>
        <boxGeometry args={[0.28, 0.34, 1.12]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={bodyShape ? bodyColor : '#453b2b'}
          emissiveIntensity={bodyShape ? 0.72 : 0.55}
          toneMapped={false}
          {...commonStandard}
        />
      </mesh>
      <mesh position={[0, -0.24, 0.2]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[0.24, 0.58, 0.3]} />
        <meshStandardMaterial
          color="#3a2922"
          emissive="#170c08"
          emissiveIntensity={0.35}
          {...commonStandard}
        />
      </mesh>

      <group position={[0, 0.02, -0.73]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.078, 0.1, 0.68, 6]} />
          <meshBasicMaterial color="#080a0b" {...commonBasic} />
        </mesh>
        <mesh position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={mode.id === 'hitscan' ? [0.052, 0.072, 0.22, 6] : [0.11, 0.082, 0.2, 6]}
          />
          <meshStandardMaterial
            color={mode.color}
            emissive={mode.color}
            emissiveIntensity={1.35}
            toneMapped={false}
            {...commonStandard}
          />
        </mesh>
        {mode.id === 'projectile' && (
          <mesh position={[0, 0, -0.51]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.13, 0.025, 4, 8]} />
            <meshBasicMaterial color={mode.color} {...commonBasic} />
          </mesh>
        )}
      </group>

      <mesh position={[0.145, 0.09, -0.18]}>
        <boxGeometry args={[0.035, 0.18, 0.48]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={bodyColor}
          emissiveIntensity={bodyShape ? 1.55 : 0.35}
          toneMapped={false}
          {...commonStandard}
        />
      </mesh>

      <mesh position={[0, -0.2, -0.03]} rotation={[0.08, 0, 0]}>
        <boxGeometry args={[0.21, 0.38, 0.32]} />
        <meshStandardMaterial
          color={clipColor}
          emissive={clipColor}
          emissiveIntensity={resolvedClipShape ? 1.65 : 0.32}
          toneMapped={false}
          {...commonStandard}
        />
      </mesh>

      <mesh position={[0.145, 0.025, 0.03]}>
        <boxGeometry args={[0.035, 0.24, 0.72]} />
        <meshBasicMaterial color="#e8793f" {...commonBasic} />
      </mesh>
      <pointLight position={[0.16, 0.12, -0.45]} color={bodyShape ? bodyColor : mode.color} intensity={0.75} distance={2.2} />

      {flashRef && (
        <group ref={flashRef} position={[0, 0.02, -1.12]} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.25, 0.72, 5]} />
            <meshBasicMaterial
              color={mode.id === 'hitscan' ? '#dffff6' : '#fff2a8'}
              transparent
              opacity={0.92}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 5]}>
            <coneGeometry args={[0.14, 0.52, 4]} />
            <meshBasicMaterial
              color={mode.color}
              transparent
              opacity={0.88}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
          <pointLight color={mode.color} intensity={7} distance={4.5} decay={2} />
        </group>
      )}
    </group>
  )
}
