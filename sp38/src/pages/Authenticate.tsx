import { useState, useEffect, useRef } from 'react'
import { Shield, Wifi, Key, MapPin, CheckCircle, XCircle, Loader2, QrCode, UserPlus } from 'lucide-react'
import { startAuthentication } from '@simplewebauthn/browser'
import { useGeolocation } from '@/hooks/useGeolocation'

interface Door {
  id: string
  name: string
  location: string
}

type AuthMode = 'nfc' | 'webauthn' | 'visitor'
type AuthResult = 'idle' | 'authenticating' | 'success' | 'failure'

export default function Authenticate() {
  const [mode, setMode] = useState<AuthMode>('nfc')
  const [username, setUsername] = useState('')
  const [doorId, setDoorId] = useState('')
  const [doors, setDoors] = useState<Door[]>([])
  const [result, setResult] = useState<AuthResult>('idle')
  const [resultMessage, setResultMessage] = useState('')
  const [nfcStatus, setNfcStatus] = useState('等待NFC设备...')
  const [visitorCode, setVisitorCode] = useState('')
  const nfcAuthToken = useRef<string | null>(null)
  const lastNfcReadTime = useRef<number>(0)
  const { latitude, longitude, error: gpsError, requestLocation, locationSource } = useGeolocation()

  const generateAuthToken = () => {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  useEffect(() => {
    fetch('/api/doors')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDoors(data)
        else if (data.doors) setDoors(data.doors)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (mode !== 'nfc') return

    let aborted = false

    const tryNfc = async () => {
      if (!('NDEFReader' in window)) {
        setNfcStatus('浏览器不支持NFC，请使用密钥认证')
        return
      }

      try {
        nfcAuthToken.current = generateAuthToken()
        // @ts-expect-error WebNFC experimental API
        const reader = new NDEFReader()
        setNfcStatus('请将NFC设备靠近手机')
        await reader.scan()
        reader.onreading = async (event: any) => {
          if (aborted) return

          const now = Date.now()
          if (now - lastNfcReadTime.current < 3000) {
            return
          }
          lastNfcReadTime.current = now

          setResult('authenticating')
          try {
            const nfcId = event.serialNumber || ''
            const res = await fetch('/api/auth/nfc-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nfcTagId: nfcId,
                username,
                doorId,
                authToken: nfcAuthToken.current,
                gps: latitude ? { latitude, longitude } : null,
                locationSource,
              }),
            })
            const data = await res.json()
            if (data.deduplicated) {
              setNfcStatus('检测到重复读取，已忽略')
              setResult('idle')
            } else {
              setResultMessage(data.message || '')
              setResult(data.success ? 'success' : 'failure')
            }
            nfcAuthToken.current = generateAuthToken()
          } catch {
            setResult('failure')
          }
        }
      } catch {
        if (!aborted) setNfcStatus('NFC不可用，请检查权限或使用密钥认证')
      }
    }

    tryNfc()
    return () => { aborted = true }
  }, [mode, doorId, latitude, longitude])

  const handleWebAuthn = async () => {
    if (!username.trim()) return
    setResult('authenticating')
    setResultMessage('')

    try {
      const startRes = await fetch('/api/auth/authentication-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const startData = await startRes.json()

      if (!startRes.ok) {
        setResultMessage(startData.message || '认证启动失败')
        setResult('failure')
        return
      }

      const credential = await startAuthentication(startData.options)

      const verifyRes = await fetch('/api/auth/authentication-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          doorId,
          method: 'webauthn',
          credential,
          gps: latitude ? { latitude, longitude } : null,
          locationSource,
        }),
      })
      const verifyData = await verifyRes.json()
      setResultMessage(verifyData.message || '')
      setResult(verifyData.success ? 'success' : 'failure')
    } catch {
      setResultMessage('认证异常')
      setResult('failure')
    }
  }

  const handleVisitorAuth = async () => {
    if (!visitorCode.trim() || !doorId) return
    setResult('authenticating')
    setResultMessage('')

    try {
      const res = await fetch('/api/visitors/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: visitorCode.toUpperCase(),
          doorId,
          gps: latitude ? { latitude, longitude } : null,
        }),
      })
      const data = await res.json()
      setResultMessage(data.message || '')
      setResult(data.success ? 'success' : 'failure')
    } catch {
      setResultMessage('认证异常')
      setResult('failure')
    }
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Shield size={32} className="text-accent" />
          <h1 className="text-2xl font-bold text-white">智能门禁认证</h1>
        </div>

        <div className="flex mb-6 bg-surface rounded-lg p-1">
          <button
            onClick={() => { setMode('nfc'); setResult('idle'); setResultMessage('') }}
            className={`flex-1 py-2.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'nfc' ? 'bg-accent text-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            NFC
          </button>
          <button
            onClick={() => { setMode('webauthn'); setResult('idle'); setResultMessage('') }}
            className={`flex-1 py-2.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'webauthn' ? 'bg-accent text-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            密钥
          </button>
          <button
            onClick={() => { setMode('visitor'); setResult('idle'); setResultMessage('') }}
            className={`flex-1 py-2.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'visitor' ? 'bg-accent text-primary' : 'text-gray-400 hover:text-white'
            }`}
          >
            访客码
          </button>
        </div>

        {(mode === 'nfc' || mode === 'webauthn' || mode === 'visitor') && (
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">门禁点</label>
            <select
              value={doorId}
              onChange={(e) => setDoorId(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-secondary rounded-lg text-white focus:outline-none focus:border-accent appearance-none"
            >
              <option value="">选择门禁点</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}

        {mode === 'nfc' && (
          <div className="flex flex-col items-center py-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 rounded-full border-2 border-accent/30 animate-pulse-ring" />
              </div>
              <div className="w-32 h-32 rounded-full bg-accent/10 flex items-center justify-center">
                <Wifi size={48} className="text-accent" />
              </div>
            </div>
            <p className="mt-6 text-gray-300 text-sm">{nfcStatus}</p>
          </div>
        )}

        {mode === 'webauthn' && (
          <div className="space-y-4">
            <div className="flex justify-center py-4">
              <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                <Key size={36} className="text-accent" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-secondary rounded-lg text-white focus:outline-none focus:border-accent"
                placeholder="输入用户名"
              />
            </div>

            <button
              onClick={handleWebAuthn}
              disabled={!username.trim() || result === 'authenticating'}
              className="w-full py-3 rounded-lg bg-accent text-primary font-bold text-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              认证
            </button>
          </div>
        )}

        {mode === 'visitor' && (
          <div className="space-y-4">
            <div className="flex justify-center py-4">
              <div className="w-20 h-20 rounded-full bg-info/10 flex items-center justify-center">
                <UserPlus size={36} className="text-info" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">访客码</label>
              <input
                type="text"
                value={visitorCode}
                onChange={(e) => setVisitorCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 bg-surface border border-secondary rounded-lg text-white focus:outline-none focus:border-accent font-mono text-lg tracking-widest text-center"
                placeholder="输入8位访客码"
                maxLength={8}
              />
            </div>

            <button
              onClick={handleVisitorAuth}
              disabled={visitorCode.length < 8 || !doorId || result === 'authenticating'}
              className="w-full py-3 rounded-lg bg-info text-white font-bold text-lg hover:bg-info/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              验证访客码
            </button>
          </div>
        )}

        {result === 'authenticating' && (
          <div className="flex items-center justify-center gap-2 mt-6 text-accent">
            <Loader2 size={20} className="animate-spin" />
            <span>认证中...</span>
          </div>
        )}

        {result === 'success' && (
          <div className="flex flex-col items-center mt-6 animate-bounce">
            <CheckCircle size={48} className="text-accent" />
            <span className="mt-2 text-accent font-bold">认证成功</span>
            {resultMessage && <span className="text-sm text-accent/70 mt-1">{resultMessage}</span>}
          </div>
        )}

        {result === 'failure' && (
          <div className="flex flex-col items-center mt-6">
            <XCircle size={48} className="text-danger" />
            <span className="mt-2 text-danger font-bold">认证失败</span>
            {resultMessage && <span className="text-sm text-danger/70 mt-1">{resultMessage}</span>}
            <button
              onClick={() => { setResult('idle'); setResultMessage('') }}
              className="mt-3 text-sm text-gray-400 underline hover:text-white"
            >
              重试
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-1 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <MapPin size={14} className={locationSource === 'gps' ? 'text-accent' : locationSource === 'wifi' ? 'text-info' : ''} />
            <span>
              {gpsError
                ? '定位不可用'
                : latitude
                  ? `${latitude.toFixed(4)}, ${longitude?.toFixed(4)}`
                  : '获取位置中...'}
            </span>
          </div>
          {locationSource && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${locationSource === 'gps' ? 'bg-accent/10 text-accent' : 'bg-info/10 text-info'}`}>
              {locationSource === 'gps' ? 'GPS' : 'WiFi/IP'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
