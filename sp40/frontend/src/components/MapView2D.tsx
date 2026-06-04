import { useState, useRef, useCallback, useEffect } from 'react'
import { useRobotStore } from '@/store/robotStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  Map,
  Target,
  Play,
  Pause,
  Trash2,
  ZoomIn,
  ZoomOut,
  Move,
  Maximize2,
} from 'lucide-react'
import clsx from 'clsx'

const WORLD_MIN = -10
const WORLD_MAX = 10
const WORLD_SIZE = WORLD_MAX - WORLD_MIN

const ROBOT_COLORS: Record<string, string> = {
  'robot-0': '#00ff88',
  'robot-1': '#00aaff',
  'robot-2': '#ffaa00',
}

const OBSTACLE_COLORS: Record<string, string> = {
  static: '#ff3366',
  dynamic: '#ffaa00',
}

export function MapView2D() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [viewBox, setViewBox] = useState({
    x: WORLD_MIN,
    y: -WORLD_MAX,
    width: WORLD_SIZE,
    height: WORLD_SIZE,
  })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [viewBoxStart, setViewBoxStart] = useState(viewBox)

  const robots = useRobotStore((s) => s.robots)
  const obstacles = useRobotStore((s) => s.obstacles)
  const waypoints = useRobotStore((s) => s.waypoints)
  const targetPoint = useRobotStore((s) => s.targetPoint)
  const autoMode = useRobotStore((s) => s.autoMode)
  const selectedRobotId = useRobotStore((s) => s.selectedRobotId)
  const setTargetPoint = useRobotStore((s) => s.setTargetPoint)
  const setAutoMode = useRobotStore((s) => s.setAutoMode)
  const clearPath = useRobotStore((s) => s.clearPath)
  const setWaypoints = useRobotStore((s) => s.setWaypoints)

  const { requestPath, sendWaypoints } = useWebSocket()

  const svgToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 }
      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const x =
        viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width
      const y =
        viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height
      return { x, y: -y }
    },
    [viewBox]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (isPanning) return
      const pos = svgToWorld(e.clientX, e.clientY)
      const clampedX = Math.max(WORLD_MIN, Math.min(WORLD_MAX, pos.x))
      const clampedY = Math.max(WORLD_MIN, Math.min(WORLD_MAX, pos.y))
      const target = { x: clampedX, y: clampedY }
      setTargetPoint(target)
      requestPath(target)
    },
    [isPanning, svgToWorld, setTargetPoint, requestPath]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (e.button === 1 || e.shiftKey) {
        e.preventDefault()
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY })
        setViewBoxStart(viewBox)
      }
    },
    [viewBox]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isPanning) return
      if (!svgRef.current) return
      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const dx = ((e.clientX - panStart.x) / rect.width) * viewBox.width
      const dy = ((e.clientY - panStart.y) / rect.height) * viewBox.height
      setViewBox({
        ...viewBoxStart,
        x: viewBoxStart.x - dx,
        y: viewBoxStart.y - dy,
      })
    },
    [isPanning, panStart, viewBoxStart, viewBox.width, viewBox.height]
  )

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
      const newWidth = viewBox.width * zoomFactor
      const newHeight = viewBox.height * zoomFactor
      const clampedWidth = Math.max(2, Math.min(WORLD_SIZE * 2, newWidth))
      const clampedHeight = Math.max(2, Math.min(WORLD_SIZE * 2, newHeight))

      const pos = svgToWorld(e.clientX, e.clientY)
      const scaleX = clampedWidth / viewBox.width
      const scaleY = clampedHeight / viewBox.height

      setViewBox({
        x: pos.x - (pos.x - viewBox.x) * scaleX,
        y: -pos.y - (-pos.y - viewBox.y) * scaleY,
        width: clampedWidth,
        height: clampedHeight,
      })
    },
    [viewBox, svgToWorld]
  )

  const handleZoomIn = () => {
    const cx = viewBox.x + viewBox.width / 2
    const cy = viewBox.y + viewBox.height / 2
    const newWidth = viewBox.width * 0.7
    const newHeight = viewBox.height * 0.7
    setViewBox({
      x: cx - newWidth / 2,
      y: cy - newHeight / 2,
      width: newWidth,
      height: newHeight,
    })
  }

  const handleZoomOut = () => {
    const cx = viewBox.x + viewBox.width / 2
    const cy = viewBox.y + viewBox.height / 2
    const newWidth = viewBox.width * 1.3
    const newHeight = viewBox.height * 1.3
    setViewBox({
      x: cx - newWidth / 2,
      y: cy - newHeight / 2,
      width: newWidth,
      height: newHeight,
    })
  }

  const handleResetView = () => {
    setViewBox({
      x: WORLD_MIN,
      y: -WORLD_MAX,
      width: WORLD_SIZE,
      height: WORLD_SIZE,
    })
  }

  const handleToggleAutoMode = () => {
    const newAutoMode = !autoMode
    setAutoMode(newAutoMode)
    if (waypoints.length > 0) {
      sendWaypoints(waypoints, newAutoMode)
    }
  }

  const handleClearPath = () => {
    clearPath()
  }

  const handleExecutePath = () => {
    if (waypoints.length > 0) {
      sendWaypoints(waypoints, true)
      setAutoMode(true)
    }
  }

  useEffect(() => {
    if (waypoints.length > 0 && autoMode) {
      sendWaypoints(waypoints, true)
    }
  }, [])

  const gridLines = []
  for (let i = WORLD_MIN; i <= WORLD_MAX; i += 2) {
    gridLines.push(
      <line
        key={`v-${i}`}
        x1={i}
        y1={-WORLD_MAX}
        x2={i}
        y2={-WORLD_MIN}
        stroke="#2a3040"
        strokeWidth="0.02"
      />
    )
    gridLines.push(
      <line
        key={`h-${i}`}
        x1={WORLD_MIN}
        y1={-i}
        x2={WORLD_MAX}
        y2={-i}
        stroke="#2a3040"
        strokeWidth="0.02"
      />
    )
  }

  const gridLabels = []
  for (let i = WORLD_MIN; i <= WORLD_MAX; i += 2) {
    gridLabels.push(
      <text
        key={`lx-${i}`}
        x={i}
        y={-WORLD_MIN + 0.3}
        fill="#444"
        fontSize="0.4"
        textAnchor="middle"
        fontFamily="monospace"
      >
        {i}
      </text>
    )
    gridLabels.push(
      <text
        key={`ly-${i}`}
        x={WORLD_MIN - 0.3}
        y={-i + 0.15}
        fill="#444"
        fontSize="0.4"
        textAnchor="end"
        fontFamily="monospace"
      >
        {i}
      </text>
    )
  }

  const pathD = waypoints.length > 0
    ? `M ${waypoints.map((p) => `${p.x},${-p.y}`).join(' L ')}`
    : ''

  return (
    <div className="relative w-full h-full bg-[#0a0e17] rounded-lg border border-[#2a3040] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1f2e] border-b border-[#2a3040]">
        <div className="flex items-center gap-2">
          <Map size={16} className="text-[#00ff88]" />
          <span className="text-sm font-display tracking-wider text-[#00ff88]">
            2D NAVIGATION MAP
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-[#0a0e17] border border-[#2a3040] text-[#888] hover:text-[#00ff88] hover:border-[#00ff88] transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-[#0a0e17] border border-[#2a3040] text-[#888] hover:text-[#00ff88] hover:border-[#00ff88] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleResetView}
            className="p-1.5 rounded bg-[#0a0e17] border border-[#2a3040] text-[#888] hover:text-[#00ff88] hover:border-[#00ff88] transition-colors"
            title="Reset View"
          >
            <Maximize2 size={14} />
          </button>
          <div className="w-px h-5 bg-[#2a3040] mx-1" />
          <button
            onClick={handleExecutePath}
            disabled={waypoints.length === 0}
            className={clsx(
              'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono transition-colors',
              waypoints.length > 0
                ? 'bg-[#00ff88]/20 border border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88]/30'
                : 'bg-[#2a3040] border border-[#2a3040] text-[#555] cursor-not-allowed'
            )}
          >
            <Play size={12} />
            EXECUTE
          </button>
          <button
            onClick={handleToggleAutoMode}
            className={clsx(
              'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono transition-colors',
              autoMode
                ? 'bg-[#00aaff]/20 border border-[#00aaff] text-[#00aaff]'
                : 'bg-[#0a0e17] border border-[#2a3040] text-[#888] hover:text-[#00aaff] hover:border-[#00aaff]'
            )}
          >
            {autoMode ? <Pause size={12} /> : <Play size={12} />}
            AUTO: {autoMode ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={handleClearPath}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono bg-[#0a0e17] border border-[#2a3040] text-[#ff3366] hover:bg-[#ff3366]/20 hover:border-[#ff3366] transition-colors"
          >
            <Trash2 size={12} />
            CLEAR
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-crosshair"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
        >
          <defs>
            <pattern id="grid" width="2" height="2" patternUnits="userSpaceOnUse">
              <path d="M 2 0 L 0 0 0 2" fill="none" stroke="#1a1f2e" strokeWidth="0.05" />
            </pattern>
          </defs>

          <rect
            x={WORLD_MIN}
            y={-WORLD_MAX}
            width={WORLD_SIZE}
            height={WORLD_SIZE}
            fill="url(#grid)"
          />

          {gridLines}
          {gridLabels}

          <rect
            x={WORLD_MIN}
            y={-WORLD_MAX}
            width={WORLD_SIZE}
            height={WORLD_SIZE}
            fill="none"
            stroke="#2a3040"
            strokeWidth="0.05"
          />

          {obstacles.map((obs) => (
            <g key={obs.id}>
              <circle
                cx={obs.x}
                cy={-obs.y}
                r={obs.radius + 0.1}
                fill={OBSTACLE_COLORS[obs.type] || '#ff3366'}
                fillOpacity="0.2"
                stroke={OBSTACLE_COLORS[obs.type] || '#ff3366'}
                strokeWidth="0.05"
                strokeDasharray="0.2 0.1"
              />
              <circle
                cx={obs.x}
                cy={-obs.y}
                r={obs.radius}
                fill={OBSTACLE_COLORS[obs.type] || '#ff3366'}
                fillOpacity="0.6"
                stroke={OBSTACLE_COLORS[obs.type] || '#ff3366'}
                strokeWidth="0.05"
              />
              <text
                x={obs.x}
                y={-obs.y + 0.15}
                fill="#fff"
                fontSize="0.4"
                textAnchor="middle"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {obs.id.slice(-1)}
              </text>
            </g>
          ))}

          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#00ff88"
              strokeWidth="0.08"
              strokeDasharray="0.3 0.15"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
          )}

          {waypoints.map((wp, idx) => (
            <g key={idx}>
              <circle
                cx={wp.x}
                cy={-wp.y}
                r="0.15"
                fill="#00ff88"
                fillOpacity="0.8"
                stroke="#00ff88"
                strokeWidth="0.03"
              />
              <text
                x={wp.x}
                y={-wp.y + 0.35}
                fill="#00ff88"
                fontSize="0.35"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {idx + 1}
              </text>
            </g>
          ))}

          {targetPoint && (
            <g>
              <circle
                cx={targetPoint.x}
                cy={-targetPoint.y}
                r="0.4"
                fill="none"
                stroke="#ff3366"
                strokeWidth="0.05"
                strokeDasharray="0.15 0.1"
                className="animate-pulse"
              />
              <circle
                cx={targetPoint.x}
                cy={-targetPoint.y}
                r="0.2"
                fill="#ff3366"
                fillOpacity="0.5"
                stroke="#ff3366"
                strokeWidth="0.05"
              />
              <Target
                x={targetPoint.x - 0.2}
                y={-targetPoint.y - 0.2}
                width="0.4"
                height="0.4"
                fill="#ff3366"
                stroke="none"
              />
            </g>
          )}

          {robots.map((robot) => {
            const color = ROBOT_COLORS[robot.id] || '#888'
            const heading = robot.heading || 0
            const isSelected = robot.id === selectedRobotId

            return (
              <g
                key={robot.id}
                transform={`translate(${robot.position.x}, ${-robot.position.y}) rotate(${-heading * 180 / Math.PI})`}
              >
                {isSelected && (
                  <circle
                    r="0.7"
                    fill="none"
                    stroke={color}
                    strokeWidth="0.05"
                    strokeDasharray="0.2 0.1"
                    opacity="0.6"
                  />
                )}
                <polygon
                  points="0.4,0 -0.3,0.25 -0.3,-0.25"
                  fill={color}
                  fillOpacity="0.8"
                  stroke={color}
                  strokeWidth="0.05"
                />
                <circle r="0.1" fill="#0a0e17" />
                <text
                  y="0.6"
                  fill={color}
                  fontSize="0.35"
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {robot.name}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] font-mono text-[#888] bg-[#0a0e17]/80 px-2 py-1 rounded border border-[#2a3040]">
          <Move size={12} />
          <span>SHIFT+DRAG to pan • Scroll to zoom • Click to set target</span>
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-1 text-[10px] font-mono bg-[#0a0e17]/80 p-2 rounded border border-[#2a3040]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00ff88]" />
            <span className="text-[#00ff88]">Robot 0</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00aaff]" />
            <span className="text-[#00aaff]">Robot 1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ffaa00]" />
            <span className="text-[#ffaa00]">Robot 2</span>
          </div>
          <div className="w-full h-px bg-[#2a3040] my-1" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff3366]" />
            <span className="text-[#ff3366]">Obstacle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#00ff88]" style={{ borderStyle: 'dotted' }} />
            <span className="text-[#00ff88]">Path</span>
          </div>
        </div>
      </div>
    </div>
  )
}
