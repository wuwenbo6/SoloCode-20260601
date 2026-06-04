import { useRobotStore } from '@/store/robotStore'

function Gauge({ value, min, max, label, unit }: { value: number; min: number; max: number; label: string; unit: string }) {
  const percentage = ((value - min) / (max - min)) * 100
  const clampedPct = Math.max(0, Math.min(100, percentage))
  const angle = (clampedPct / 100) * 180 - 90
  const radians = (angle * Math.PI) / 180
  const needleLen = 35
  const cx = 50
  const cy = 50
  const tipX = cx + needleLen * Math.cos(radians)
  const tipY = cy + needleLen * Math.sin(radians)

  const displayValue = value.toFixed(2)

  return (
    <div className="flex flex-col items-center">
      <svg width="110" height="70" viewBox="0 0 110 70">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff3366" />
            <stop offset="50%" stopColor="#00ff88" />
            <stop offset="100%" stopColor="#ff3366" />
          </linearGradient>
        </defs>
        <path
          d="M 15 55 A 40 40 0 0 1 95 55"
          fill="none"
          stroke={`url(#grad-${label})`}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill="#00ff88" />
        <text x={cx} y={68} textAnchor="middle" fill="#888" fontSize="10" fontFamily="JetBrains Mono, monospace">
          {displayValue} {unit}
        </text>
      </svg>
      <span className="text-[10px] font-mono text-[#888] mt-1 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function MiniChart({ values, color }: { values: number[]; color: string }) {
  const w = 100
  const h = 30
  const max = Math.max(...values, 0.01)
  const min = Math.min(...values, -0.01)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />
    </svg>
  )
}

function BatteryBar({ percentage, voltage, current }: { percentage: number; voltage: number; current: number }) {
  const clamped = Math.max(0, Math.min(100, percentage))
  const color = clamped > 30 ? '#00ff88' : clamped > 10 ? '#ffaa00' : '#ff3366'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-12 h-32 border-2 border-[#2a3040] rounded-lg bg-[#0a0e17]">
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-md transition-all duration-300"
          style={{ height: `${clamped}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-[#2a3040] rounded-t" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold font-mono text-white" style={{ textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="mt-3 text-center font-mono text-xs">
        <div className="text-[#888]">
          <span className="text-[#00ff88]">{voltage.toFixed(1)}</span> V
        </div>
        <div className="text-[#888]">
          <span className="text-[#ffaa00]">{current.toFixed(2)}</span> A
        </div>
      </div>
    </div>
  )
}

export function SensorPanel() {
  const sensorData = useRobotStore((s) => s.sensorData)

  if (!sensorData) {
    return (
      <div className="bg-[#1a1f2e] rounded-lg p-4 border border-[#2a3040]">
        <h3 className="text-sm font-semibold text-[#00ff88] mb-4 font-display tracking-wider">SENSORS</h3>
        <div className="h-48 flex items-center justify-center text-[#555] text-xs font-mono">
          NO DATA
        </div>
      </div>
    )
  }

  const { imu, battery } = sensorData

  const accelVals = [imu.accel.x, imu.accel.y, imu.accel.z]
  const gyroVals = [imu.gyro.x, imu.gyro.y, imu.gyro.z]

  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-[#2a3040]">
      <h3 className="text-sm font-semibold text-[#00ff88] mb-4 font-display tracking-wider">SENSORS</h3>

      <div className="mb-4">
        <div className="text-[10px] text-[#888] mb-2 font-mono uppercase tracking-wider">IMU Orientation</div>
        <div className="flex justify-around">
          <Gauge value={(imu.orientation.roll * 180) / Math.PI} min={-180} max={180} label="Roll" unit="°" />
          <Gauge value={(imu.orientation.pitch * 180) / Math.PI} min={-90} max={90} label="Pitch" unit="°" />
          <Gauge value={(imu.orientation.yaw * 180) / Math.PI} min={-180} max={180} label="Yaw" unit="°" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#0a0e17] rounded p-2 border border-[#2a3040]">
          <div className="text-[10px] text-[#888] mb-1 font-mono uppercase tracking-wider">Accel (m/s²)</div>
          <MiniChart values={accelVals} color="#00ff88" />
          <div className="flex justify-between text-[10px] font-mono mt-1">
            <span className="text-[#00ff88]">X:{imu.accel.x.toFixed(2)}</span>
            <span className="text-[#ffaa00]">Y:{imu.accel.y.toFixed(2)}</span>
            <span className="text-[#ff3366]">Z:{imu.accel.z.toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-[#0a0e17] rounded p-2 border border-[#2a3040]">
          <div className="text-[10px] text-[#888] mb-1 font-mono uppercase tracking-wider">Gyro (rad/s)</div>
          <MiniChart values={gyroVals} color="#ff3366" />
          <div className="flex justify-between text-[10px] font-mono mt-1">
            <span className="text-[#00ff88]">X:{imu.gyro.x.toFixed(2)}</span>
            <span className="text-[#ffaa00]">Y:{imu.gyro.y.toFixed(2)}</span>
            <span className="text-[#ff3366]">Z:{imu.gyro.z.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[10px] text-[#888] mb-2 font-mono uppercase tracking-wider">Battery</div>
        <BatteryBar percentage={battery.percentage} voltage={battery.voltage} current={battery.current} />
      </div>
    </div>
  )
}
