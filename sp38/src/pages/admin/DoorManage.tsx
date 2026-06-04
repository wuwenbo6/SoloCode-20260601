import { useState, useEffect } from 'react'
import { DoorOpen, Plus, Trash2, RefreshCw, Key, Link2, Unlink } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'

interface Door {
  id: string
  name: string
  location: string
  status: string
  keyCount: number
  scheduleCount: number
}

interface DoorKey {
  door_id: string
  key_id: string
  key_name: string
  credential_id: string
  username: string
  display_name: string
  granted_by_name: string
  created_at: string
}

interface KeyItem {
  id: string
  key_name: string
  username: string
}

export default function DoorManage() {
  const [doors, setDoors] = useState<Door[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', location: '' })
  const [deleteDoor, setDeleteDoor] = useState<Door | null>(null)

  const [selectedDoor, setSelectedDoor] = useState<Door | null>(null)
  const [doorKeys, setDoorKeys] = useState<DoorKey[]>([])
  const [allKeys, setAllKeys] = useState<KeyItem[]>([])
  const [bindKeyId, setBindKeyId] = useState('')
  const [showBind, setShowBind] = useState(false)

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

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys')
      const data = await res.json()
      setAllKeys(data.keys || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => { fetchDoors(); fetchKeys() }, [])

  const handleAddDoor = async () => {
    if (!addForm.name) return
    try {
      await fetch('/api/doors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      setShowAdd(false)
      setAddForm({ name: '', location: '' })
      fetchDoors()
    } catch {
      // ignore
    }
  }

  const handleDeleteDoor = async () => {
    if (!deleteDoor) return
    try {
      await fetch(`/api/doors/${deleteDoor.id}`, { method: 'DELETE' })
      setDeleteDoor(null)
      if (selectedDoor?.id === deleteDoor.id) setSelectedDoor(null)
      fetchDoors()
    } catch {
      // ignore
    }
  }

  const selectDoor = async (door: Door) => {
    setSelectedDoor(door)
    try {
      const res = await fetch(`/api/doors/${door.id}/keys`)
      const data = await res.json()
      setDoorKeys(data.keys || [])
    } catch {
      setDoorKeys([])
    }
  }

  const handleBind = async () => {
    if (!selectedDoor || !bindKeyId) return
    try {
      await fetch(`/api/doors/${selectedDoor.id}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId: bindKeyId, grantedBy: 'admin-001' }),
      })
      setShowBind(false)
      setBindKeyId('')
      selectDoor(selectedDoor)
    } catch {
      // ignore
    }
  }

  const handleUnbind = async (keyId: string) => {
    if (!selectedDoor) return
    try {
      await fetch(`/api/doors/${selectedDoor.id}/keys/${keyId}`, { method: 'DELETE' })
      selectDoor(selectedDoor)
    } catch {
      // ignore
    }
  }

  const unboundKeys = allKeys.filter((k) => !doorKeys.some((dk) => dk.key_id === k.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <DoorOpen size={22} className="text-accent" />
          门禁点管理
        </h1>
        <div className="flex gap-2">
          <button onClick={fetchDoors} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 transition-colors">
            <Plus size={16} />
            新增门禁
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-6 p-4 bg-surface rounded-xl border border-secondary">
          <h3 className="text-white font-bold mb-3">新增门禁点</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">名称 *</label>
              <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} className="px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent" placeholder="D栋大门" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">位置</label>
              <input type="text" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} className="px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent" placeholder="D栋1楼" />
            </div>
            <button onClick={handleAddDoor} disabled={!addForm.name} className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-40 transition-colors">确认</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg bg-secondary text-gray-300 hover:bg-secondary/80 transition-colors">取消</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-bold text-white mb-3">门禁点列表</h2>
          {loading ? (
            <div className="flex justify-center py-10"><RefreshCw size={24} className="animate-spin text-accent" /></div>
          ) : (
            <div className="space-y-2">
              {doors.map((door) => (
                <div
                  key={door.id}
                  onClick={() => selectDoor(door)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    selectedDoor?.id === door.id ? 'bg-accent/5 border-accent/40' : 'bg-surface border-secondary hover:border-accent/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${door.status === 'online' ? 'bg-accent' : 'bg-danger'}`} />
                        <span className="text-white font-bold">{door.name}</span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{door.location}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Key size={12} />{door.keyCount}</span>
                      <span className="flex items-center gap-1"><DoorOpen size={12} />{door.scheduleCount}</span>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteDoor(door) }} className="p-1 rounded hover:bg-danger/20 text-gray-400 hover:text-danger transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedDoor && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Link2 size={18} className="text-accent" />
                {selectedDoor.name} — 绑定密钥
              </h2>
              <button onClick={() => setShowBind(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-primary font-bold text-sm hover:bg-accent/90 transition-colors">
                <Plus size={14} />
                绑定密钥
              </button>
            </div>

            {showBind && (
              <div className="mb-3 p-4 bg-surface rounded-xl border border-accent/30">
                <div className="flex items-center gap-3">
                  <select value={bindKeyId} onChange={(e) => setBindKeyId(e.target.value)} className="flex-1 px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent">
                    <option value="">选择要绑定的密钥</option>
                    {unboundKeys.map((k) => <option key={k.id} value={k.id}>{k.key_name} ({k.username})</option>)}
                  </select>
                  <button onClick={handleBind} disabled={!bindKeyId} className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-40 transition-colors text-sm">绑定</button>
                  <button onClick={() => { setShowBind(false); setBindKeyId('') }} className="px-3 py-2 rounded-lg bg-secondary text-gray-300 text-sm">取消</button>
                </div>
                {unboundKeys.length === 0 && <p className="text-xs text-gray-500 mt-2">所有密钥已绑定或无可用密钥</p>}
              </div>
            )}

            {doorKeys.length === 0 ? (
              <div className="text-center py-10 text-gray-500">该门禁点尚未绑定密钥</div>
            ) : (
              <div className="space-y-2">
                {doorKeys.map((dk) => (
                  <div key={dk.key_id} className="p-3 bg-surface rounded-lg border border-secondary flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{dk.key_name}</div>
                      <div className="text-xs text-gray-500">{dk.display_name} (@{dk.username}) · 授权人: {dk.granted_by_name}</div>
                    </div>
                    <button onClick={() => handleUnbind(dk.key_id)} className="p-1.5 rounded hover:bg-danger/20 text-gray-400 hover:text-danger transition-colors" title="解绑">
                      <Unlink size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteDoor}
        title="删除门禁点"
        message={`确定要删除"${deleteDoor?.name}"吗？关联的时间表和密钥绑定也将被删除。`}
        onConfirm={handleDeleteDoor}
        onCancel={() => setDeleteDoor(null)}
      />
    </div>
  )
}
