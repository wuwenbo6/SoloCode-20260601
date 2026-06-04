import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Plus, Trash2, Edit2, X, Save } from 'lucide-react';

interface Beacon {
  id: number;
  uuid: string;
  name: string;
  x: number;
  y: number;
  floor: number;
  tx_power: number;
  path_loss_exp: number;
}

export default function Beacons() {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    uuid: '',
    name: '',
    x: '',
    y: '',
    floor: '1',
    tx_power: '-59',
    path_loss_exp: '2.0',
  });
  const [editData, setEditData] = useState({
    uuid: '',
    name: '',
    x: '',
    y: '',
    floor: '1',
    tx_power: '-59',
    path_loss_exp: '2.0',
  });

  const fetchBeacons = async () => {
    try {
      const res = await fetch('/api/beacons');
      const json = await res.json();
      if (json.success) setBeacons(json.data);
    } catch (err) {
      console.error('Failed to fetch beacons:', err);
    }
  };

  useEffect(() => {
    fetchBeacons();
  }, []);

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/beacons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: formData.uuid,
          name: formData.name,
          x: parseFloat(formData.x),
          y: parseFloat(formData.y),
          floor: parseInt(formData.floor),
          tx_power: parseFloat(formData.tx_power),
          path_loss_exp: parseFloat(formData.path_loss_exp),
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchBeacons();
        setShowAddModal(false);
        setFormData({ uuid: '', name: '', x: '', y: '', floor: '1', tx_power: '-59', path_loss_exp: '2.0' });
      }
    } catch (err) {
      console.error('Failed to add beacon:', err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/beacons/${id}`, { method: 'DELETE' });
      fetchBeacons();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete beacon:', err);
    }
  };

  const startEdit = (beacon: Beacon) => {
    setEditingId(beacon.id);
    setEditData({
      uuid: beacon.uuid,
      name: beacon.name,
      x: beacon.x.toString(),
      y: beacon.y.toString(),
      floor: beacon.floor.toString(),
      tx_power: beacon.tx_power.toString(),
      path_loss_exp: beacon.path_loss_exp.toString(),
    });
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const res = await fetch(`/api/beacons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid: editData.uuid,
          name: editData.name,
          x: parseFloat(editData.x),
          y: parseFloat(editData.y),
          floor: parseInt(editData.floor),
          tx_power: parseFloat(editData.tx_power),
          path_loss_exp: parseFloat(editData.path_loss_exp),
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchBeacons();
        setEditingId(null);
      }
    } catch (err) {
      console.error('Failed to update beacon:', err);
    }
  };

  return (
    <div className="h-screen bg-[#0a1628] flex flex-col">
      <header className="h-14 bg-[#0d1f3c] border-b border-[#1e3a5f] flex items-center px-4 shrink-0">
        <h1 className="text-[#00D4FF] font-['Orbitron'] text-lg tracking-wider">IndoorNav</h1>
        <nav className="ml-8 flex gap-4">
          <Link to="/" className="text-gray-400 text-sm hover:text-white transition-colors">定位大厅</Link>
          <Link to="/beacons" className="text-[#00D4FF] text-sm hover:underline">信标管理</Link>
          <Link to="/paths" className="text-gray-400 text-sm hover:text-white transition-colors">路径编辑</Link>
        </nav>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#00D4FF]" />
            <h2 className="text-xl font-bold text-white">信标管理</h2>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00D4FF] text-[#0a1628] rounded-lg font-medium text-sm hover:bg-[#00D4FF]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加信标
          </button>
        </div>

        <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a1628]">
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">ID</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">UUID</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">名称</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">X坐标</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">Y坐标</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">楼层</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">发射功率</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">路径损耗</th>
                <th className="text-left py-3 px-4 text-[#00D4FF] font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {beacons.map((beacon) => (
                <tr key={beacon.id} className="border-t border-[#1e3a5f] hover:bg-[#0a1628]/50">
                  {editingId === beacon.id ? (
                    <>
                      <td className="py-3 px-4 text-gray-400">{beacon.id}</td>
                      <td className="py-3 px-4">
                        <input
                          value={editData.uuid}
                          onChange={(e) => setEditData({ ...editData, uuid: e.target.value })}
                          className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs focus:border-[#00D4FF] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs focus:border-[#00D4FF] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          value={editData.x}
                          onChange={(e) => setEditData({ ...editData, x: e.target.value })}
                          className="w-20 bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs focus:border-[#00D4FF] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          value={editData.y}
                          onChange={(e) => setEditData({ ...editData, y: e.target.value })}
                          className="w-20 bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs focus:border-[#00D4FF] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          value={editData.floor}
                          onChange={(e) => setEditData({ ...editData, floor: e.target.value })}
                          className="w-16 bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs focus:border-[#00D4FF] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          value={editData.tx_power}
                          onChange={(e) => setEditData({ ...editData, tx_power: e.target.value })}
                          className="w-16 bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs focus:border-[#00D4FF] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          value={editData.path_loss_exp}
                          onChange={(e) => setEditData({ ...editData, path_loss_exp: e.target.value })}
                          className="w-16 bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs focus:border-[#00D4FF] focus:outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 flex items-center gap-2">
                        <button onClick={() => handleSaveEdit(beacon.id)} className="p-1 text-[#00D4FF] hover:text-[#00D4FF]/80">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-gray-500 hover:text-gray-400">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 text-gray-400">{beacon.id}</td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-300">{beacon.uuid}</td>
                      <td className="py-3 px-4 text-white">{beacon.name}</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{beacon.x}</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{beacon.y}</td>
                      <td className="py-3 px-4 text-gray-300">{beacon.floor}F</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{beacon.tx_power}</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{beacon.path_loss_exp}</td>
                      <td className="py-3 px-4 flex items-center gap-2">
                        <button onClick={() => startEdit(beacon)} className="p-1 text-[#00D4FF] hover:text-[#00D4FF]/80">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(beacon.id)} className="p-1 text-[#FF6B35] hover:text-[#FF6B35]/80">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {beacons.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    暂无信标数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-[480px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">添加信标</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">UUID</label>
                <input
                  value={formData.uuid}
                  onChange={(e) => setFormData({ ...formData, uuid: e.target.value })}
                  placeholder="如: AA-BB-CC-DD-EE-01"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">名称</label>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="信标名称"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">X坐标</label>
                  <input
                    type="number"
                    value={formData.x}
                    onChange={(e) => setFormData({ ...formData, x: e.target.value })}
                    placeholder="100"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Y坐标</label>
                  <input
                    type="number"
                    value={formData.y}
                    onChange={(e) => setFormData({ ...formData, y: e.target.value })}
                    placeholder="100"
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">楼层</label>
                  <input
                    type="number"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">发射功率</label>
                  <input
                    type="number"
                    value={formData.tx_power}
                    onChange={(e) => setFormData({ ...formData, tx_power: e.target.value })}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">路径损耗指数</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.path_loss_exp}
                    onChange={(e) => setFormData({ ...formData, path_loss_exp: e.target.value })}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-[#1e3a5f] text-gray-400 rounded-lg text-sm hover:bg-[#1e3a5f]/30 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-[#00D4FF] text-[#0a1628] rounded-lg font-medium text-sm hover:bg-[#00D4FF]/90 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-80">
            <h3 className="text-lg font-bold text-white mb-2">确认删除</h3>
            <p className="text-gray-400 text-sm mb-6">确定要删除此信标吗？此操作无法撤销。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-[#1e3a5f] text-gray-400 rounded-lg text-sm hover:bg-[#1e3a5f]/30 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-[#FF6B35] text-white rounded-lg font-medium text-sm hover:bg-[#FF6B35]/90 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
