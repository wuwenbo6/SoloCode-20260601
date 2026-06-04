import { useState, useEffect } from 'react'
import { Key, Plus, Trash2, RefreshCw } from 'lucide-react'
import KeyRegisterDialog from '@/components/KeyRegisterDialog'
import ConfirmDialog from '@/components/ConfirmDialog'

interface KeyItem {
  id: string
  name: string
  credentialId: string
  username: string
  createdAt: string
  lastUsed: string | null
}

export default function Keys() {
  const [keys, setKeys] = useState<KeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KeyItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchKeys = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/keys')
      const data = await res.json()
      setKeys(data.keys || data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  useEffect(() => {
    if (!registerOpen) fetchKeys()
  }, [registerOpen])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/keys/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      fetchKeys()
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Key size={22} className="text-accent" />
          密钥管理
        </h1>
        <div className="flex gap-2">
          <button
            onClick={fetchKeys}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-gray-300 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setRegisterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-primary font-bold hover:bg-accent/90 transition-colors"
          >
            <Plus size={16} />
            注册新密钥
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-accent" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-20 text-gray-500">暂无密钥数据</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-secondary">
          <table className="w-full">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">密钥名称</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">凭证ID</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">绑定用户</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">创建时间</th>
                <th className="text-left px-4 py-3 text-sm text-gray-400 font-medium">最后使用</th>
                <th className="text-right px-4 py-3 text-sm text-gray-400 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-secondary hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-white">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-[200px] truncate">{key.credentialId}</td>
                  <td className="px-4 py-3 text-gray-300">{key.username}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{key.createdAt}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{key.lastUsed || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDeleteTarget(key)}
                      className="p-1.5 rounded hover:bg-danger/20 text-gray-400 hover:text-danger transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <KeyRegisterDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除密钥"
        message={`确定要删除密钥"${deleteTarget?.name}"吗？此操作不可撤销。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <RefreshCw size={24} className="animate-spin text-accent" />
        </div>
      )}
    </div>
  )
}
