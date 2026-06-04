import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Printer, Thermometer } from 'lucide-react';
import { cn, getStateLabel, getStateBgColor } from '../utils';
import type { PrinterInfo } from '../types';
import { multiPrinterAPI } from '../services/api';

export function MultiPrinterPanel() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPrinters = useCallback(async () => {
    try {
      const data = await multiPrinterAPI.list();
      setPrinters(data.printers);
      setActiveId(data.active);
    } catch {
      // silently ignore to avoid disrupting auto-refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrinters();
    const interval = setInterval(fetchPrinters, 3000);
    return () => clearInterval(interval);
  }, [fetchPrinters]);

  const handleSetActive = async (id: string) => {
    if (id === activeId) return;
    try {
      await multiPrinterAPI.setActive(id);
      setActiveId(id);
    } catch {
      // ignore
    }
  };

  const handleAddPrinter = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const id = `printer-${Date.now()}`;
      await multiPrinterAPI.add(id, name);
      setNewName('');
      setShowAddForm(false);
      await fetchPrinters();
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此打印机吗？')) return;
    setDeletingId(id);
    try {
      await multiPrinterAPI.remove(id);
      await fetchPrinters();
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-40 bg-gray-200 rounded-lg" />
            <div className="h-40 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">多打印机管理</h3>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加打印机
        </button>
      </div>

      {showAddForm && (
        <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="输入打印机名称"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            onKeyDown={(e) => e.key === 'Enter' && handleAddPrinter()}
            autoFocus
          />
          <button
            onClick={handleAddPrinter}
            disabled={adding || !newName.trim()}
            className="px-4 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? '添加中...' : '添加'}
          </button>
        </div>
      )}

      {printers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Printer className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">暂无打印机，请点击上方按钮添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {printers.map((printer) => (
            <div
              key={printer.id}
              onClick={() => handleSetActive(printer.id)}
              className={cn(
                'bg-white rounded-xl shadow-sm border-2 p-4 cursor-pointer transition-all hover:shadow-md',
                printer.id === activeId ? 'border-primary-500' : 'border-gray-200'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      printer.connected ? 'bg-green-500' : 'bg-red-500'
                    )}
                  />
                  <span className="font-medium text-gray-800 truncate">{printer.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStateBgColor(printer.state))}>
                    {getStateLabel(printer.state)}
                  </span>
                  {printer.id !== 'default' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(printer.id);
                      }}
                      disabled={deletingId === printer.id}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="删除打印机"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {printer.progress > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>进度</span>
                    <span>{printer.progress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${printer.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-red-500" />
                  <span>喷嘴 {printer.nozzle_temp.toFixed(0)}°C</span>
                </div>
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-blue-500" />
                  <span>热床 {printer.bed_temp.toFixed(0)}°C</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
