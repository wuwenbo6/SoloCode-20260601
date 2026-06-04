import { useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Hotspot = ({ position, onClick, isActive }) => {
  const meshRef = useRef();
  const glowRef = useRef();
  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.lookAt(camera.position);
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
    if (glowRef.current) {
      const glowScale = 1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
      glowRef.current.scale.setScalar(glowScale);
      glowRef.current.material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh
        ref={glowRef}
        position={[0, 0, 0]}
      >
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial
          color={isActive ? '#00ff88' : '#ff6b6b'}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <ringGeometry args={[0.15, 0.3, 16]} />
        <meshBasicMaterial
          color={hovered ? '#ffaa00' : (isActive ? '#00ff88' : '#ff6b6b')}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
};

export default Hotspot;
