import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, Cpu, Activity } from 'lucide-react';

const navItems = [
  { path: '/', label: '监控台', icon: LayoutDashboard },
  { path: '/config', label: '资源配置', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[#0A1929] border-r border-[#132F4C] flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-[#132F4C]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#0077B6] rounded-lg flex items-center justify-center">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              RDT Sim
            </h1>
            <p className="text-xs text-[#B2BAC2]">Intel RDT 模拟器</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30'
                  : 'text-[#B2BAC2] hover:bg-[#132F4C] hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[#132F4C]">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#132F4C]/50 rounded-lg">
          <Activity className="w-5 h-5 text-[#4CAF50] animate-pulse" />
          <div>
            <p className="text-xs text-[#B2BAC2]">模拟状态</p>
            <p className="text-sm text-[#4CAF50] font-medium">运行中</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
