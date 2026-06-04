import { useState, useEffect } from 'react';
import { Printer as PrinterIcon, Usb, RefreshCw, Plus, PowerOff, Info, AlertCircle, Shield, ShieldAlert, Wifi, Settings, Check, Star, Pencil, Trash2 } from 'lucide-react';
import { usePrinterStore } from '../store/printerStore';
import StatusIndicator from '../components/StatusIndicator';
import { SUPPORTED_PRINTERS } from '../utils/escpos';
import { usePrinting } from '../hooks/usePrinting';

export default function PrinterPage() {
  const { printers, defaultPrinterId, selectedPrinterId, isConnecting, error, addPrinter, removePrinter, setDefaultPrinter, setPrinterAlias, refreshAllStatuses, refreshAllPrinters, checkCapability, capability, reconnectPaired, setSelectedPrinter } = usePrinterStore();
  const { testPrint } = usePrinting();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');

  useEffect(() => {
    checkCapability();
  }, [checkCapability]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (printers.size > 0) {
        refreshAllStatuses();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [printers.size, refreshAllStatuses]);

  const handleAddPrinter = async () => {
    try {
      await addPrinter();
    } catch (err) {
      console.error('Connection error:', err);
    }
  };

  const handleSetDefault = async (printerId: string) => {
    setDefaultPrinter(printerId);
  };

  const handleRemovePrinter = async (printerId: string) => {
    await removePrinter(printerId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAllPrinters();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleTestPrint = async (printerId: string) => {
    try {
      await testPrint(printerId);
    } catch (err) {
      console.error('Test print error:', err);
    }
  };

  const handleEditAlias = (printerId: string, currentAlias?: string) => {
    setEditingAlias(printerId);
    setAliasValue(currentAlias || '');
  };

  const handleSaveAlias = (printerId: string) => {
    setPrinterAlias(printerId, aliasValue.trim());
    setEditingAlias(null);
    setAliasValue('');
  };

  const printerList = Array.from(printers.values());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">打印机管理</h1>
          <p className="text-slate-500 mt-1">连接和管理多台 USB 热敏打印机</p>
        </div>
        <div className="flex items-center gap-3">
          {printerList.length > 0 && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              刷新状态
            </button>
          )}
          <button
            onClick={handleAddPrinter}
            disabled={isConnecting || (capability !== null && !capability.supported)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="w-5 h-5" />
            {isConnecting ? '连接中...' : '添加打印机'}
          </button>
        </div>
      </div>

      {capability && !capability.supported && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 mb-1">WebUSB 不可用</h3>
            <p className="text-sm text-red-700">{capability.reason}</p>
            <div className="mt-2 text-xs text-red-600 space-y-0.5">
              <p>安全上下文: {capability.isSecureContext ? '✅ 是' : '❌ 否'}</p>
              <p>HTTPS: {capability.isHTTPS ? '✅ 是' : '❌ 否'}</p>
              <p>Localhost: {capability.isLocalhost ? '✅ 是' : '❌ 否'}</p>
              <p>WebUSB API: {capability.hasUSBApi ? '✅ 可用' : '❌ 不可用'}</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {printerList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PrinterIcon className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">暂无打印机</h3>
            <p className="text-slate-500 mb-6">点击「添加打印机」按钮连接 USB 热敏打印机</p>
            {capability?.supported && (
              <button
                onClick={handleAddPrinter}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-slate-300 transition-all"
              >
                <Usb className="w-5 h-5" />
                {isConnecting ? '连接中...' : '连接第一台打印机'}
              </button>
            )}
          </div>
        ) : (
          printerList.map((printer) => (
            <div
              key={printer.id}
              className={`bg-white rounded-2xl shadow-sm border-2 p-6 transition-all ${
                selectedPrinterId === printer.id
                  ? 'border-blue-500 bg-blue-50/30'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => setSelectedPrinter(printer.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  printer.status.connected ? 'bg-green-100' : 'bg-slate-100'
                }`}>
                  <PrinterIcon className={`w-7 h-7 ${
                    printer.status.connected ? 'text-green-600' : 'text-slate-400'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    {editingAlias === printer.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={aliasValue}
                          onChange={(e) => setAliasValue(e.target.value)}
                          placeholder="输入打印机别名"
                          className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveAlias(printer.id);
                          }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-800">
                          {printer.alias || printer.device.productName}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditAlias(printer.id, printer.alias);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {printer.isDefault && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                        <Star className="w-3 h-3" />
                        默认
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 mt-1">
                    {printer.device.manufacturerName} · {printer.device.serialNumber || '无序列号'}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <StatusIndicator status={printer.status} showDetails={false} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!printer.isDefault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(printer.id);
                      }}
                      className="p-2 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all"
                      title="设为默认"
                    >
                      <Star className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTestPrint(printer.id);
                    }}
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                    title="测试打印"
                    disabled={!printer.status.connected}
                  >
                    <PrinterIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePrinter(printer.id);
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="移除"
                  >
                    <PowerOff className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-xs text-slate-500 mb-1">厂商 ID</p>
                  <p className="font-mono text-sm text-slate-700">0x{printer.device.vendorId.toString(16).padStart(4, '0')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">产品 ID</p>
                  <p className="font-mono text-sm text-slate-700">0x{printer.device.productId.toString(16).padStart(4, '0')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">连接状态</p>
                  <p className={`text-sm font-medium ${
                    printer.status.connected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {printer.status.connected ? '✅ 已连接' : '❌ 未连接'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">缺纸检测</p>
                  <p className={`text-sm font-medium ${
                    printer.status.paperOk ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {printer.status.paperOk ? '✅ 正常' : '⚠️ 缺纸'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">温度状态</p>
                  <p className={`text-sm font-medium ${
                    printer.status.temperatureOk ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {printer.status.temperatureOk ? '✅ 正常' : '⚠️ 过热'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">机盖状态</p>
                  <p className={`text-sm font-medium ${
                    !printer.status.coverOpen ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {!printer.status.coverOpen ? '✅ 已关闭' : '⚠️ 已打开'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {capability && capability.supported && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wifi className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">连接环境</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 mb-1">安全上下文</p>
              <p className={`text-sm font-medium ${capability.isSecureContext ? 'text-green-600' : 'text-red-600'}`}>
                {capability.isSecureContext ? '✅ 是' : '❌ 否'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 mb-1">HTTPS</p>
              <p className={`text-sm font-medium ${capability.isHTTPS ? 'text-green-600' : 'text-amber-600'}`}>
                {capability.isHTTPS ? '✅ 是' : '⚠️ 否'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 mb-1">Localhost</p>
              <p className={`text-sm font-medium ${capability.isLocalhost ? 'text-green-600' : 'text-slate-400'}`}>
                {capability.isLocalhost ? '✅ 是' : '—'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="text-xs text-slate-500 mb-1">已连接打印机</p>
              <p className="text-sm font-medium text-blue-600">{printerList.length} 台</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <PrinterIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">支持的打印机</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {SUPPORTED_PRINTERS.map((p, index) => (
            <div
              key={index}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center hover:bg-blue-50 hover:border-blue-200 transition-all"
            >
              <p className="font-medium text-slate-800">{p.name}</p>
              <p className="text-xs text-slate-500 font-mono mt-1">0x{p.vendorId.toString(16).padStart(4, '0')}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm text-slate-500">
          <Info className="w-4 h-4 inline mr-1" />
          如果您的打印机不在列表中，可能需要手动选择"未知设备"进行连接。
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 mb-2">使用说明</h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• 点击「添加打印机」按钮选择并连接 USB 热敏打印机</li>
              <li>• 支持同时连接多台打印机，可点击某台打印机设为默认</li>
              <li>• 点击打印机别名旁的铅笔图标可修改显示名称</li>
              <li>• 打印机图标按钮可快速发送测试页</li>
              <li>• 状态每 5 秒自动刷新，可手动点击「刷新状态」</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
