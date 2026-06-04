import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Shield, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function Unlock() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const unlock = useAuthStore((s) => s.unlock)
  const logout = useAuthStore((s) => s.logout)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await unlock(password)
      navigate('/notes')
    } catch {
      setError('Incorrect password. Please try again.')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-crypt-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-crypt-accent/20 rounded-2xl mb-4">
            <Shield size={32} className="text-crypt-accent" />
          </div>
          <h1 className="font-mono text-3xl font-bold text-white">CryptNote</h1>
          <p className="text-crypt-text mt-2 text-sm">Enter your password to unlock your vault</p>
        </div>

        <div className="bg-crypt-card border border-crypt-border rounded-xl p-8">
          <h2 className="font-mono text-xl font-semibold text-white mb-6">Unlock Vault</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-crypt-text mb-1.5 block">Master Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-crypt-text/60" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoFocus
                  className="w-full bg-crypt-bg border border-crypt-border rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent transition-colors"
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-crypt-accent text-crypt-bg font-semibold rounded-lg py-2.5 text-sm hover:bg-crypt-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-crypt-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 text-crypt-text hover:text-red-400 transition-colors text-sm py-1.5"
            >
              <LogOut size={14} />
              Sign out and log in with a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
