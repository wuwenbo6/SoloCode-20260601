import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const login = useAuthStore((s) => s.login)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const result = await login(email, password)
      if (result && result.requiresTwoFactor) {
        navigate('/two-factor-verify', { state: { tempToken: result.tempToken } })
      } else {
        navigate('/notes')
      }
    } catch (err: unknown) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-crypt-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-crypt-accent/20 rounded-2xl mb-4">
            <Shield size={32} className="text-crypt-accent" />
          </div>
          <h1 className="font-mono text-3xl font-bold text-white">CryptNote</h1>
          <p className="text-crypt-text mt-2 text-sm">End-to-end encrypted notes</p>
        </div>

        <div className="bg-crypt-card border border-crypt-border rounded-xl p-8">
          <h2 className="font-mono text-xl font-semibold text-white mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-crypt-text mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-crypt-text/60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-crypt-bg border border-crypt-border rounded-lg pl-10 pr-3 py-2.5 text-white text-sm placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-crypt-text mb-1.5 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-crypt-text/60" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-crypt-text text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-crypt-accent hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
