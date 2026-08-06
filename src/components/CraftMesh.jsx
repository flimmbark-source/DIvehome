import { SHAPE_META } from '../game/progression.js'
import { fireModeFor } from '../game/weapon.js'

export default function CraftMesh({
  depthTest = true,
  bodyShape = null,
  clipShape = null,
  fireMode = 'projectile',
  flashRef = null,
  diving = false,
}) {
  const mode = fireModeFor(fireMode)
  const bodyColor = bodyShape ? SHAPE_META[bodyShape]?.color : '#d7ccb1'
  const clipColor = clipShape ? SHAPE_META[clipShape]?.color : '#7bffe0'
  const commonBasic = { depthTest, toneMapped: false }
  const commonStandard = { depthTest, flatShading: true, toneMapped: false }

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.44, 1.55, 5]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={bodyColor}
          emissiveIntensity={bodyShape ? 0.72 : 0.22}
          {...commonStandard}
        />
      </mesh>

      <mesh position={[0, -0.02, 0.22]} scale={[1.55, 0.35, 0.7]}>
        <octahedronGeometry args={[0.58, 0]} />
        <meshStandardMaterial
          color="#20272a"
          emissive={bodyColor}
          emissiveIntensity={bodyShape ? 0.28 : 0.08}
          {...commonStandard}
        />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.62, -0.03, 0.18]}>
          <mesh rotation={[0, 0, side * -0.18]}>
            <boxGeometry args={[0.78, 0.09, 0.58]} />
            <meshStandardMaterial
              color="#343d40"
              emissive={bodyColor}
              emissiveIntensity={bodyShape ? 0.22 : 0.05}
              {...commonStandard}
            />
          </mesh>
          <mesh position={[side * 0.23, -0.09, 0.13]}>
            <boxGeometry args={[0.24, 0.2, 0.56]} />
            <meshStandardMaterial
              color={clipColor}
              emissive={clipColor}
              emissiveIntensity={clipShape ? 1.35 : 0.42}
              {...commonStandard}
            />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 0.22, -0.08]} scale={[0.72, 0.34, 0.85]}>
        <sphereGeometry args={[0.34, 6, 4]} />
        <meshStandardMaterial
          color="#182d35"
          emissive="#65cde8"
          emissiveIntensity={0.58}
          transparent
          opacity={0.94}
          {...commonStandard}
        />
      </mesh>

      <group position={[0, 0, -0.9]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={mode.id === 'hitscan' ? [0.07, 0.09, 0.3, 6] : [0.13, 0.09, 0.3, 6]}
          />
          <meshStandardMaterial
            color={mode.color}
            emissive={mode.color}
            emissiveIntensity={1.7}
            {...commonStandard}
          />
        </mesh>
        {mode.id === 'projectile' && (
          <mesh position={[0, 0, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.16, 0.026, 4, 8]} />
            <meshBasicMaterial color={mode.color} {...commonBasic} />
          </mesh>
        )}
      </group>

      {[-0.34, 0.34].map((x) => (
        <group key={x} position={[x, -0.04, 0.78]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.14, 0.28, 6]} />
            <meshStandardMaterial color="#101416" emissive="#26343b" emissiveIntensity={0.32} {...commonStandard} />
          </mesh>
          <mesh position={[0, 0, 0.28]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, diving ? 1.85 : 1]}>
            <coneGeometry args={[0.13, diving ? 0.78 : 0.46, 5]} />
            <meshBasicMaterial
              color={diving ? '#dffcff' : '#76d9ff'}
              transparent
              opacity={diving ? 0.92 : 0.68}
              depthWrite={false}
              {...commonBasic}
            />
          </mesh>
        </group>
      ))}

      <pointLight position={[0, 0.05, 0.5]} color={clipColor} intensity={0.65} distance={2.6} />

      {flashRef && (
        <group ref={flashRef} position={[0, 0, -1.16]} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.24, 0.72, 5]} />
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
            <coneGeometry args={[0.14, 0.5, 4]} />
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
