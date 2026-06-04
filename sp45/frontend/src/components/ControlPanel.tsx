import { useState } from 'react';
import { Play, Pause, Square, Home, ArrowUp, ArrowDown, Thermometer } from 'lucide-react';
import { printerAPI } from '../services/api';
import { cn } from '../utils';

interface ControlPanelProps {
  disabled?: boolean;
  printerState?: string;
}

type MoveDistance = 0.1 | 1 | 10 | 50;

export function ControlPanel({ disabled, printerState }: ControlPanelProps) {
  const [moveDistance, setMoveDistance] = useState<MoveDistance>(10);
  const [nozzleTemp, setNozzleTemp] = useState('200');
  const [bedTemp, setBedTemp] = useState('60');
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setLoading(action);
    try {
      await fn();
    } catch (e) {
      console.error(`${action} failed:`, e);
    } finally {
      setLoading(null);
    }
  };

  const handleMove = async (axis: string, direction: number) => {
    await handleAction(`move-${axis}`, async () => {
      await printerAPI.moveAxis({
        axis,
        distance: moveDistance * direction,
        speed: axis === 'Z' ? 600 : 3000,
      });
    });
  };

  const handleHome = async (axis: string) => {
    await handleAction(`home-${axis}`, async () => {
      await printerAPI.homeAxis(axis);
    });
  };

  const handleSetTemp = async (heater: string) => {
    const temp = heater === 'nozzle' ? parseFloat(nozzleTemp) : parseFloat(bedTemp);
    await handleAction(`temp-${heater}`, async () => {
      await printerAPI.setTemperature(heater, temp);
    });
  };

  const handleStartPrint = async () => {
    await handleAction('start-print', async () => {
      await printerAPI.startPrintJob('demo_print.gcode', 1024000);
    });
  };

  const distances: MoveDistance[] = [0.1, 1, 10, 50];
  const isPrinting = printerState === 'printing';
  const isPaused = printerState === 'paused';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">打印机控制</h3>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">打印控制</h4>
        <div className="grid grid-cols-3 gap-2">
          {!isPrinting && !isPaused && (
            <button
              onClick={handleStartPrint}
              disabled={disabled || loading === 'start-print'}
              className={cn(
                'flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors',
                disabled || loading === 'start-print'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              <Play className="w-4 h-4" />
              开始
            </button>
          )}
          {isPrinting && (
            <button
              onClick={() => handleAction('pause', () => printerAPI.pausePrint())}
              disabled={disabled || loading === 'pause'}
              className={cn(
                'flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors',
                disabled || loading === 'pause'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              )}
            >
              <Pause className="w-4 h-4" />
              暂停
            </button>
          )}
          {isPaused && (
            <button
              onClick={() => handleAction('resume', () => printerAPI.resumePrint())}
              disabled={disabled || loading === 'resume'}
              className={cn(
                'flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors',
                disabled || loading === 'resume'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              <Play className="w-4 h-4" />
              继续
            </button>
          )}
          <button
            onClick={() => handleAction('stop', () => printerAPI.stopPrint())}
            disabled={disabled || (!isPrinting && !isPaused) || loading === 'stop'}
            className={cn(
              'flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors col-span-2',
              disabled || (!isPrinting && !isPaused) || loading === 'stop'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            )}
          >
            <Square className="w-4 h-4" />
            停止
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">移动距离</h4>
        <div className="flex gap-2">
          {distances.map((d) => (
            <button
              key={d}
              onClick={() => setMoveDistance(d)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
                moveDistance === d
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {d}mm
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">轴控制</h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <div className="text-xs text-center text-gray-500 mb-1">X轴</div>
            <div className="flex gap-1">
              <button
                onClick={() => handleMove('X', -1)}
                disabled={disabled || loading?.startsWith('move')}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded text-sm"
              >
                -
              </button>
              <button
                onClick={() => handleMove('X', 1)}
                disabled={disabled || loading?.startsWith('move')}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded text-sm"
              >
                +
              </button>
            </div>
          </div>
          <div className="col-span-1">
            <div className="text-xs text-center text-gray-500 mb-1">Y轴</div>
            <div className="flex gap-1">
              <button
                onClick={() => handleMove('Y', -1)}
                disabled={disabled || loading?.startsWith('move')}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded text-sm"
              >
                -
              </button>
              <button
                onClick={() => handleMove('Y', 1)}
                disabled={disabled || loading?.startsWith('move')}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded text-sm"
              >
                +
              </button>
            </div>
          </div>
          <div className="col-span-1">
            <div className="text-xs text-center text-gray-500 mb-1">Z轴</div>
            <div className="flex gap-1">
              <button
                onClick={() => handleMove('Z', -1)}
                disabled={disabled || loading?.startsWith('move')}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded text-sm"
              >
                <ArrowDown className="w-4 h-4 mx-auto" />
              </button>
              <button
                onClick={() => handleMove('Z', 1)}
                disabled={disabled || loading?.startsWith('move')}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded text-sm"
              >
                <ArrowUp className="w-4 h-4 mx-auto" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <button
            onClick={() => handleHome('X')}
            disabled={disabled || loading?.startsWith('home')}
            className="flex items-center justify-center gap-1 py-2 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 rounded text-sm text-blue-700"
          >
            <Home className="w-3 h-3" />
            X
          </button>
          <button
            onClick={() => handleHome('Y')}
            disabled={disabled || loading?.startsWith('home')}
            className="flex items-center justify-center gap-1 py-2 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 rounded text-sm text-blue-700"
          >
            <Home className="w-3 h-3" />
            Y
          </button>
          <button
            onClick={() => handleHome('Z')}
            disabled={disabled || loading?.startsWith('home')}
            className="flex items-center justify-center gap-1 py-2 bg-blue-100 hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-400 rounded text-sm text-blue-700"
          >
            <Home className="w-3 h-3" />
            Z
          </button>
          <button
            onClick={() => handleHome('ALL')}
            disabled={disabled || loading?.startsWith('home')}
            className="flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 rounded text-sm text-white"
          >
            <Home className="w-3 h-3" />
            全部
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">温度设置</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-600 w-16">喷嘴:</span>
            <input
              type="number"
              value={nozzleTemp}
              onChange={(e) => setNozzleTemp(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              min="0"
              max="300"
            />
            <span className="text-gray-500 text-sm">°C</span>
            <button
              onClick={() => handleSetTemp('nozzle')}
              disabled={disabled || loading === 'temp-nozzle'}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg text-sm transition-colors"
            >
              设置
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600 w-16">热床:</span>
            <input
              type="number"
              value={bedTemp}
              onChange={(e) => setBedTemp(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              min="0"
              max="120"
            />
            <span className="text-gray-500 text-sm">°C</span>
            <button
              onClick={() => handleSetTemp('bed')}
              disabled={disabled || loading === 'temp-bed'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm transition-colors"
            >
              设置
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setNozzleTemp('0'); setBedTemp('0'); handleSetTemp('nozzle'); handleSetTemp('bed'); }}
              disabled={disabled}
              className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg text-sm text-gray-700"
            >
              全部关闭
            </button>
            <button
              onClick={() => { setNozzleTemp('200'); setBedTemp('60'); handleSetTemp('nozzle'); handleSetTemp('bed'); }}
              disabled={disabled}
              className="flex-1 py-2 bg-orange-100 hover:bg-orange-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg text-sm text-orange-700"
            >
              PLA预设
            </button>
            <button
              onClick={() => { setNozzleTemp('230'); setBedTemp('80'); handleSetTemp('nozzle'); handleSetTemp('bed'); }}
              disabled={disabled}
              className="flex-1 py-2 bg-amber-100 hover:bg-amber-200 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg text-sm text-amber-700"
            >
              ABS预设
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
