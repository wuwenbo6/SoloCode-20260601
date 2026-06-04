import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ARButton, XR, Interactive } from '@react-three/xr';
import * as THREE from 'three';

const ARExhibit = ({ position, exhibit, scale = 0.3 }) => {
  const groupRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [selected, setSelected] = useState(false);

  useFrame((state, delta) => {
    if (groupRef.current) {
      if (hovered || selected) {
        groupRef.current.rotation.y += delta * 2;
      }
    }
  });

  return (
    <Interactive
      onSelect={() => setSelected(!selected)}
      onHover={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <group ref={groupRef} position={position} scale={scale}>
        <mesh>
          <torusKnotGeometry args={[0.5, 0.15, 100, 16]} />
          <meshStandardMaterial
            color={hovered ? '#ff6b6b' : '#ffd700'}
            metalness={0.8}
            roughness={0.2}
            emissive={hovered ? '#ff6b6b' : '#000000'}
            emissiveIntensity={hovered ? 0.3 : 0}
          />
        </mesh>
        
        {selected && (
          <mesh position={[0, 1, 0]}>
            <ringGeometry args={[0.8, 1, 32]} rotation={[-Math.PI / 2, 0, 0]} />
            <meshBasicMaterial color="#4CAF50" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </Interactive>
  );
};

const ARFloorPlane = () => {
  const [planes, setPlanes] = useState([]);
  const { gl } = useThree();

  useEffect(() => {
    if (!gl.xr) return;

    const session = gl.xr.getSession();
    if (!session) return;

    session.addEventListener('planesdetected', (event) => {
      const detectedPlanes = Array.from(event.planes).map(plane => ({
        id: plane.id,
        position: new THREE.Vector3(
          plane.planeModelMatrix.elements[12],
          plane.planeModelMatrix.elements[13],
          plane.planeModelMatrix.elements[14]
        ),
        size: new THREE.Vector2(plane.extent.width, plane.extent.height)
      }));
      setPlanes(detectedPlanes);
    });
  }, [gl]);

  return (
    <>
      {planes.map(plane => (
        <mesh key={plane.id} position={plane.position} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[plane.size.x, plane.size.y]} />
          <meshBasicMaterial
            color="#4CAF50"
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
};

const ARMode = ({ exhibits, onClose }) => {
  const [isSupported, setIsSupported] = useState(true);
  const [isInAR, setIsInAR] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkSupport = async () => {
      if (!navigator.xr) {
        setIsSupported(false);
        return;
      }

      try {
        const supported = await navigator.xr.isSessionSupported('immersive-ar');
        setIsSupported(supported);
      } catch (err) {
        console.error('Error checking AR support:', err);
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  const handleSessionStart = () => {
    setIsInAR(true);
  };

  const handleSessionEnd = () => {
    setIsInAR(false);
  };

  const arExhibits = exhibits || [
    { id: 1, name: '展品 1', position: [0, 0, -1] },
    { id: 2, name: '展品 2', position: [1, 0, -1.5] },
    { id: 3, name: '展品 3', position: [-1, 0, -1.5] }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#000',
      zIndex: 2000
    }}>
      {!isSupported ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'white',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📱</div>
          <h2 style={{ margin: '0 0 16px 0' }}>AR 模式不可用</h2>
          <p style={{ margin: '0 0 24px 0', color: '#aaa', maxWidth: '400px' }}>
            您的设备不支持 WebXR AR 功能。请使用支持 AR 的设备（如 iPhone 或 Android ARCore 设备）
            并在浏览器中访问。
          </p>
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '24px',
            textAlign: 'left',
            maxWidth: '400px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>
              <strong>支持的浏览器：</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#ccc' }}>
              <li>Safari on iOS 15+</li>
              <li>Chrome on Android (with ARCore)</li>
              <li>WebXR Viewer (iOS)</li>
            </ul>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '12px 32px',
              background: '#2196F3',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            返回展厅
          </button>
        </div>
      ) : (
        <>
          {!isInAR && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'white',
              padding: '40px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🕶️</div>
              <h2 style={{ margin: '0 0 16px 0' }}>AR 增强现实模式</h2>
              <p style={{ margin: '0 0 24px 0', color: '#aaa', maxWidth: '400px' }}>
                点击下方按钮进入 AR 模式，将虚拟展品放置在您的真实环境中。
                请确保允许相机权限。
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '12px 32px',
                    background: '#444',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  返回
                </button>
              </div>
            </div>
          )}

          <XR
            onSessionStart={handleSessionStart}
            onSessionEnd={handleSessionEnd}
            sessionInit={{
              requiredFeatures: ['local', 'hit-test'],
              optionalFeatures: ['dom-overlay', 'plane-detection']
            }}
          >
            <Canvas
              gl={{ preserveDrawingBuffer: true, antialias: true }}
              camera={{ position: [0, 0, 0], fov: 50 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
            >
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              
              {arExhibits.map(exhibit => (
                <ARExhibit
                  key={exhibit.id}
                  position={exhibit.position}
                  exhibit={exhibit}
                  scale={0.3}
                />
              ))}
              
              <ARFloorPlane />
            </Canvas>
          </XR>

          <ARButton
            sessionInit={{
              requiredFeatures: ['hit-test'],
              optionalFeatures: ['dom-overlay']
            }}
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000
            }}
          />

          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              padding: '10px 20px',
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              zIndex: 1000
            }}
          >
            退出 AR
          </button>

          {isInAR && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              background: 'rgba(0, 0, 0, 0.6)',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              zIndex: 1000
            }}>
              👆 点击展品选中 | 📱 移动设备查看周围环境
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ARMode;
