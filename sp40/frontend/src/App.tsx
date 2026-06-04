import { useState } from 'react'
import { Robot3D } from '@/components/Robot3D'
import { VideoPlayer } from '@/components/VideoPlayer'
import { SensorPanel } from '@/components/SensorPanel'
import { ControlPanel } from '@/components/ControlPanel'
import { ForceFeedback } from '@/components/ForceFeedback'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { RobotSelector } from '@/components/RobotSelector'
import { MapView2D } from '@/components/MapView2D'
import { RecordingPanel } from '@/components/RecordingPanel'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useEffect } from 'react'
import { ChevronDown, ChevronUp, Gamepad2, Gauge, Zap, Video } from 'lucide-react'
import clsx from 'clsx'

type RightPanelTab = 'control' | 'sensors' | 'force' | 'recording'

const TAB_CONFIG: { id: RightPanelTab; label: string; icon: typeof Gamepad2 }[] = [
  { id: 'control', label: 'CONTROL', icon: Gamepad2 },
  { id: 'sensors', label: 'SENSORS', icon: Gauge },
  { id: 'force', label: 'FORCE', icon: Zap },
  { id: 'recording', label: 'RECORD', icon: Video },
]

export default function App() {
  const { connect } = useWebSocket()
  const [activeTab, setActiveTab] = useState<RightPanelTab>('control')
  const [showMap, setShowMap] = useState(true)

  useEffect(() => {
    connect()
  }, [connect])

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0e17] overflow-hidden">
      <header className="bg-[#1a1f2e] border-b border-[#2a3040] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff88] to-[#00aaff] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0e17" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold font-display tracking-wider text-[#00ff88]">ROBOT TELEOP</h1>
            <p className="text-[10px] text-[#888] font-mono">WebTransport Control Console v1.0</p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-[#888]">
          {new Date().toLocaleString('en-US', { hour12: false })}
        </div>
      </header>

      <RobotSelector />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <div className="lg:w-[60%] flex flex-col border-r border-[#2a3040] min-h-0">
          <div className="flex-[1.5] min-h-0 border-b border-[#2a3040]">
            <Robot3D />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <button
              onClick={() => setShowMap(!showMap)}
              className="flex items-center justify-between px-4 py-2 bg-[#1a1f2e] border-b border-[#2a3040] text-xs font-mono text-[#00ff88] hover:bg-[#1f2535] transition-colors shrink-0"
            >
              <span className="flex items-center gap-2">
                {showMap ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                2D NAVIGATION MAP
              </span>
              <span className="text-[#555]">{showMap ? 'CLICK TO COLLAPSE' : 'CLICK TO EXPAND'}</span>
            </button>
            {showMap && (
              <div className="flex-1 min-h-0 p-3">
                <MapView2D />
              </div>
            )}
            {!showMap && (
              <div className="flex-1 min-h-0 p-3">
                <VideoPlayer />
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-[40%] flex flex-col overflow-hidden min-h-0">
          <div className="flex border-b border-[#2a3040] shrink-0">
            {TAB_CONFIG.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-[10px] font-mono font-bold tracking-wider transition-all duration-200 border-b-2',
                    isActive
                      ? 'text-[#00ff88] border-[#00ff88] bg-[#00ff88]/5'
                      : 'text-[#555] border-transparent hover:text-[#888] hover:bg-[#1a1f2e]/50'
                  )}
                >
                  <TabIcon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'control' && <ControlPanel />}
            {activeTab === 'sensors' && <SensorPanel />}
            {activeTab === 'force' && <ForceFeedback />}
            {activeTab === 'recording' && <RecordingPanel />}
          </div>
        </div>
      </main>

      <ConnectionStatus />
    </div>
  )
}
