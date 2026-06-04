import { useState } from 'react'
import { X, Key, Loader2 } from 'lucide-react'
import { startRegistration } from '@simplewebauthn/browser'

interface KeyRegisterDialogProps {
  open: boolean
  onClose: () => void
}

export default function KeyRegisterDialog({ open, onClose }: KeyRegisterDialogProps) {
  const [username, setUsername] = useState('')
  const [keyName, setKeyName] = useState('')
  const [status, setStatus] = useState<'idle' | 'starting' | 'registering' | 'finishing' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!open) return null

  const handleSubmit = async () => {
    if (!username.trim() || !keyName.trim()) return

    setStatus('starting')
    setErrorMsg('')

    try {
      const startRes = await fetch('/api/auth/registration-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, keyName }),
      })
      const startData = await startRes.json()

      if (!startRes.ok) {
        throw new Error(startData.error || '注册启动失败')
      }

      setStatus('registering')

      const credential = await startRegistration(startData.options)

      setStatus('finishing')

      const finishRes = await fetch('/api/auth/registration-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, keyName, credential }),
      })
      const finishData = await finishRes.json()

      if (!finishRes.ok) {
        throw new Error(finishData.error || '注册完成失败')
      }

      setStatus('success')
      setTimeout(() => {
        setUsername('')
        setKeyName('')
        setStatus('idle')
        onClose()
      }, 1500)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : '注册失败')
    }
  }

  const handleClose = () => {
    if (status === 'starting' || status === 'registering' || status === 'finishing') return
    setUsername('')
    setKeyName('')
    setStatus('idle')
    setErrorMsg('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-surface border border-secondary rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={20} className="text-accent" />
            注册新密钥
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent"
              placeholder="输入用户名"
              disabled={status !== 'idle' && status !== 'error'}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">密钥名称</label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="w-full px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent"
              placeholder="例如：我的安全密钥"
              disabled={status !== 'idle' && status !== 'error'}
            />
          </div>

          {status === 'error' && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
              {errorMsg}
            </div>
          )}

          {status === 'success' && (
            <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg text-accent text-sm">
              密钥注册成功！
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-400">
            {status === 'starting' && <><Loader2 size={16} className="animate-spin" /><span>正在启动注册...</span></>}
            {status === 'registering' && <><Loader2 size={16} className="animate-spin" /><span>请在浏览器中完成认证...</span></>}
            {status === 'finishing' && <><Loader2 size={16} className="animate-spin" /><span>正在完成注册...</span></>}
          </div>

          {(status === 'idle' || status === 'error') && (
            <button
              onClick={handleSubmit}
              disabled={!username.trim() || !keyName.trim()}
              className="w-full py-2.5 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              开始注册
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
