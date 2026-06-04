import { useRobotStore } from '@/store/robotStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Bot, Wifi, WifiOff, AlertCircle, Clock, Video } from 'lucide-react'
import clsx from 'clsx'

const ROBOT_COLORS: Record<string, string> = {
  'robot-0': 'bg-[#00ff88]',
  'robot-1': 'bg-[#00aaff]',
  'robot-2': 'bg-[#ffaa00]',
}

const ROBOT_STROKE: Record<string, string> = {
  'robot-0': 'border-[#00ff88]',
  'robot-1': 'border-[#00aaff]',
  'robot-2': 'border-[#ffaa00]',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Bot }> = {
  idle: { label: 'IDLE', color: 'text-[#888]', icon: Wifi },
  moving: { label: 'MOVING', color: 'text-[#00aaff]', icon: Wifi },
  recording: { label: 'RECORDING', color: 'text-[#ff3366]', icon: Video },
  error: { label: 'ERROR', color: 'text-[#ff3366]', icon: AlertCircle },
}

export function RobotSelector() {
  const robots = useRobotStore((s) => s.robots)
  const selectedRobotId = useRobotStore((s) => s.selectedRobotId)
  const { selectRobot } = useWebSocket()

  const handleSelectRobot = (robotId: string) => {
    if (robotId !== selectedRobotId) {
      selectRobot(robotId)
    }
  }

  return (
    <div className="bg-[#1a1f2e] border-b border-[#2a3040] px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#00ff88]" />
          <span className="text-sm font-display tracking-wider text-[#00ff88]">ROBOT FLEET</span>
        </div>
        <div className="flex gap-3">
          {robots.map((robot) => {
            const isSelected = robot.id === selectedRobotId
            const statusConfig = STATUS_CONFIG[robot.status] || STATUS_CONFIG.idle
            const StatusIcon = statusConfig.icon
            const robotColor = ROBOT_COLORS[robot.id] || 'bg-[#888]'
            const robotStroke = ROBOT_STROKE[robot.id] || 'border-[#888]'

            return (
              <button
                key={robot.id}
                onClick={() => handleSelectRobot(robot.id)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2 rounded-lg border transition-all duration-200 min-w-[200px]',
                  isSelected
                    ? `bg-[#0a0e17] ${robotStroke} border-2`
                    : 'bg-[#0a0e17]/50 border-[#2a3040] hover:border-[#3a4050]'
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={clsx(
                      'w-3 h-3 rounded-full',
                      robotColor,
                      isSelected && 'animate-pulse'
                    )}
                  />
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{robot.name}</span>
                      <StatusIcon size={12} className={statusConfig.color} />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#888]">
                      <span>{statusConfig.label}</span>
                      <span>•</span>
                      <span>
                        X:{robot.position.x.toFixed(1)} Y:{robot.position.y.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="ml-auto">
                    <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-mono text-[#888]">
            <Clock size={12} />
            <span>{robots.length} ROBOTS ONLINE</span>
          </div>
          {selectedRobotId && (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-[#888]">ACTIVE:</span>
              <span className="text-[#00ff88] font-bold">{selectedRobotId.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
