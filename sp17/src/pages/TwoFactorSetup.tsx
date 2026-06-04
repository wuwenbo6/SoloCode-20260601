import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Copy, Check, ArrowLeft } from 'lucide-react'
import * as api from '@/utils/api'

export default function TwoFactorSetup() {
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    generateSecret()
  }, [])

  const generateSecret = async () => {
    try {
      setGenerating(true)
      const res = await api.generateTotp()
      setQrCodeUrl(res.qrCodeUrl)
      setSecret(res.secret)
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.enableTotp(code, secret)
      navigate('/notes')
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-crypt-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fadeIn">
        <button
          onClick={() => navigate('/notes')}
          className="flex items-center text-crypt-text hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Notes
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-crypt-accent/20 rounded-2xl mb-4">
            <Shield size={32} className="text-crypt-accent" />
          </div>
          <h1 className="font-mono text-2xl font-bold text-white">Set Up Two-Factor Authentication</h1>
          <p className="text-crypt-text mt-2 text-sm">Scan the QR code with your authenticator app</p>
        </div>

        <div className="bg-crypt-card border border-crypt-border rounded-xl p-8">
          {generating ? (
            <div className="text-center py-8 text-crypt-text">Generating secret...</div>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="bg-white p-4 rounded-lg">
                  <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>

              <div className="mb-6">
                <label className="text-sm text-crypt-text mb-1.5 block">Manual Entry Secret</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-crypt-bg border border-crypt-border rounded-lg px-3 py-2 text-white text-sm font-mono break-all">
                    {secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="p-2 bg-crypt-bg border border-crypt-border rounded-lg hover:bg-crypt-border/50 transition-colors"
                  >
                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-crypt-text" />}
                  </button>
                </div>
              </div>

              <form onSubmit={handleEnable} className="space-y-4">
                <div>
                  <label className="text-sm text-crypt-text mb-1.5 block">Verification Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    required
                    maxLength={6}
                    className="w-full bg-crypt-bg border border-crypt-border rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-crypt-text/40 focus:outline-none focus:border-crypt-accent transition-colors text-center font-mono text-lg tracking-widest"
                  />
                </div>

                {error && <p className="text-red-400 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full bg-crypt-accent text-crypt-bg font-semibold rounded-lg py-2.5 text-sm hover:bg-crypt-accent/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Enabling...' : 'Enable Two-Factor Authentication'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
