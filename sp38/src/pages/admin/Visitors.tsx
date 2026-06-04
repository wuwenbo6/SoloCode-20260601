import { useState, useEffect } from 'react'
import { UserPlus, QrCode, Trash2, RefreshCw, Clock, Phone, X } from 'lucide-react'

interface VisitorKey {
  id: string
  code: string
  phone: string
  visitor_name: string
  door_id: string
  door_name: string
  creator_name: string
  expires_at: string
  used_at: string | null
  status: string
  created_at: string
}

interface Door {
  id: string
  name: string
}

export default function Visitors() {
  const [visitors, setVisitors] = useState<VisitorKey[]>([])
  const [doors, setDoors] = useState<Door[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [form, setForm] = useState({ phone: '', visitorName: '', doorId: '', expiresInMinutes: 60 })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/doors').then((r) => r.json()).then((d) => setDoors(d.doors || [])).catch(() => {})
  }, [])

  const fetchVisitors = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/visitors')
      const data = await res.json()
      setVisitors(data.visitorKeys || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVisitors() }, [])

  const handleCreate = async () => {
    if (!form.phone || !form.doorId) return
    setCreating(true)
    try {
      const res = await fetch('/api/visitors/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, createdBy: 'admin-001' }),
      })
      const data = await res.json()
      if (data.success) {
        setQrImage(data.visitorKey.qrImage)
        fetchVisitors()
      }
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await fetch(`/api/visitors/${id}`, { method: 'DELETE' })
      fetchVisitors()
    } catch {
      // ignore
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-accent/10 text-accent'
      case 'used': return 'bg-info/10 text-info'
      case 'expired': return 'bg-danger/10 text-danger'
      case 'revoked': return 'bg-secondary text-gray-400'
      default: return 'bg-secondary text-gray-400'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active': return '有效'
      case 'used': return '已使用'
      case 'expired': return '已过期'
      case 'revoked': return '已撤销'
      default: return status
    }
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <UserPlus size={22} className="text-accent" />
          访客密钥
        </h1>
        <div className="flex gap-2">
          <button onClick={fetchVisitors} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => { setShowCreate(true); setQrImage(null) }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 transition-colors">
            <UserPlus size={16} />
            生成访客码
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-6 p-5 bg-surface rounded-xl border border-secondary">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">生成临时访客密钥</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">访客手机号 *</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent" placeholder="13800138000" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">访客姓名</label>
              <input type="text" value={form.visitorName} onChange={(e) => setForm({ ...form, visitorName: e.target.value })} className="w-full px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent" placeholder="可选" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">允许门禁点 *</label>
              <select value={form.doorId} onChange={(e) => setForm({ ...form, doorId: e.target.value })} className="w-full px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent">
                <option value="">选择门禁点</option>
                {doors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">有效时长（分钟）</label>
              <input type="number" value={form.expiresInMinutes} onChange={(e) => setForm({ ...form, expiresInMinutes: parseInt(e.target.value) || 60 })} className="w-full px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent" min={5} max={1440} />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <button onClick={handleCreate} disabled={!form.phone || !form.doorId || creating} className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {creating ? '生成中...' : '生成'}
            </button>
            {qrImage && (
              <div className="flex items-center gap-3">
                <img src={qrImage} alt="QR Code" className="w-24 h-24 rounded-lg border border-secondary" />
                <div className="text-sm text-gray-400">
                  <p>请将二维码发送给访客</p>
                  <p>访客在认证页扫码即可通行</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw size={24} className="animate-spin text-accent" /></div>
      ) : visitors.length === 0 ? (
        <div className="text-center py-20 text-gray-500">暂无访客密钥</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-secondary">
          <table className="w-full">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">访客码</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">访客信息</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">门禁点</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">有效期至</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">状态</th>
                <th className="text-right px-4 py-3 text-sm text-gray-400 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((vk) => (
                <tr key={vk.id} className="border-t border-secondary hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-accent font-bold tracking-wider">{vk.code}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone size={14} className="text-gray-500" />
                      <span>{vk.phone}</span>
                    </div>
                    {vk.visitor_name && <div className="text-xs text-gray-500 mt-0.5">{vk.visitor_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{vk.door_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{vk.expires_at}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(isExpired(vk.expires_at) && vk.status === 'active' ? 'expired' : vk.status)}`}>
                      {isExpired(vk.expires_at) && vk.status === 'active' ? '已过期' : statusLabel(vk.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {vk.status === 'active' && (
                      <button onClick={() => handleRevoke(vk.id)} className="p-1.5 rounded hover:bg-danger/20 text-gray-400 hover:text-danger transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
