import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, ContactShadows } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useRobotStore } from '@/store/robotStore'

const JOINT_LENGTHS = [0.3, 0.25, 0.2, 0.15, 0.12, 0.1]
const MAX_ANGLE = Math.PI

function getColor(angle: number, index: number) {
  const t = Math.min(1, Math.abs(angle) / MAX_ANGLE)
  const r = Math.floor(255 * t)
  const g = Math.floor(255 * (1 - t))
  return `rgb(${r}, ${g}, ${50 + index * 30})`
}

function RobotBody() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.5, 0.6]} />
        <meshStandardMaterial color="#2a3040" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.9, 0.1, 0.7]} />
        <meshStandardMaterial color="#1a1f2e" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}

function Wheel({ position, speed }: { position: [number, number, number]; speed: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.x += speed * dt * 5
    }
  })
  return (
    <mesh ref={ref} position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
      <meshStandardMaterial color="#111827" metalness={0.3} roughness={0.7} />
    </mesh>
  )
}

function JointSegment({
  index,
  angle,
  isLast,
  children,
}: {
  index: number
  angle: number
  isLast: boolean
  children?: React.ReactNode
}) {
  const groupRef = useRef<THREE.Group>(null)
  const lerpAngleRef = useRef(0)

  useFrame((_, dt) => {
    lerpAngleRef.current += (angle - lerpAngleRef.current) * Math.min(1, dt * 30)
    if (groupRef.current) {
      groupRef.current.rotation.z = lerpAngleRef.current
    }
  })

  const length = JOINT_LENGTHS[index]
  const color = getColor(angle, index)
  const isFirst = index === 0
  const baseOffset: [number, number, number] = isFirst ? [0.4, 0.5, 0] : [0, 0, 0]

  return (
    <group position={baseOffset}>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>
      <group ref={groupRef} position={[0, 0, 0]}>
        <mesh position={[length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, length, 8]} />
          <meshStandardMaterial color="#3a4050" metalness={0.7} roughness={0.3} />
        </mesh>
        {isLast ? (
          <mesh position={[length, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.05, 0.1, 8]} />
            <meshStandardMaterial
              color="#ff3366"
              emissive="#ff3366"
              emissiveIntensity={0.5}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
        ) : (
          <group position={[length, 0, 0]}>{children}</group>
        )}
      </group>
    </group>
  )
}

function RobotArm({ jointAngles }: { jointAngles: number[] }) {
  return (
    <group>
      <JointSegment index={0} angle={jointAngles[0] || 0} isLast={false}>
        <JointSegment index={1} angle={jointAngles[1] || 0} isLast={false}>
          <JointSegment index={2} angle={jointAngles[2] || 0} isLast={false}>
            <JointSegment index={3} angle={jointAngles[3] || 0} isLast={false}>
              <JointSegment index={4} angle={jointAngles[4] || 0} isLast={false}>
                <JointSegment index={5} angle={jointAngles[5] || 0} isLast={true} />
              </JointSegment>
            </JointSegment>
          </JointSegment>
        </JointSegment>
      </JointSegment>
    </group>
  )
}

function RobotCamera() {
  return (
    <group position={[0, 0.7, 0]}>
      <mesh>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        <meshStandardMaterial color="#1a1f2e" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.04, 0.05, 0.06, 16]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#0066aa"
          emissiveIntensity={0.8}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
    </group>
  )
}

function Scene() {
  const wheelSpeeds = useRobotStore((s) => s.wheelSpeeds)
  const jointAngles = useRobotStore((s) => s.jointAngles)

  return (
    <>
      <color attach="background" args={['#0a0e17']} />
      <fog attach="fog" args={['#0a0e17', 10, 30]} />

      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[2, 3, 2]} intensity={0.5} color="#00ff88" />
      <pointLight position={[-2, 2, -2]} intensity={0.3} color="#ff3366" />

      <Grid
        position={[0, -0.1, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a3040"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#3a4050"
        fadeDistance={30}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={10} blur={2} far={4} />

      <RobotBody />
      <RobotArm jointAngles={jointAngles} />
      <RobotCamera />
      <Wheel position={[-0.35, 0.15, 0]} speed={wheelSpeeds[0]} />
      <Wheel position={[0.35, 0.15, 0]} speed={wheelSpeeds[1]} />

      <OrbitControls
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={2}
        maxDistance={10}
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
      </EffectComposer>
    </>
  )
}

export function Robot3D() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ position: [3, 2, 3], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Scene />
      </Canvas>
      <div className="absolute top-2 left-2 text-xs font-mono text-[#00ff88]/70 bg-[#0a0e17]/80 px-2 py-1 rounded border border-[#2a3040]">
        3D VIEW
      </div>
    </div>
  )
}
