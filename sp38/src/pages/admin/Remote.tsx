import { useState, useEffect } from 'react'
import { Unlock, RefreshCw, CheckCircle } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Door {
  id: string
  name: string
  location: string
  status: string
}

export default function Remote() {
  const [doors, setDoors] = useState<Door[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDoor, setConfirmDoor] = useState<Door | null>(null)
  const [opening, setOpening] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchDoors = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/doors')
      const data = await res.json()
      setDoors(data.doors || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDoors()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleOpen = async () => {
    if (!confirmDoor) return
    setOpening(true)
    try {
      const res = await fetch('/api/remote/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doorId: confirmDoor.id, operatorName: '管理员' }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `${confirmDoor.name} 已远程开启`, type: 'success' })
      } else {
        setToast({ message: data.message || '操作失败', type: 'error' })
      }
    } catch {
      setToast({ message: '网络错误', type: 'error' })
    } finally {
      setOpening(false)
      setConfirmDoor(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Unlock size={22} className="text-accent" />
          远程开门
        </h1>
        <button
          onClick={fetchDoors}
          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-accent" />
        </div>
      ) : doors.length === 0 ? (
        <div className="text-center py-20 text-gray-500">暂无门禁点</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {doors.map((door) => (
            <div
              key={door.id}
              className="bg-surface border border-secondary rounded-xl p-5 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{door.name}</h3>
                  <p className="text-gray-400 text-sm mt-1">{door.location}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${door.status === 'online' ? 'bg-accent' : 'bg-danger'}`} />
                  <span className={`text-xs ${door.status === 'online' ? 'text-accent' : 'text-danger'}`}>
                    {door.status === 'online' ? '在线' : '离线'}
                  </span>
                </div>
              </div>

              <div className="border-t border-secondary pt-4">
                <button
                  onClick={() => setConfirmDoor(door)}
                  disabled={door.status !== 'online'}
                  className="w-full py-2.5 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Unlock size={18} />
                  开门
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDoor}
        title="确认远程开门"
        message={`确定要远程开启"${confirmDoor?.name}"吗？此操作将被记录为管理员操作。`}
        onConfirm={handleOpen}
        onCancel={() => setConfirmDoor(null)}
      />

      {opening && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-3 bg-surface border border-secondary rounded-xl px-6 py-4">
            <RefreshCw size={20} className="animate-spin text-accent" />
            <span className="text-white">正在开门...</span>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border ${
          toast.type === 'success' ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-danger/10 border-danger/30 text-danger'
        }`}>
          {toast.type === 'success' && <CheckCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  )
}
