import { useState, useEffect, useRef, useCallback } from 'react';
import Scene from './components/Scene';
import MiniMap from './components/MiniMap';
import InfoPanel from './components/InfoPanel';
import VoiceChatPanel from './components/VoiceChatPanel';
import ExhibitViewer3D from './components/ExhibitViewer3D';
import ARMode from './components/ARMode';
import { getConfig, getExhibits, getHotspots, getNavmesh } from './utils/api';
import { findPath } from './utils/pathfinding';
import collisionManager from './utils/collision';
import networkManager from './utils/networkManager';

function App() {
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 1.6, z: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [hotspots, setHotspots] = useState([]);
  const [exhibits, setExhibits] = useState([]);
  const [navmesh, setNavmesh] = useState({ nodes: [], edges: [] });
  const [config, setConfig] = useState(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [selectedExhibit, setSelectedExhibit] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetPath, setTargetPath] = useState(null);
  const [bvhReady, setBvhReady] = useState(false);
  const [fps, setFps] = useState(60);
  const fpsCounter = useRef(0);
  const lastFpsTime = useRef(performance.now());

  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const [showExhibitViewer, setShowExhibitViewer] = useState(false);
  const [viewerExhibit, setViewerExhibit] = useState(null);
  const [showARMode, setShowARMode] = useState(false);
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(false);
  const [players, setPlayers] = useState([]);
  const [localPlayerId, setLocalPlayerId] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [configData, exhibitsData, hotspotsData, navmeshData] = await Promise.all([
          getConfig(),
          getExhibits(),
          getHotspots(),
          getNavmesh()
        ]);
        
        setConfig(configData);
        setExhibits(exhibitsData);
        setHotspots(hotspotsData);
        setNavmesh(navmeshData);
        
        if (configData.playerStart) {
          setPosition(configData.playerStart);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!multiplayerEnabled) return;

    const connectMultiplayer = async () => {
      try {
        await networkManager.connect('http://localhost:5001');
        setLocalPlayerId(networkManager.playerId);
        setPlayers(networkManager.getPlayers());
      } catch (err) {
        console.error('Failed to connect to multiplayer:', err);
        setMultiplayerEnabled(false);
      }
    };

    connectMultiplayer();

    const handlePlayerJoined = () => {
      setPlayers(networkManager.getPlayers());
    };

    const handlePlayerLeft = () => {
      setPlayers(networkManager.getPlayers());
    };

    const handlePlayerMoved = () => {
      setPlayers([...networkManager.getPlayers()]);
    };

    networkManager.on('playerJoined', handlePlayerJoined);
    networkManager.on('playerLeft', handlePlayerLeft);
    networkManager.on('playerMoved', handlePlayerMoved);

    return () => {
      networkManager.off('playerJoined', handlePlayerJoined);
      networkManager.off('playerLeft', handlePlayerLeft);
      networkManager.off('playerMoved', handlePlayerMoved);
      networkManager.disconnect();
    };
  }, [multiplayerEnabled]);

  useEffect(() => {
    if (!multiplayerEnabled || !networkManager.connected) return;

    const interval = setInterval(() => {
      networkManager.updatePosition(position, rotation);
    }, 100);

    return () => clearInterval(interval);
  }, [multiplayerEnabled, position, rotation]);

  const handleBVHReady = useCallback((manager) => {
    console.log('BVH ready, collision detection enabled');
    setBvhReady(true);
  }, []);

  const handleHotspotClick = useCallback((hotspot) => {
    setActiveHotspot(hotspot);
    const exhibit = exhibits.find(e => e.id === hotspot.exhibitId);
    setSelectedExhibit(exhibit);
    document.exitPointerLock?.();
  }, [exhibits]);

  const handleCloseInfoPanel = useCallback(() => {
    setSelectedExhibit(null);
    setActiveHotspot(null);
  }, []);

  const handleViewExhibit3D = useCallback((exhibit) => {
    setViewerExhibit(exhibit);
    setShowExhibitViewer(true);
    setSelectedExhibit(null);
    setActiveHotspot(null);
  }, []);

  const handleNavigate = useCallback((targetPosition) => {
    if (isNavigating) return;
    
    const startTime = performance.now();
    const path = findPath(
      navmesh, 
      position, 
      targetPosition,
      bvhReady ? collisionManager : null
    );
    
    const endTime = performance.now();
    console.log(`Pathfinding took ${(endTime - startTime).toFixed(2)}ms, ${path.length} waypoints`);
    
    if (path.length > 0) {
      setTargetPath(path);
      document.exitPointerLock?.();
    } else {
      console.warn('No valid path found to target');
    }
  }, [isNavigating, navmesh, position, bvhReady]);

  useEffect(() => {
    const updateFPS = () => {
      fpsCounter.current++;
      const now = performance.now();
      
      if (now - lastFpsTime.current >= 1000) {
        setFps(fpsCounter.current);
        fpsCounter.current = 0;
        lastFpsTime.current = now;
      }
      
      requestAnimationFrame(updateFPS);
    };
    
    const rafId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        加载中...
      </div>
    );
  }

  if (showARMode) {
    return (
      <ARMode
        exhibits={exhibits}
        onClose={() => setShowARMode(false)}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Scene
        position={position}
        setPosition={setPosition}
        rotation={rotation}
        setRotation={setRotation}
        hotspots={hotspots}
        onHotspotClick={handleHotspotClick}
        activeHotspot={activeHotspot}
        isNavigating={isNavigating}
        setIsNavigating={setIsNavigating}
        targetPath={targetPath}
        setTargetPath={setTargetPath}
        navmesh={navmesh}
        bounds={config?.bounds || { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }}
        onBVHReady={handleBVHReady}
        multiplayerPlayers={players}
        localPlayerId={localPlayerId}
      />

      <MiniMap
        playerPosition={position}
        playerRotation={rotation}
        hotspots={hotspots}
        onNavigate={handleNavigate}
        bounds={config?.bounds || { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }}
        currentPath={targetPath}
      />

      <div className="controls-hint">
        <h4>操作说明</h4>
        <p>点击画面锁定鼠标</p>
        <p>WASD - 移动</p>
        <p>Shift - 加速</p>
        <p>鼠标 - 环顾四周</p>
        <p>ESC - 解锁鼠标</p>
        <p>点击小地图 - 自动导航</p>
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.3)' }}>
          <p style={{ color: fps < 30 ? '#ff6b6b' : '#00ff88' }}>
            FPS: {fps}
          </p>
          <p style={{ color: bvhReady ? '#00ff88' : '#ffaa00' }}>
            BVH: {bvhReady ? '已启用' : '初始化中'}
          </p>
          {multiplayerEnabled && (
            <p style={{ color: '#4ecdc4' }}>
              在线: {players.length + 1} 人
            </p>
          )}
        </div>
      </div>

      <div style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 100
      }}>
        <button
          onClick={() => setShowVoiceChat(true)}
          style={{
            padding: '10px 16px',
            background: multiplayerEnabled ? '#4CAF50' : '#2196F3',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🎤 语音聊天
        </button>

        <button
          onClick={() => setMultiplayerEnabled(!multiplayerEnabled)}
          style={{
            padding: '10px 16px',
            background: multiplayerEnabled ? '#f44336' : '#9C27B0',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {multiplayerEnabled ? '❌ 断开多人' : '👥 多人模式'}
        </button>

        <button
          onClick={() => setShowARMode(true)}
          style={{
            padding: '10px 16px',
            background: '#FF9800',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🕶️ AR 模式
        </button>
      </div>

      <InfoPanel
        exhibit={selectedExhibit}
        onClose={handleCloseInfoPanel}
        onView3D={() => handleViewExhibit3D(selectedExhibit)}
      />

      {showVoiceChat && (
        <VoiceChatPanel onClose={() => setShowVoiceChat(false)} />
      )}

      {showExhibitViewer && viewerExhibit && (
        <ExhibitViewer3D
          exhibit={viewerExhibit}
          onClose={() => {
            setShowExhibitViewer(false);
            setViewerExhibit(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
