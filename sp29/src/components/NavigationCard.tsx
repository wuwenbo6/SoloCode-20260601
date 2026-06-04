import { Navigation, X, MapPin } from 'lucide-react';
import usePositionStore from '@/store/usePositionStore';

export default function NavigationCard() {
  const navigationTarget = usePositionStore((s) => s.navigationTarget);
  const navigationPath = usePositionStore((s) => s.navigationPath);
  const position = usePositionStore((s) => s.position);
  const clearNavigation = usePositionStore((s) => s.clearNavigation);

  if (!navigationTarget) return null;

  const distance = navigationPath ? navigationPath.distance : 0;
  const walkTime = distance > 0 ? (distance / 100 / 1.2).toFixed(1) : '0';
  const directDistance = position
    ? Math.sqrt(
        (position.x - navigationTarget.x) ** 2 + (position.y - navigationTarget.y) ** 2
      )
    : 0;

  return (
    <div className="absolute bottom-4 right-4 bg-[#0a1628]/90 backdrop-blur-md border border-[#00D4FF]/30 rounded-xl p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#00D4FF]" />
          <span className="text-sm font-bold text-[#00D4FF]">导航</span>
        </div>
        <button
          onClick={clearNavigation}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <MapPin className="w-3 h-3 text-[#FF6B35]" />
          <span className="text-xs text-gray-400">目标</span>
        </div>
        <div className="text-sm text-white font-medium">{navigationTarget.name}</div>
        <div className="text-xs text-gray-500 font-mono">
          ({navigationTarget.x.toFixed(1)}, {navigationTarget.y.toFixed(1)})
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#0d1f3c] rounded-md p-2 border border-[#1e3a5f]">
          <div className="text-[10px] text-gray-500">路径距离</div>
          <div className="text-sm font-mono text-[#00D4FF]">
            {distance > 0 ? `${(distance / 100).toFixed(1)}m` : '--'}
          </div>
        </div>
        <div className="bg-[#0d1f3c] rounded-md p-2 border border-[#1e3a5f]">
          <div className="text-[10px] text-gray-500">直线距离</div>
          <div className="text-sm font-mono text-[#00D4FF]">
            {directDistance > 0 ? `${(directDistance / 100).toFixed(1)}m` : '--'}
          </div>
        </div>
        <div className="bg-[#0d1f3c] rounded-md p-2 border border-[#1e3a5f] col-span-2">
          <div className="text-[10px] text-gray-500">预计步行时间</div>
          <div className="text-sm font-mono text-[#00D4FF]">{walkTime}s</div>
        </div>
      </div>
    </div>
  );
}
