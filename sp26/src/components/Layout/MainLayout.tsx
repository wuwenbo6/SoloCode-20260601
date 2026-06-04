import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine,
  ClipboardList,
  Tag,
  MapPin,
  WifiOff,
  Menu,
  X,
  LogOut,
  User,
  Package
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useOfflineStore } from '@/store/offlineStore';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/', label: '扫描', icon: <ScanLine size={24} /> },
  { path: '/inventory', label: '盘点', icon: <ClipboardList size={24} /> },
  { path: '/write-tag', label: '写入标签', icon: <Tag size={24} /> },
  { path: '/location', label: '位置跟踪', icon: <MapPin size={24} /> },
  { path: '/assets', label: '资产管理', icon: <Package size={24} /> },
  { path: '/offline', label: '离线同步', icon: <WifiOff size={24} /> },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { isOnline, queue } = useOfflineStore();

  const pendingSyncCount = queue.length;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          x: sidebarOpen ? 0 : '-100%',
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-xl flex flex-col',
          'transform lg:transform-none'
        )}
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                <ScanLine className="text-white" size={22} />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-gray-900">NFC资产</h1>
                <p className="text-xs text-gray-500">智能管理系统</p>
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
            <div className={cn(
              'w-2.5 h-2.5 rounded-full',
              isOnline ? 'bg-success-500' : 'bg-danger-500'
            )} />
            <span className="text-sm text-gray-600">
              {isOnline ? '在线' : '离线'}
            </span>
            {!isOnline && pendingSyncCount > 0 && (
              <span className="ml-auto text-xs bg-warning-100 text-warning-600 px-2 py-0.5 rounded-full">
                {pendingSyncCount} 待同步
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <User size={20} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <LogOut size={18} />
                <span>退出登录</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="block w-full text-center px-4 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
            >
              登录
            </Link>
          )}
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} className="text-gray-600" />
            </button>
            
            <div className="flex-1 text-center lg:text-left">
              <h2 className="font-display text-lg font-semibold text-gray-900">
                {navItems.find(item => item.path === location.pathname)?.label || 'NFC资产管理'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {!isOnline && (
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-warning-100 text-warning-700 rounded-full text-sm">
                  <WifiOff size={14} />
                  离线模式
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
