import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const ExhibitModel = ({ modelUrl, scale = 1 }) => {
  const groupRef = useRef();
  const [model, setModel] = useState(null);

  useFrame((state) => {
    if (!model && groupRef.current) {
      const geometry = new THREE.TorusKnotGeometry(0.5, 0.15, 100, 16);
      const material = new THREE.MeshStandardMaterial({
        color: '#ffd700',
        metalness: 0.8,
        roughness: 0.2
      });
      const mesh = new THREE.Mesh(geometry, material);
      groupRef.current.add(mesh);
      setModel(mesh);
    }
  });

  return (
    <group ref={groupRef} scale={scale}>
      {model && <primitive object={model} />}
    </group>
  );
};

const ExhibitViewer3D = ({ exhibit, onClose }) => {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.95)',
      zIndex: 2000
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        textAlign: 'center',
        zIndex: 10
      }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{exhibit?.name || '展品查看'}</h2>
        <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#aaa' }}>
          鼠标拖拽旋转 | 滚轮缩放 | 右键平移
        </p>
      </div>

      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 10
      }}>
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          style={{
            padding: '10px 16px',
            background: autoRotate ? '#4CAF50' : '#333',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {autoRotate ? '⏸ 停止旋转' : '▶ 自动旋转'}
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          style={{
            padding: '10px 16px',
            background: showGrid ? '#2196F3' : '#333',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {showGrid ? '⊡ 隐藏网格' : '⊡ 显示网格'}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '10px 16px',
            background: '#f44336',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          ✕ 关闭
        </button>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        color: 'white',
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '16px',
        borderRadius: '8px',
        maxWidth: '350px',
        zIndex: 10
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>{exhibit?.name}</h3>
        <p style={{ margin: '0 0 8px 0', color: '#4CAF50', fontSize: '0.85rem' }}>
          {exhibit?.era} · {exhibit?.origin}
        </p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc', lineHeight: '1.5' }}>
          {exhibit?.description}
        </p>
      </div>

      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        
        <ExhibitModel modelUrl={exhibit?.modelUrl} scale={1} />
        
        {showGrid && (
          <gridHelper args={[10, 10, '#444', '#222']} position={[0, -1, 0]} />
        )}
        
        <ContactShadows
          position={[0, -1, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />
        
        <OrbitControls
          autoRotate={autoRotate}
          autoRotateSpeed={1.5}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={10}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI - 0.1}
        />
        
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default ExhibitViewer3D;
