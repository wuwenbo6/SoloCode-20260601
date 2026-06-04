import { useRef, useCallback, useEffect, useState } from 'react';
import usePositionStore from '@/store/usePositionStore';

const roomsByFloor: Record<number, Array<{ x: number; y: number; w: number; h: number; label: string }>> = {
  1: [
    { x: 50, y: 50, w: 200, h: 150, label: '入口大厅' },
    { x: 250, y: 50, w: 300, h: 150, label: '中庭' },
    { x: 50, y: 200, w: 180, h: 180, label: '展厅A' },
    { x: 230, y: 200, w: 180, h: 180, label: '展厅B' },
    { x: 230, y: 380, w: 180, h: 100, label: '展厅C' },
    { x: 410, y: 200, w: 140, h: 280, label: '休息区' },
  ],
  2: [
    { x: 50, y: 80, w: 120, h: 120, label: '电梯厅' },
    { x: 170, y: 50, w: 380, h: 180, label: '主展览区' },
    { x: 170, y: 230, w: 200, h: 220, label: '贵宾休息' },
    { x: 370, y: 230, w: 180, h: 220, label: '会议室' },
  ],
};

function rssiToColor(rssi: number): string {
  const normalized = Math.max(0, Math.min(1, (rssi + 90) / 60));
  if (normalized > 0.75) return 'rgba(34, 197, 94, 0.6)';
  if (normalized > 0.5) return 'rgba(132, 204, 22, 0.55)';
  if (normalized > 0.25) return 'rgba(234, 179, 8, 0.5)';
  return 'rgba(239, 68, 68, 0.45)';
}

export default function IndoorMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const currentFloor = usePositionStore((s) => s.currentFloor);
  const floors = usePositionStore((s) => s.floors);
  const setCurrentFloor = usePositionStore((s) => s.setCurrentFloor);
  const beacons = usePositionStore((s) => s.beacons);
  const position = usePositionStore((s) => s.position);
  const positionHistory = usePositionStore((s) => s.positionHistory);
  const pathNodes = usePositionStore((s) => s.pathNodes);
  const pathEdges = usePositionStore((s) => s.pathEdges);
  const obstacles = usePositionStore((s) => s.obstacles);
  const navigationPath = usePositionStore((s) => s.navigationPath);
  const highlightedEdgeIds = usePositionStore((s) => s.highlightedEdgeIds);
  const setNavigationTarget = usePositionStore((s) => s.setNavigationTarget);
  const calculatePath = usePositionStore((s) => s.calculatePath);
  const remoteUsers = usePositionStore((s) => s.remoteUsers);
  const localUserColor = usePositionStore((s) => s.localUserColor);
  const showHeatmap = usePositionStore((s) => s.showHeatmap);
  const heatmapData = usePositionStore((s) => s.heatmapData);

  const [hoveredUser, setHoveredUser] = useState<string | null>(null);

  const rooms = roomsByFloor[currentFloor] || [];

  const handleMapClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = 600 / rect.width;
      const scaleY = 500 / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const clickOnObstacle = obstacles.some(
        (obs) => x >= obs.x && x <= obs.x + obs.width && y >= obs.y && y <= obs.y + obs.height
      );
      if (clickOnObstacle) return;

      setNavigationTarget({ x, y, name: `目标 (${x.toFixed(0)}, ${y.toFixed(0)})` });
      if (position) {
        calculatePath(position.x, position.y);
      } else {
        calculatePath(x, y);
      }
    },
    [position, setNavigationTarget, calculatePath, obstacles]
  );

  const nodeMap = new Map(pathNodes.map((n) => [n.id, n]));

  return (
    <div className="relative w-full h-full bg-[#0a1628] rounded-xl overflow-hidden border border-[#1e3a5f]">
      <div className="absolute top-3 left-3 z-10 flex gap-1.5">
        {floors.map((floor) => (
          <button
            key={floor.id}
            onClick={() => setCurrentFloor(floor.floor_number)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentFloor === floor.floor_number
                ? 'bg-[#00D4FF] text-[#0a1628]'
                : 'bg-[#0d1f3c] text-gray-400 border border-[#1e3a5f] hover:border-[#00D4FF]/50'
            }`}
          >
            {floor.floor_number}F
          </button>
        ))}
      </div>

      <div className="absolute top-3 right-3 z-10 text-xs text-gray-500 bg-[#0d1f3c]/80 px-2 py-1 rounded">
        {floors.find((f) => f.floor_number === currentFloor)?.name || '室内地图'}
      </div>

      {remoteUsers.length > 0 && (
        <div className="absolute bottom-3 left-3 z-10 bg-[#0d1f3c]/90 border border-[#1e3a5f] rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-1">在线用户</div>
          <div className="flex flex-col gap-1">
            {remoteUsers.map((u) => (
              <div
                key={u.userId}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: u.color }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: u.color }}
                />
                <span className="text-gray-300">{u.name}</span>
                <span className="text-gray-600">{u.floor}F</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox="0 0 600 500"
        className="w-full h-full"
        onClick={handleMapClick}
      >
        <style>{`
          @keyframes pulse {
            0% { r: 8; opacity: 0.8; }
            100% { r: 20; opacity: 0; }
          }
          @keyframes dash {
            to { stroke-dashoffset: -24; }
          }
          @keyframes beaconPulse {
            0% { r: 6; opacity: 0.6; }
            100% { r: 18; opacity: 0; }
          }
          @keyframes userPulse {
            0% { r: 7; opacity: 0.6; }
            100% { r: 16; opacity: 0; }
          }
        `}</style>

        <rect width="600" height="500" fill="#0a1628" />

        {showHeatmap && heatmapData.map((p, i) => (
          <rect
            key={`heat-${i}`}
            x={p.x - 10}
            y={p.y - 10}
            width={20}
            height={20}
            fill={rssiToColor(p.rssi)}
            rx="2"
          />
        ))}

        {rooms.map((room) => (
          <g key={room.label}>
            <rect
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              fill="none"
              stroke="#1e3a5f"
              strokeWidth="1.5"
              rx="2"
            />
            <text
              x={room.x + room.w / 2}
              y={room.y + room.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#1e3a5f"
              fontSize="14"
              fontFamily="'Noto Sans SC', sans-serif"
            >
              {room.label}
            </text>
          </g>
        ))}

        {obstacles.map((obs) => (
          <g key={`obs-${obs.id}`}>
            <rect
              x={obs.x}
              y={obs.y}
              width={obs.width}
              height={obs.height}
              fill="#FF6B35"
              opacity="0.15"
              rx="2"
            />
            <rect
              x={obs.x}
              y={obs.y}
              width={obs.width}
              height={obs.height}
              fill="none"
              stroke="#FF6B35"
              strokeWidth="1"
              strokeDasharray="4 2"
              opacity="0.5"
              rx="2"
            />
            <line
              x1={obs.x}
              y1={obs.y}
              x2={obs.x + obs.width}
              y2={obs.y + obs.height}
              stroke="#FF6B35"
              strokeWidth="0.5"
              opacity="0.3"
            />
            <line
              x1={obs.x + obs.width}
              y1={obs.y}
              x2={obs.x}
              y2={obs.y + obs.height}
              stroke="#FF6B35"
              strokeWidth="0.5"
              opacity="0.3"
            />
          </g>
        ))}

        {pathEdges.map((edge) => {
          const from = nodeMap.get(edge.from_node_id);
          const to = nodeMap.get(edge.to_node_id);
          if (!from || !to) return null;
          const isHighlighted = highlightedEdgeIds.includes(edge.id);
          const isBlocked = edge.blocked;
          return (
            <line
              key={`edge-${edge.id}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isBlocked ? '#FF6B35' : isHighlighted ? '#00D4FF' : '#1e3a5f'}
              strokeWidth={isHighlighted ? 2.5 : isBlocked ? 1 : 1}
              strokeDasharray={isHighlighted ? '8 4' : isBlocked ? '2 4' : 'none'}
              opacity={isBlocked ? 0.4 : 1}
              style={isHighlighted ? { animation: 'dash 1s linear infinite' } : undefined}
            />
          );
        })}

        {pathNodes.map((node) => (
          <g key={`node-${node.id}`}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.blocked ? 4 : 3}
              fill={node.blocked ? '#FF6B35' : '#1e3a5f'}
              opacity={node.blocked ? 0.5 : 1}
            />
            {node.blocked && (
              <line
                x1={node.x - 4}
                y1={node.y - 4}
                x2={node.x + 4}
                y2={node.y + 4}
                stroke="#FF6B35"
                strokeWidth="1.5"
                opacity="0.6"
              />
            )}
          </g>
        ))}

        {navigationPath && navigationPath.path.length > 1 && (
          <polyline
            points={navigationPath.path.map((n) => `${n.x},${n.y}`).join(' ')}
            fill="none"
            stroke="#00D4FF"
            strokeWidth="2.5"
            strokeDasharray="8 4"
            style={{ animation: 'dash 1s linear infinite' }}
            strokeLinejoin="round"
          />
        )}

        {beacons.map((beacon) => {
          const isActive = beacon.rssi !== null;
          return (
            <g key={`beacon-${beacon.uuid}`}>
              {isActive && (
                <>
                  <circle
                    cx={beacon.x}
                    cy={beacon.y}
                    fill="none"
                    stroke="#FF6B35"
                    strokeWidth="1"
                    opacity="0.6"
                    style={{ animation: 'beaconPulse 2s ease-out infinite' }}
                  />
                  <circle
                    cx={beacon.x}
                    cy={beacon.y}
                    fill="none"
                    stroke="#FF6B35"
                    strokeWidth="1"
                    opacity="0.4"
                    style={{ animation: 'beaconPulse 2s ease-out infinite 0.5s' }}
                  />
                </>
              )}
              <polygon
                points={`${beacon.x - 8},${beacon.y} ${beacon.x},${beacon.y - 8} ${beacon.x + 8},${beacon.y} ${beacon.x},${beacon.y + 8}`}
                fill="#FF6B35"
                opacity={isActive ? 1 : 0.4}
              />
              <text
                x={beacon.x}
                y={beacon.y - 14}
                textAnchor="middle"
                fill="#FF6B35"
                fontSize="10"
                fontFamily="'Noto Sans SC', sans-serif"
              >
                {beacon.name}
              </text>
            </g>
          );
        })}

        {positionHistory.map((pt, i) => {
          const opacity = ((i + 1) / positionHistory.length) * 0.5;
          return (
            <circle
              key={`hist-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={2}
              fill={localUserColor || '#00D4FF'}
              opacity={opacity}
            />
          );
        })}

        {remoteUsers.map((user) => {
          if (user.floor !== currentFloor) return null;
          const isHovered = hoveredUser === user.userId;
          return (
            <g
              key={`remote-${user.userId}`}
              onMouseEnter={() => setHoveredUser(user.userId)}
              onMouseLeave={() => setHoveredUser(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={user.x}
                cy={user.y}
                fill={user.color}
                opacity="0.5"
                style={{ animation: 'userPulse 2s ease-out infinite' }}
              />
              <circle
                cx={user.x}
                cy={user.y}
                r={7}
                fill={user.color}
              />
              {isHovered && (
                <>
                  <rect
                    x={user.x - 35}
                    y={user.y - 28}
                    width={70}
                    height={18}
                    rx="4"
                    fill="#0d1f3c"
                    stroke={user.color}
                    strokeWidth="1"
                    opacity="0.95"
                  />
                  <text
                    x={user.x}
                    y={user.y - 16}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="11"
                    fontFamily="'Noto Sans SC', sans-serif"
                  >
                    {user.name}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {position && (
          <g>
            <circle
              cx={position.x}
              cy={position.y}
              fill={localUserColor || '#00D4FF'}
              opacity="0.8"
              style={{ animation: 'pulse 1.5s ease-out infinite' }}
            />
            <circle
              cx={position.x}
              cy={position.y}
              r={8}
              fill={localUserColor || '#00D4FF'}
              stroke="#fff"
              strokeWidth="1.5"
            />
            <circle
              cx={position.x}
              cy={position.y}
              r={position.accuracy}
              fill="none"
              stroke={localUserColor || '#00D4FF'}
              strokeWidth="0.5"
              opacity="0.3"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
