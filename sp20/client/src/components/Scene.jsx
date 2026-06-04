import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import ExhibitionHall from './ExhibitionHall';
import Hotspot from './Hotspot';
import FirstPersonControls from './FirstPersonControls';
import MultiplayerPlayers from './MultiplayerPlayers';
import { findPath, smoothPath } from '../utils/pathfinding';
import collisionManager from '../utils/collision';

const NavigationController = ({ 
  isNavigating, 
  setIsNavigating,
  targetPath, 
  setTargetPath,
  position, 
  setPosition,
  rotation,
  setRotation
}) => {
  const { camera, scene } = useThree();
  const pathIndex = useRef(0);
  const pathProgress = useRef([]);
  const lastValidPosition = useRef(null);
  const stuckCounter = useRef(0);
  const isPathValidated = useRef(false);
  const navigationSpeed = useRef(3);

  const processAndValidatePath = useCallback((rawPath) => {
    if (!rawPath || rawPath.length === 0) return [];

    let processedPath = [...rawPath];
    
    for (let i = 0; i < processedPath.length; i++) {
      const point = processedPath[i];
      if (!point.y) point.y = position.y || 1.6;
    }

    if (collisionManager.bvh) {
      processedPath = collisionManager.validatePath(processedPath);
      
      for (let i = 0; i < processedPath.length; i++) {
        const point = processedPath[i];
        if (collisionManager.checkCollision(point)) {
          console.warn(`Path point ${i} is inside collision, finding safe position`);
          processedPath[i] = collisionManager.findSafePosition(point, 12, 2.5);
        }
      }
    }

    const smoothed = smoothPath(processedPath, 0.15);

    if (collisionManager.bvh) {
      for (let i = 0; i < smoothed.length; i++) {
        const point = smoothed[i];
        if (collisionManager.checkCollision(point)) {
          console.warn(`Smoothed path point ${i} is inside collision, finding safe position`);
          smoothed[i] = collisionManager.findSafePosition(point, 12, 2.5);
        }
      }
    }

    return smoothed;
  }, [position.y]);

  const emergencyRecovery = useCallback((currentPos) => {
    console.warn('Emergency recovery: camera appears to be stuck');
    
    if (lastValidPosition.current) {
      const safePos = collisionManager.findSafePosition(lastValidPosition.current, 10, 2);
      setPosition(safePos);
      camera.position.set(safePos.x, safePos.y, safePos.z);
      console.log('Recovered to last valid position');
      return true;
    }
    return false;
  }, [camera, setPosition]);

  const tryMove = useCallback((fromPos, delta) => {
    if (!collisionManager.bvh) {
      return {
        collided: false,
        newPosition: {
          x: fromPos.x + delta.x,
          y: fromPos.y,
          z: fromPos.z + delta.z
        }
      };
    }

    return collisionManager.sweepCollision(fromPos, delta);
  }, []);

  useEffect(() => {
    if (targetPath && targetPath.length > 0) {
      const validatedPath = processAndValidatePath(targetPath);
      
      if (validatedPath.length === 0) {
        console.warn('No valid path found');
        setTargetPath(null);
        return;
      }

      pathIndex.current = 0;
      pathProgress.current = validatedPath;
      isPathValidated.current = true;
      stuckCounter.current = 0;
      lastValidPosition.current = { ...position };
      setIsNavigating(true);
      
      console.log(`Navigation started: ${validatedPath.length} waypoints`);
    }
  }, [targetPath, setIsNavigating, setTargetPath, processAndValidatePath, position]);

  useFrame((_, delta) => {
    if (!isNavigating || !pathProgress.current || pathProgress.current.length === 0) return;

    const adaptiveDelta = Math.min(delta, 0.05);
    const speed = navigationSpeed.current * adaptiveDelta;
    const currentTarget = pathProgress.current[pathIndex.current];
    
    if (!currentTarget) {
      setIsNavigating(false);
      setTargetPath(null);
      console.log('Navigation complete');
      return;
    }

    const dx = currentTarget.x - position.x;
    const dz = currentTarget.z - position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.15) {
      lastValidPosition.current = { ...position };
      stuckCounter.current = 0;
      pathIndex.current++;
      
      if (pathIndex.current >= pathProgress.current.length) {
        setIsNavigating(false);
        setTargetPath(null);
        console.log('Navigation complete');
      }
      return;
    }

    if (dist < 0.001) {
      stuckCounter.current++;
      if (stuckCounter.current > 60) {
        if (!emergencyRecovery(position)) {
          setIsNavigating(false);
          setTargetPath(null);
        }
      }
      return;
    }

    const moveX = (dx / dist) * speed;
    const moveZ = (dz / dist) * speed;

    const moveResult = tryMove(position, { x: moveX, y: 0, z: moveZ });

    if (moveResult.collided) {
      stuckCounter.current++;
      
      if (stuckCounter.current > 30) {
        console.warn('Stuck during navigation, attempting recovery');
        
        const safePos = collisionManager.findSafePosition(position, 15, 3);
        if (safePos.x !== position.x || safePos.z !== position.z) {
          setPosition(safePos);
          camera.position.set(safePos.x, safePos.y, safePos.z);
          stuckCounter.current = 0;
          return;
        }
        
        if (stuckCounter.current > 120) {
          if (!emergencyRecovery(position)) {
            console.error('Failed to recover, aborting navigation');
            setIsNavigating(false);
            setTargetPath(null);
          }
          return;
        }
      }
    } else {
      stuckCounter.current = 0;
    }

    const newPos = moveResult.newPosition;
    
    if (Math.abs(newPos.x - position.x) > 0.001 || Math.abs(newPos.z - position.z) > 0.001) {
      lastValidPosition.current = { ...position };
    }

    setPosition(newPos);
    camera.position.set(newPos.x, newPos.y, newPos.z);

    const targetAngle = Math.atan2(dx, dz);
    const angleDiff = targetAngle - rotation.y;
    const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    const rotationSpeed = 8 * adaptiveDelta;
    const newRotationY = rotation.y + normalizedDiff * rotationSpeed;
    
    setRotation({
      ...rotation,
      y: newRotationY
    });

    camera.rotation.order = 'YXZ';
    camera.rotation.y = newRotationY;
  });

  return null;
};

const BVHBuilder = ({ onBVHReady }) => {
  const { scene } = useThree();
  const built = useRef(false);

  useEffect(() => {
    const buildBVH = () => {
      if (built.current) return;
      
      const collisionMeshes = [];
      scene.traverse((object) => {
        if (object.isMesh && object.userData.collidable !== false) {
          collisionMeshes.push(object);
        }
      });

      if (collisionMeshes.length > 0) {
        console.log(`Building BVH from ${collisionMeshes.length} collision meshes...`);
        collisionManager.buildFromMeshes(collisionMeshes);
        built.current = true;
        if (onBVHReady) onBVHReady(collisionManager);
      } else {
        console.warn('No collision meshes found, will retry in 500ms');
        setTimeout(buildBVH, 500);
      }
    };

    const timer = setTimeout(buildBVH, 100);
    return () => clearTimeout(timer);
  }, [scene, onBVHReady]);

  return null;
};

const PerformanceMonitor = () => {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    
    if (now - lastTime.current >= 1000) {
      const fps = frameCount.current;
      frameCount.current = 0;
      lastTime.current = now;
      
      if (fps < 20) {
        console.warn(`Low FPS detected: ${fps}`);
      }
      
      collisionManager.resetStats();
    }
  });

  return null;
};

const SceneContent = ({
  position,
  setPosition,
  rotation,
  setRotation,
  hotspots,
  onHotspotClick,
  activeHotspot,
  isNavigating,
  setIsNavigating,
  targetPath,
  setTargetPath,
  navmesh,
  bounds,
  onBVHReady,
  multiplayerPlayers,
  localPlayerId
}) => {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(position.x, position.y, position.z);
  }, []);

  return (
    <>
      <fog attach="fog" args={['#87ceeb', 10, 50]} />
      
      <ExhibitionHall />
      
      {hotspots.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          position={hotspot.position}
          onClick={() => onHotspotClick(hotspot)}
          isActive={activeHotspot?.id === hotspot.id}
        />
      ))}

      {multiplayerPlayers && multiplayerPlayers.length > 0 && (
        <MultiplayerPlayers
          players={multiplayerPlayers}
          localPlayerId={localPlayerId}
        />
      )}

      <BVHBuilder onBVHReady={onBVHReady} />

      <NavigationController
        isNavigating={isNavigating}
        setIsNavigating={setIsNavigating}
        targetPath={targetPath}
        setTargetPath={setTargetPath}
        position={position}
        setPosition={setPosition}
        rotation={rotation}
        setRotation={setRotation}
      />

      <FirstPersonControls
        position={position}
        setPosition={setPosition}
        rotation={rotation}
        setRotation={setRotation}
        isNavigating={isNavigating}
        bounds={bounds}
      />

      <PerformanceMonitor />
    </>
  );
};

const Scene = ({
  position,
  setPosition,
  rotation,
  setRotation,
  hotspots,
  onHotspotClick,
  activeHotspot,
  isNavigating,
  setIsNavigating,
  targetPath,
  setTargetPath,
  navmesh,
  bounds,
  onBVHReady,
  multiplayerPlayers,
  localPlayerId
}) => {
  return (
    <Canvas
      shadows
      camera={{ fov: 75, near: 0.1, far: 1000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <SceneContent
        position={position}
        setPosition={setPosition}
        rotation={rotation}
        setRotation={setRotation}
        hotspots={hotspots}
        onHotspotClick={onHotspotClick}
        activeHotspot={activeHotspot}
        isNavigating={isNavigating}
        setIsNavigating={setIsNavigating}
        targetPath={targetPath}
        setTargetPath={setTargetPath}
        navmesh={navmesh}
        bounds={bounds}
        onBVHReady={onBVHReady}
        multiplayerPlayers={multiplayerPlayers}
        localPlayerId={localPlayerId}
      />
    </Canvas>
  );
};

export default Scene;
