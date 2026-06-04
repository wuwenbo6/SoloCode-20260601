import { useState, useEffect } from 'react'
import { FileText, RefreshCw, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

interface AccessLog {
  id: string
  user_name: string | null
  key_name: string | null
  door_name: string | null
  door_id: string
  method: string
  latitude: number | null
  longitude: number | null
  success: number
  operator_type: string
  operator_name: string
  created_at: string
}

interface Door {
  id: string
  name: string
}

export default function Logs() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [doors, setDoors] = useState<Door[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [filterMethod, setFilterMethod] = useState('')
  const [filterDoor, setFilterDoor] = useState('')
  const [filterSuccess, setFilterSuccess] = useState('')

  useEffect(() => {
    fetch('/api/doors')
      .then((r) => r.json())
      .then((data) => setDoors(data.doors || []))
      .catch(() => {})
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (filterMethod) params.set('method', filterMethod)
      if (filterDoor) params.set('doorId', filterDoor)
      if (filterSuccess !== '') params.set('success', filterSuccess)
      const res = await fetch(`/api/logs?${params}`)
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, filterMethod, filterDoor, filterSuccess])

  const totalPages = Math.ceil(total / pageSize)

  const methodLabel = (m: string) => {
    switch (m) {
      case 'webauthn': return '密钥'
      case 'nfc': return 'NFC'
      case 'remote': return '远程'
      case 'visitor': return '访客'
      default: return m
    }
  }

  const methodColor = (m: string) => {
    switch (m) {
      case 'webauthn': return 'text-info bg-info/10'
      case 'nfc': return 'text-accent bg-accent/10'
      case 'remote': return 'text-purple-400 bg-purple-400/10'
      case 'visitor': return 'text-cyan-400 bg-cyan-400/10'
      default: return 'text-gray-400 bg-secondary'
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText size={22} className="text-accent" />
          门禁日志
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters ? 'bg-accent/20 text-accent' : 'bg-secondary hover:bg-secondary/80 text-gray-300'
            }`}
          >
            <Filter size={16} />
            筛选
          </button>
          <button
            onClick={fetchLogs}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 p-4 bg-surface rounded-lg border border-secondary flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">认证方式</label>
            <select
              value={filterMethod}
              onChange={(e) => { setFilterMethod(e.target.value); setPage(1) }}
              className="px-3 py-1.5 bg-primary border border-secondary rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            >
              <option value="">全部</option>
              <option value="webauthn">密钥</option>
              <option value="nfc">NFC</option>
              <option value="remote">远程</option>
              <option value="visitor">访客</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">门禁点</label>
            <select
              value={filterDoor}
              onChange={(e) => { setFilterDoor(e.target.value); setPage(1) }}
              className="px-3 py-1.5 bg-primary border border-secondary rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            >
              <option value="">全部</option>
              {doors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">结果</label>
            <select
              value={filterSuccess}
              onChange={(e) => { setFilterSuccess(e.target.value); setPage(1) }}
              className="px-3 py-1.5 bg-primary border border-secondary rounded-lg text-white text-sm focus:outline-none focus:border-accent"
            >
              <option value="">全部</option>
              <option value="1">成功</option>
              <option value="0">失败</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-accent" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">暂无日志记录</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-secondary">
            <table className="w-full">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">时间</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">用户</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">密钥</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">门禁点</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">方式</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">GPS</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">结果</th>
                  <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">操作类型</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-secondary hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{log.created_at}</td>
                    <td className="px-4 py-3 text-gray-300">{log.user_name || log.operator_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{log.key_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{log.door_name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${methodColor(log.method)}`}>
                        {methodLabel(log.method)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {log.latitude != null ? `${log.latitude.toFixed(4)}, ${log.longitude?.toFixed(4)}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold ${log.success ? 'text-accent' : 'text-danger'}`}>
                        {log.success ? '通过' : '拒绝'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${log.operator_type === 'admin' ? 'text-purple-400' : 'text-gray-400'}`}>
                        {log.operator_type === 'admin' ? '管理员' : '用户'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm">
            <span className="text-gray-400">
              共 {total} 条记录
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-secondary text-gray-300 hover:bg-secondary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-gray-400 min-w-[80px] text-center">
                {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg bg-secondary text-gray-300 hover:bg-secondary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
