import { useRef, useMemo } from 'react';
import * as THREE from 'three';

const ExhibitionHall = () => {
  const groupRef = useRef();

  const createWalls = useMemo(() => {
    const walls = [];
    const wallHeight = 4;
    const wallThickness = 0.3;
    const roomSize = 20;

    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: '#f5f5f5',
      roughness: 0.8,
      metalness: 0.1
    });

    const collisionUserData = { collidable: true };

    walls.push(
      <mesh key="floor" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} userData={{ collidable: false }}>
        <planeGeometry args={[roomSize, roomSize]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
    );

    walls.push(
      <mesh key="ceiling" rotation={[Math.PI / 2, 0, 0]} position={[0, wallHeight, 0]} userData={{ collidable: false }}>
        <planeGeometry args={[roomSize, roomSize]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    );

    walls.push(
      <mesh key="wall-back" position={[0, wallHeight / 2, -roomSize / 2]} userData={collisionUserData}>
        <boxGeometry args={[roomSize, wallHeight, wallThickness]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
    );

    walls.push(
      <mesh key="wall-front" position={[0, wallHeight / 2, roomSize / 2]} userData={collisionUserData}>
        <boxGeometry args={[roomSize, wallHeight, wallThickness]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
    );

    walls.push(
      <mesh key="wall-left" position={[-roomSize / 2, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} userData={collisionUserData}>
        <boxGeometry args={[roomSize, wallHeight, wallThickness]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
    );

    walls.push(
      <mesh key="wall-right" position={[roomSize / 2, wallHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]} userData={collisionUserData}>
        <boxGeometry args={[roomSize, wallHeight, wallThickness]} />
        <primitive object={wallMaterial} attach="material" />
      </mesh>
    );

    return walls;
  }, []);

  const createPillars = useMemo(() => {
    const pillars = [];
    const pillarPositions = [
      [-8, -8], [8, -8], [-8, 8], [8, 8],
      [-4, 0], [4, 0], [0, -4], [0, 4]
    ];

    const collisionUserData = { collidable: true };

    pillarPositions.forEach(([x, z], i) => {
      pillars.push(
        <mesh key={`pillar-${i}`} position={[x, 2, z]} userData={collisionUserData}>
          <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
          <meshStandardMaterial color="#d4a574" />
        </mesh>
      );
    });

    return pillars;
  }, []);

  const createExhibitDisplays = useMemo(() => {
    const displays = [];
    const displayPositions = [
      { x: -5, z: 5, rotY: 0 },
      { x: 5, z: 5, rotY: 0 },
      { x: -5, z: -5, rotY: 0 },
      { x: 5, z: -5, rotY: 0 },
      { x: 0, z: 8, rotY: 0 },
      { x: 0, z: -8, rotY: 0 },
      { x: -8, z: 0, rotY: Math.PI / 2 },
      { x: 8, z: 0, rotY: -Math.PI / 2 }
    ];

    const collisionUserData = { collidable: true };

    displayPositions.forEach((pos, i) => {
      displays.push(
        <group key={`display-${i}`} position={[pos.x, 0, pos.z]} rotation={[0, pos.rotY, 0]}>
          <mesh position={[0, 0.5, 0]} userData={collisionUserData}>
            <boxGeometry args={[2, 1, 0.8]} />
            <meshStandardMaterial color="#8b4513" />
          </mesh>
          <mesh position={[0, 1.5, 0]} userData={collisionUserData}>
            <boxGeometry args={[1.5, 1, 0.05]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
        </group>
      );
    });

    return displays;
  }, []);

  const createObstacles = useMemo(() => {
    const obstacles = [];
    const collisionUserData = { collidable: true };
    
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const radius = 6 + (i % 3) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
      if (Math.abs(x) > 9 || Math.abs(z) > 9) continue;
      
      const height = 0.3 + Math.random() * 0.5;
      const width = 0.2 + Math.random() * 0.3;
      
      obstacles.push(
        <mesh 
          key={`obstacle-${i}`} 
          position={[x, height / 2, z]} 
          userData={collisionUserData}
        >
          <boxGeometry args={[width, height, width]} />
          <meshStandardMaterial 
            color={new THREE.Color().setHSL(i / 80, 0.5, 0.6)} 
          />
        </mesh>
      );
    }

    return obstacles;
  }, []);

  const createLights = useMemo(() => {
    const lights = [];
    
    lights.push(
      <ambientLight key="ambient" intensity={0.6} />,
      <pointLight key="main" position={[0, 6, 0]} intensity={1} castShadow />
    );

    const lightPositions = [
      [-8, 3.5, -8], [8, 3.5, -8], [-8, 3.5, 8], [8, 3.5, 8],
      [-4, 3.5, 0], [4, 3.5, 0], [0, 3.5, -4], [0, 3.5, 4]
    ];

    lightPositions.forEach(([x, y, z], i) => {
      lights.push(
        <pointLight key={`light-${i}`} position={[x, y, z]} intensity={0.4} />
      );
    });

    return lights;
  }, []);

  return (
    <group ref={groupRef}>
      {createLights}
      {createWalls}
      {createPillars}
      {createExhibitDisplays}
      {createObstacles}
    </group>
  );
};

export default ExhibitionHall;
