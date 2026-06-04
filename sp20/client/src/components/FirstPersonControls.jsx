import { useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import collisionManager from '../utils/collision';

const FirstPersonControls = ({ 
  position, 
  setPosition, 
  rotation, 
  setRotation,
  isNavigating,
  bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }
}) => {
  const { camera } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false, shift: false });
  const mouseMovement = useRef({ x: 0, y: 0 });
  const isLocked = useRef(false);
  const lastFrameTime = useRef(performance.now());
  const frameCount = useRef(0);
  const fps = useRef(60);

  const clampToBounds = useCallback((pos) => {
    const r = collisionManager.playerRadius;
    return {
      x: Math.max(bounds.minX + r, Math.min(bounds.maxX - r, pos.x)),
      y: pos.y,
      z: Math.max(bounds.minZ + r, Math.min(bounds.maxZ - r, pos.z))
    };
  }, [bounds]);

  const tryMove = useCallback((fromPos, delta) => {
    if (!collisionManager.bvh) {
      const newPos = {
        x: fromPos.x + delta.x,
        y: fromPos.y,
        z: fromPos.z + delta.z
      };
      return clampToBounds(newPos);
    }

    const result = collisionManager.sweepCollision(fromPos, delta);
    return clampToBounds(result.newPosition);
  }, [clampToBounds]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key] = true;
      }
      if (e.key === 'Shift') {
        keys.current.shift = true;
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key] = false;
      }
      if (e.key === 'Shift') {
        keys.current.shift = false;
      }
    };

    const handleMouseMove = (e) => {
      if (isLocked.current && !isNavigating) {
        mouseMovement.current.x += e.movementX;
        mouseMovement.current.y += e.movementY;
      }
    };

    const handleClick = () => {
      if (!isNavigating) {
        document.body.requestPointerLock?.();
      }
    };

    const handlePointerLockChange = () => {
      isLocked.current = document.pointerLockElement === document.body;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [isNavigating]);

  useFrame((state, delta) => {
    if (isNavigating) {
      mouseMovement.current = { x: 0, y: 0 };
      return;
    }

    frameCount.current++;
    const now = performance.now();
    if (now - lastFrameTime.current >= 1000) {
      fps.current = frameCount.current;
      frameCount.current = 0;
      lastFrameTime.current = now;
      
      if (fps.current < 30) {
        console.warn(`Low FPS: ${fps.current}, collision checks: ${collisionManager.getStats().checksPerFrame}`);
      }
      collisionManager.resetStats();
    }

    const sensitivity = 0.002;
    const newRotation = {
      x: rotation.x - mouseMovement.current.y * sensitivity,
      y: rotation.y - mouseMovement.current.x * sensitivity
    };
    newRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newRotation.x));
    setRotation(newRotation);
    mouseMovement.current = { x: 0, y: 0 };

    camera.rotation.order = 'YXZ';
    camera.rotation.x = newRotation.x;
    camera.rotation.y = newRotation.y;

    const baseSpeed = keys.current.shift ? 8 : 5;
    const adaptiveDelta = Math.min(delta, 0.1);
    const speed = baseSpeed * adaptiveDelta;

    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
    right.normalize();

    const move = new THREE.Vector3();
    if (keys.current.w) move.add(direction);
    if (keys.current.s) move.sub(direction);
    if (keys.current.d) move.add(right);
    if (keys.current.a) move.sub(right);

    if (move.lengthSq() > 0.0001) {
      move.normalize().multiplyScalar(speed);
      
      const newPos = tryMove(position, { x: move.x, y: 0, z: move.z });
      
      if (newPos.x !== position.x || newPos.z !== position.z) {
        setPosition(newPos);
        camera.position.set(newPos.x, newPos.y, newPos.z);
      }
    }
  });

  return null;
};

export default FirstPersonControls;
