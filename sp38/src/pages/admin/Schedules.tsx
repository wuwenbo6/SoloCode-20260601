import { useState, useEffect } from 'react'
import { Clock, Plus, Trash2, RefreshCw, Power, PowerOff } from 'lucide-react'

interface Schedule {
  id: string
  door_id: string
  day_of_week: number
  dayName: string
  start_time: string
  end_time: string
  enabled: number
}

interface Door {
  id: string
  name: string
  location: string
}

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function Schedules() {
  const [doors, setDoors] = useState<Door[]>([])
  const [selectedDoor, setSelectedDoor] = useState('')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' })

  useEffect(() => {
    fetch('/api/doors').then((r) => r.json()).then((d) => {
      setDoors(d.doors || [])
      if (d.doors?.length > 0 && !selectedDoor) {
        setSelectedDoor(d.doors[0].id)
      }
    }).catch(() => {})
  }, [])

  const fetchSchedules = async () => {
    if (!selectedDoor) return
    setLoading(true)
    try {
      const res = await fetch(`/api/schedules/${selectedDoor}`)
      const data = await res.json()
      setSchedules(data.schedules || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchedules() }, [selectedDoor])

  const handleAdd = async () => {
    try {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doorId: selectedDoor, dayOfWeek: form.dayOfWeek, startTime: form.startTime, endTime: form.endTime }),
      })
      setShowAdd(false)
      fetchSchedules()
    } catch {
      // ignore
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      })
      fetchSchedules()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      fetchSchedules()
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock size={22} className="text-accent" />
          门禁时间表
        </h1>
        <div className="flex gap-2">
          <button onClick={fetchSchedules} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowAdd(true)} disabled={!selectedDoor} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Plus size={16} />
            添加时段
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">选择门禁点</label>
        <select value={selectedDoor} onChange={(e) => setSelectedDoor(e.target.value)} className="px-4 py-2 bg-surface border border-secondary rounded-lg text-white focus:outline-none focus:border-accent">
          {doors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.location}</option>)}
        </select>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 bg-surface rounded-xl border border-secondary">
          <h3 className="text-white font-bold mb-3">添加允许时段</h3>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">星期</label>
              <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })} className="px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent">
                {dayNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">开始时间</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">结束时间</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="px-3 py-2 bg-primary border border-secondary rounded-lg text-white focus:outline-none focus:border-accent" />
            </div>
            <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 transition-colors">确认添加</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg bg-secondary text-gray-300 hover:bg-secondary/80 transition-colors">取消</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw size={24} className="animate-spin text-accent" /></div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p>该门禁点暂无时间表</p>
          <p className="text-xs mt-1">无时间表时，门禁全天允许通行</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-secondary">
          <table className="w-full">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">星期</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">开始时间</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">结束时间</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">状态</th>
                <th className="text-right px-4 py-3 text-sm text-gray-400 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className={`border-t border-secondary transition-colors ${s.enabled ? 'hover:bg-secondary/30' : 'opacity-50'}`}>
                  <td className="px-4 py-3 text-white font-medium">{s.dayName}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">{s.start_time}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">{s.end_time}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.enabled ? 'bg-accent/10 text-accent' : 'bg-secondary text-gray-400'}`}>
                      {s.enabled ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                    <button onClick={() => handleToggle(s.id, !!s.enabled)} className={`p-1.5 rounded transition-colors ${s.enabled ? 'hover:bg-danger/20 text-gray-400 hover:text-danger' : 'hover:bg-accent/20 text-gray-400 hover:text-accent'}`}>
                      {s.enabled ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-danger/20 text-gray-400 hover:text-danger transition-colors">
                      <Trash2 size={16} />
                    </button>
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
