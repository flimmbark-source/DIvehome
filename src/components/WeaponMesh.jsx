import { SHAPE_META } from '../game/progression.js'
import { fireModeFor } from '../game/weapon.js'

export default function WeaponMesh({
  depthTest = true,
  fireMode = 'projectile',
  loadedShape = null,
  flashRef = null,
}) {
  const mode = fireModeFor(fireMode)
  const toolingColor = loadedShape ? SHAPE_META[loadedShape]?.color : '#7bffe0'
  const commonBasic = { depthTest, toneMapped: false }
  const commonStandard = { depthTest, flatShading: true }
  const inspectionRotation = !depthTest && !flashRef
    ? [-0.08, Math.PI / 2, -0.04]
    : [0, 0, 0]

  return (
    <group rotation={inspectionRotation}>
      <mesh>
        <boxGeometry args={[0.34, 0.4, 1.18]} />
        <meshBasicMaterial color="#151719" {...commonBasic} />
      </mesh>
      <mesh position={[0, 0.015, -0.01]}>
        <boxGeometry args={[0.28, 0.34, 1.12]} />
        <meshStandardMaterial
          color="#d7ccb1"
          emissive="#453b2b"
          emissiveIntensity={0.55}
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

      <mesh position={[0, 0.2, -0.28]}>
        <boxGeometry args={[0.075, 0.12, 0.21]} />
        <meshStandardMaterial
          color={toolingColor}
          emissive={toolingColor}
          emissiveIntensity={loadedShape ? 1.65 : 0.72}
          toneMapped={false}
          {...commonStandard}
        />
      </mesh>
      <mesh position={[0.145, 0.025, 0.03]}>
        <boxGeometry args={[0.035, 0.24, 0.72]} />
        <meshBasicMaterial color="#e8793f" {...commonBasic} />
      </mesh>
      <pointLight position={[0.16, 0.12, -0.45]} color={toolingColor} intensity={0.75} distance={2.2} />

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
