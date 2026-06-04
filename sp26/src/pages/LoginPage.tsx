import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LogIn,
  Mail,
  Lock,
  AlertCircle,
  ScanLine,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/UI/Button';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuthStore();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login({ email: email.trim(), password });
      setAuth(response.user, response.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查邮箱和密码');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, setAuth]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-500/30"
          >
            <ScanLine className="text-white" size={40} />
          </motion.div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">NFC资产管理</h1>
          <p className="text-primary-200">智能资产追踪与盘点系统</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl p-8"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-6">登录账户</h2>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-danger-50 border border-danger-200 rounded-xl p-3 mb-4"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-danger-500 flex-shrink-0" />
                <p className="text-danger-700 text-sm">{error}</p>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="xl"
              fullWidth
              isLoading={isLoading}
              leftIcon={<LogIn size={20} />}
            >
              登录
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">测试账号</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setEmail('admin@example.com'); setPassword('admin123456'); }}
                className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
              >
                <p className="text-xs font-medium text-gray-700">管理员</p>
                <p className="text-xs text-gray-400 mt-0.5">admin@example.com</p>
              </button>
              <button
                onClick={() => { setEmail('inventory@example.com'); setPassword('inventory123'); }}
                className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
              >
                <p className="text-xs font-medium text-gray-700">盘点员</p>
                <p className="text-xs text-gray-400 mt-0.5">inventory@example.com</p>
              </button>
            </div>
          </div>
        </motion.div>

        <p className="text-center text-primary-300 text-xs mt-6">
          NFC资产管理 v1.0 · 需要HTTPS和NFC支持的浏览器
        </p>
      </motion.div>
    </div>
  );
}
