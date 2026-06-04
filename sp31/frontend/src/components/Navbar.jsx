import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', label: '仪表盘', icon: '📊' },
    { path: '/monitor', label: '输入监控', icon: '🎮' },
    { path: '/mapping', label: '按键映射', icon: '🔗' },
    { path: '/turbo', label: '连发', icon: '⚡' },
    { path: '/profiles', label: '配置文件', icon: '📁' },
    { path: '/macros', label: '宏编程', icon: '⏺️' },
    { path: '/community', label: '社区', icon: '🌍' },
    { path: '/sync', label: '同步', icon: '☁️' }
  ];

  return (
    <nav className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl">🎮</span>
              <span className="font-bold text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Gamepad Controller
              </span>
            </Link>
            <div className="hidden md:flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    location.pathname === item.path
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : 'text-gray-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-300 text-sm">
              👤 {user?.username}
            </span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;