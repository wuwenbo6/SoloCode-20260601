import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PlayerAvatar = ({ player, isLocal = false }) => {
  const groupRef = useRef();
  const headRef = useRef();
  const targetPos = useRef(new THREE.Vector3());
  const targetRot = useRef(0);

  useFrame((_, delta) => {
    if (groupRef.current && player.position) {
      targetPos.current.set(player.position.x, player.position.y || 1.6, player.position.z);
      groupRef.current.position.lerp(targetPos.current, delta * 10);
      
      targetRot.current = player.rotation?.y || 0;
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRot.current,
        delta * 10
      );
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.4, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
        <meshStandardMaterial color={player.color || '#4ecdc4'} />
      </mesh>
      
      <mesh ref={headRef} position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={player.color || '#4ecdc4'} />
      </mesh>
      
      <mesh position={[0, 0.3, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.15, 8]} />
        <meshBasicMaterial color="#333" />
      </mesh>

      {player.muted && (
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#ff4444" />
        </mesh>
      )}

      {isLocal && (
        <mesh position={[0, 1, 0]}>
          <ringGeometry args={[0.3, 0.35, 32]} />
          <meshBasicMaterial color={player.color || '#4ecdc4'} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};

const MultiplayerPlayers = ({ players, localPlayerId }) => {
  return (
    <>
      {players.map(player => (
        <PlayerAvatar
          key={player.id}
          player={player}
          isLocal={player.id === localPlayerId}
        />
      ))}
    </>
  );
};

export default MultiplayerPlayers;
export { PlayerAvatar };
