import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Printer, FileText, Home, History, Settings } from 'lucide-react';
import { usePrinterStore } from '../store/printerStore';

const navItems = [
  { path: '/', icon: Home, label: '打印' },
  { path: '/printer', icon: Printer, label: '打印机' },
  { path: '/templates', icon: FileText, label: '模板' },
  { path: '/history', icon: History, label: '历史' },
];

export default function Layout() {
  const { printers, selectedPrinterId, isConnecting } = usePrinterStore();
  const navigate = useNavigate();

  const printerList = Array.from(printers.values());
  const selectedPrinter = selectedPrinterId ? printers.get(selectedPrinterId) : null;
  const connectedCount = printerList.filter(p => p.status.connected).length;

  const getStatusColor = () => {
    if (isConnecting) return 'bg-blue-500';
    if (printerList.length === 0) return 'bg-gray-400';
    if (!selectedPrinter) {
      return connectedCount > 0 ? 'bg-green-500' : 'bg-gray-400';
    }
    if (!selectedPrinter.status.connected) return 'bg-gray-400';
    if (!selectedPrinter.status.online) return 'bg-red-500';
    if (!selectedPrinter.status.paperOk) return 'bg-yellow-500';
    if (!selectedPrinter.status.temperatureOk) return 'bg-orange-500';
    if (selectedPrinter.status.coverOpen) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (isConnecting) return '连接中...';
    if (printerList.length === 0) return '未连接';
    if (!selectedPrinter) {
      return `${connectedCount} 台在线`;
    }
    if (selectedPrinter.status.errorMessage) return selectedPrinter.status.errorMessage;
    return '正常';
  };

  const getPrinterName = () => {
    if (!selectedPrinter) {
      if (printerList.length === 0) return '打印机';
      return `${printerList.length} 台打印机`;
    }
    return selectedPrinter.alias || selectedPrinter.device.productName;
  };

  const handleClick = () => {
    navigate('/printer');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Printer className="w-6 h-6 text-blue-600" />
            热敏打印系统
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div
            onClick={handleClick}
            className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-all"
          >
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${isConnecting ? 'animate-pulse' : ''}`} />
              {!isConnecting && getStatusColor() !== 'bg-gray-400' && (
                <div className={`absolute inset-0 w-3 h-3 rounded-full ${getStatusColor()} opacity-50 animate-ping`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">
                {getPrinterName()}
              </p>
              <p className="text-xs text-slate-500">{getStatusText()}</p>
            </div>
            {printerList.length > 0 && (
              <div className="text-xs text-slate-400">
                {connectedCount}/{printerList.length}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
