import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, Shield, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const register = useAuthStore((s) => s.register)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    try {
      await register(email, password)
      navigate('/notes')
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
          <p className="text-crypt-text mt-2 text-sm">Create your encrypted vault</p>
        </div>

        <div className="bg-crypt-card border border-crypt-border rounded-xl p-8">
          <h2 className="font-mono text-xl font-semibold text-white mb-6">Create Account</h2>

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
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  className="w-full bg-crypt-bg border border-crypt-border rounded-lg pl-10 pr-10 py-2.5 text-white text-sm placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-crypt-text/60 hover:text-crypt-text transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-crypt-text mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-crypt-text/60" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
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
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-crypt-text text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-crypt-accent hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
