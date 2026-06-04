import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import * as api from '@/utils/api'
import { base64ToArrayBuffer } from '@/utils/crypto'

export default function TwoFactorVerify() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)

  const tempToken = (location.state as { tempToken?: string })?.tempToken

  useEffect(() => {
    if (!tempToken) {
      navigate('/login')
    }
  }, [tempToken, navigate])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempToken) return

    setError('')
    setLoading(true)
    try {
      const res = await api.verifyTotp(tempToken, code)
      const salt = new Uint8Array(base64ToArrayBuffer(res.user.salt))
      localStorage.setItem('token', res.token)
      setAuth(res.token, { id: res.user.id, email: res.user.email }, salt)
      navigate('/notes')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!tempToken) {
    return null
  }

  return (
    <div className="min-h-screen bg-crypt-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-crypt-accent/20 rounded-2xl mb-4">
            <Shield size={32} className="text-crypt-accent" />
          </div>
          <h1 className="font-mono text-2xl font-bold text-white">Two-Factor Authentication</h1>
          <p className="text-crypt-text mt-2 text-sm">Enter the 6-digit code from your authenticator app</p>
        </div>

        <div className="bg-crypt-card border border-crypt-border rounded-xl p-8">
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="text-sm text-crypt-text mb-1.5 block text-center">Verification Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                maxLength={6}
                autoFocus
                className="w-full bg-crypt-bg border border-crypt-border rounded-lg px-3 py-4 text-white text-center font-mono text-2xl tracking-[0.5em] placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent transition-colors"
              />
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-crypt-accent text-crypt-bg font-semibold rounded-lg py-2.5 text-sm hover:bg-crypt-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <p className="text-center text-crypt-text text-sm mt-6">
            <button
              onClick={() => navigate('/login')}
              className="text-crypt-accent hover:underline"
            >
              Back to login
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
