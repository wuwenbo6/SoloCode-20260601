import { useState } from 'react';
import { FluidCanvas } from '../components/FluidCanvas';
import { ControlPanel } from '../components/ControlPanel';
import { PerformancePanel } from '../components/PerformancePanel';

export default function Home() {
  const [resetKey, setResetKey] = useState(0);

  const handleReset = () => {
    setResetKey(prev => prev + 1);
  };

  const handleClearObstacles = () => {
    setResetKey(prev => prev + 1);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />
      </div>
      
      <FluidCanvas 
        key={resetKey}
      />
      
      <PerformancePanel />
      <ControlPanel 
        onReset={handleReset}
        onClearObstacles={handleClearObstacles}
      />
    </div>
  );
}
