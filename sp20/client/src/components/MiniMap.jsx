const MiniMap = ({ 
  playerPosition, 
  playerRotation,
  hotspots,
  onNavigate,
  bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  currentPath
}) => {
  const mapSize = 200;
  const worldSize = bounds.maxX - bounds.minX;
  const scale = mapSize / worldSize;

  const worldToMap = (x, z) => {
    return {
      x: (x - bounds.minX) * scale,
      y: (z - bounds.minZ) * scale
    };
  };

  const mapToWorld = (mapX, mapY) => {
    return {
      x: mapX / scale + bounds.minX,
      z: mapY / scale + bounds.minZ
    };
  };

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mapX = e.clientX - rect.left;
    const mapY = e.clientY - rect.top;
    const worldPos = mapToWorld(mapX, mapY);
    onNavigate(worldPos);
  };

  const playerMapPos = worldToMap(playerPosition.x, playerPosition.z);

  return (
    <div className="minimap" onClick={handleClick}>
      {currentPath && currentPath.map((point, i) => {
        const pos = worldToMap(point.x, point.z);
        return (
          <div
          key={i}
          className="path-indicator"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
          }}
        />
        );
      })}

      {hotspots.map((hotspot) => {
        const pos = worldToMap(hotspot.position.x, hotspot.position.z);
        return (
          <div
            key={hotspot.id}
            className="minimap-hotspot"
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(hotspot.position);
            }}
          >
            <span className="minimap-label">{hotspot.label}</span>
          </div>
        );
      })}

      <div
        className="minimap-player"
        style={{
          left: `${playerMapPos.x}px`,
          top: `${playerMapPos.y}px`,
          transform: `translate(-50%, -50%) rotate(${-playerRotation.y}rad)`,
        }}
      />
    </div>
  );
};

export default MiniMap;
