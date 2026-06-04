import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Key, FileText, Radio, Unlock, Activity, Menu, X, UserPlus, Clock, DoorOpen } from 'lucide-react'

const navItems = [
  { to: '/admin/keys', label: '密钥管理', icon: Key },
  { to: '/admin/visitors', label: '访客密钥', icon: UserPlus },
  { to: '/admin/doors', label: '门禁点管理', icon: DoorOpen },
  { to: '/admin/schedules', label: '时间表', icon: Clock },
  { to: '/admin/logs', label: '门禁日志', icon: FileText },
  { to: '/admin/remote', label: '远程开门', icon: Unlock },
  { to: '/admin/events', label: '实时事件', icon: Activity },
]

export default function Sidebar() {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface border border-secondary"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 h-screen w-60 bg-surface border-r border-secondary z-40 flex flex-col transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-6 border-b border-secondary">
          <Shield size={28} className="text-accent" />
          <span className="text-lg font-bold text-accent">智能门禁</span>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const active = location.pathname === item.to
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  active
                    ? 'bg-accent/10 text-accent border-r-2 border-accent'
                    : 'text-gray-400 hover:bg-secondary/50 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-5 py-4 border-t border-secondary">
          <div className="flex items-center gap-2">
            <Radio size={14} className="text-accent" />
            <span className="text-xs text-gray-500">系统运行中</span>
          </div>
        </div>
      </aside>
    </>
  )
}
