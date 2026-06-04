import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navigation, Plus, Trash2, Edit2, X, Save, CircleDot } from 'lucide-react';

interface PathNode {
  id: number;
  name: string;
  x: number;
  y: number;
  floor: number;
}

interface PathEdge {
  id: number;
  from_node_id: number;
  to_node_id: number;
  weight: number;
}

export default function Paths() {
  const [nodes, setNodes] = useState<PathNode[]>([]);
  const [edges, setEdges] = useState<PathEdge[]>([]);
  const [mode, setMode] = useState<'nodes' | 'edges'>('nodes');
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [nodeForm, setNodeForm] = useState({ name: '', x: '', y: '', floor: '1' });
  const [editNodeForm, setEditNodeForm] = useState({ name: '', x: '', y: '', floor: '1' });
  const [edgeForm, setEdgeForm] = useState({ from_node_id: '', to_node_id: '', weight: '' });

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/path-nodes');
      const json = await res.json();
      if (json.success) setNodes(json.data);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  };

  const fetchEdges = async () => {
    try {
      const res = await fetch('/api/path-edges');
      const json = await res.json();
      if (json.success) setEdges(json.data);
    } catch (err) {
      console.error('Failed to fetch edges:', err);
    }
  };

  useEffect(() => {
    fetchNodes();
    fetchEdges();
  }, []);

  const handleAddNode = async () => {
    try {
      const res = await fetch('/api/path-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nodeForm.name,
          x: parseFloat(nodeForm.x),
          y: parseFloat(nodeForm.y),
          floor: parseInt(nodeForm.floor),
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchNodes();
        setShowAddNode(false);
        setNodeForm({ name: '', x: '', y: '', floor: '1' });
      }
    } catch (err) {
      console.error('Failed to add node:', err);
    }
  };

  const handleDeleteNode = async (id: number) => {
    try {
      await fetch(`/api/path-nodes/${id}`, { method: 'DELETE' });
      fetchNodes();
      fetchEdges();
    } catch (err) {
      console.error('Failed to delete node:', err);
    }
  };

  const startEditNode = (node: PathNode) => {
    setEditingNodeId(node.id);
    setEditNodeForm({
      name: node.name,
      x: node.x.toString(),
      y: node.y.toString(),
      floor: node.floor.toString(),
    });
  };

  const handleSaveNode = async (id: number) => {
    try {
      const res = await fetch(`/api/path-nodes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editNodeForm.name,
          x: parseFloat(editNodeForm.x),
          y: parseFloat(editNodeForm.y),
          floor: parseInt(editNodeForm.floor),
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchNodes();
        setEditingNodeId(null);
      }
    } catch (err) {
      console.error('Failed to update node:', err);
    }
  };

  const handleAddEdge = async () => {
    try {
      const res = await fetch('/api/path-edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_node_id: parseInt(edgeForm.from_node_id),
          to_node_id: parseInt(edgeForm.to_node_id),
          weight: parseFloat(edgeForm.weight),
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchEdges();
        setShowAddEdge(false);
        setEdgeForm({ from_node_id: '', to_node_id: '', weight: '' });
      }
    } catch (err) {
      console.error('Failed to add edge:', err);
    }
  };

  const handleDeleteEdge = async (id: number) => {
    try {
      await fetch(`/api/path-edges/${id}`, { method: 'DELETE' });
      fetchEdges();
    } catch (err) {
      console.error('Failed to delete edge:', err);
    }
  };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const getNodeName = (id: number) => nodeMap.get(id)?.name || `#${id}`;

  function MiniMap() {
    return (
      <div className="bg-[#0a1628] rounded-xl border border-[#1e3a5f] w-full h-full">
        <svg viewBox="0 0 600 500" className="w-full h-full">
          <rect width="600" height="500" fill="#0a1628" />
          {edges.map((edge) => {
            const from = nodeMap.get(edge.from_node_id);
            const to = nodeMap.get(edge.to_node_id);
            if (!from || !to) return null;
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#1e3a5f"
                strokeWidth="2"
              />
            );
          })}
          {nodes.map((node) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="10" fill="#00D4FF" />
              <text
                x={node.x}
                y={node.y - 16}
                textAnchor="middle"
                fill="#00D4FF"
                fontSize="12"
                fontFamily="'Noto Sans SC', sans-serif"
              >
                {node.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a1628] flex flex-col">
      <header className="h-14 bg-[#0d1f3c] border-b border-[#1e3a5f] flex items-center px-4 shrink-0">
        <h1 className="text-[#00D4FF] font-['Orbitron'] text-lg tracking-wider">IndoorNav</h1>
        <nav className="ml-8 flex gap-4">
          <Link to="/" className="text-gray-400 text-sm hover:text-white transition-colors">定位大厅</Link>
          <Link to="/beacons" className="text-gray-400 text-sm hover:text-white transition-colors">信标管理</Link>
          <Link to="/paths" className="text-[#00D4FF] text-sm hover:underline">路径编辑</Link>
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex flex-col bg-[#0a1628]/80 backdrop-blur-md border-r border-[#1e3a5f] overflow-y-auto">
          <div className="p-4 border-b border-[#1e3a5f]">
            <div className="flex items-center gap-2 mb-4">
              <Navigation className="w-5 h-5 text-[#00D4FF]" />
              <h2 className="text-[#00D4FF] font-bold text-base">路径图编辑</h2>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode('nodes')}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                  mode === 'nodes'
                    ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10'
                    : 'border-[#1e3a5f] text-gray-400 hover:border-[#00D4FF]/50'
                }`}
              >
                <CircleDot className="w-3 h-3 inline mr-1" />
                节点
              </button>
              <button
                onClick={() => setMode('edges')}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                  mode === 'edges'
                    ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/10'
                    : 'border-[#1e3a5f] text-gray-400 hover:border-[#00D4FF]/50'
                }`}
              >
                <Navigation className="w-3 h-3 inline mr-1" />
                连线
              </button>
            </div>

            {mode === 'nodes' && (
              <button
                onClick={() => setShowAddNode(true)}
                className="w-full py-2 bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] rounded-lg text-sm font-medium hover:bg-[#00D4FF]/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                添加节点
              </button>
            )}

            {mode === 'edges' && (
              <button
                onClick={() => setShowAddEdge(true)}
                className="w-full py-2 bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] rounded-lg text-sm font-medium hover:bg-[#00D4FF]/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                添加连线
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {mode === 'nodes' && (
              <div className="space-y-2">
                {nodes.map((node) => (
                  <div key={node.id} className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg p-3">
                    {editingNodeId === node.id ? (
                      <div className="space-y-2">
                        <input
                          value={editNodeForm.name}
                          onChange={(e) => setEditNodeForm({ ...editNodeForm, name: e.target.value })}
                          className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs"
                          placeholder="名称"
                        />
                        <div className="flex gap-2">
                          <input
                            value={editNodeForm.x}
                            onChange={(e) => setEditNodeForm({ ...editNodeForm, x: e.target.value })}
                            className="flex-1 bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs"
                            placeholder="X"
                          />
                          <input
                            value={editNodeForm.y}
                            onChange={(e) => setEditNodeForm({ ...editNodeForm, y: e.target.value })}
                            className="flex-1 bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-xs"
                            placeholder="Y"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleSaveNode(node.id)} className="p-1 text-[#00D4FF]">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingNodeId(null)} className="p-1 text-gray-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white font-medium">{node.name}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            ({node.x}, {node.y}) · {node.floor}F
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEditNode(node)} className="p-1.5 text-[#00D4FF] hover:text-[#00D4FF]/80">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteNode(node.id)} className="p-1.5 text-[#FF6B35] hover:text-[#FF6B35]/80">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {nodes.length === 0 && (
                  <div className="text-center text-gray-500 text-xs py-8">暂无节点数据</div>
                )}
              </div>
            )}

            {mode === 'edges' && (
              <div className="space-y-2">
                {edges.map((edge) => (
                  <div key={edge.id} className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white">
                          <span className="text-[#00D4FF]">{getNodeName(edge.from_node_id)}</span>
                          <span className="text-gray-500 mx-1">→</span>
                          <span className="text-[#00D4FF]">{getNodeName(edge.to_node_id)}</span>
                        </div>
                        <div className="text-xs text-gray-500">权重: {edge.weight}</div>
                      </div>
                      <button onClick={() => handleDeleteEdge(edge.id)} className="p-1.5 text-[#FF6B35] hover:text-[#FF6B35]/80">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {edges.length === 0 && (
                  <div className="text-center text-gray-500 text-xs py-8">暂无连线数据</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-4">
          <MiniMap />
        </div>
      </div>

      {showAddNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">添加节点</h3>
              <button onClick={() => setShowAddNode(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">名称</label>
                <input
                  value={nodeForm.name}
                  onChange={(e) => setNodeForm({ ...nodeForm, name: e.target.value })}
                  placeholder="节点名称"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">X坐标</label>
                  <input
                    type="number"
                    value={nodeForm.x}
                    onChange={(e) => setNodeForm({ ...nodeForm, x: e.target.value })}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Y坐标</label>
                  <input
                    type="number"
                    value={nodeForm.y}
                    onChange={(e) => setNodeForm({ ...nodeForm, y: e.target.value })}
                    className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">楼层</label>
                <input
                  type="number"
                  value={nodeForm.floor}
                  onChange={(e) => setNodeForm({ ...nodeForm, floor: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowAddNode(false)}
                className="px-4 py-2 border border-[#1e3a5f] text-gray-400 rounded-lg text-sm hover:bg-[#1e3a5f]/30 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddNode}
                className="px-4 py-2 bg-[#00D4FF] text-[#0a1628] rounded-lg font-medium text-sm hover:bg-[#00D4FF]/90 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddEdge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0d1f3c] border border-[#1e3a5f] rounded-xl p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">添加连线</h3>
              <button onClick={() => setShowAddEdge(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">起始节点</label>
                <select
                  value={edgeForm.from_node_id}
                  onChange={(e) => setEdgeForm({ ...edgeForm, from_node_id: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                >
                  <option value="">选择节点</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">结束节点</label>
                <select
                  value={edgeForm.to_node_id}
                  onChange={(e) => setEdgeForm({ ...edgeForm, to_node_id: e.target.value })}
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                >
                  <option value="">选择节点</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">权重 (距离)</label>
                <input
                  type="number"
                  value={edgeForm.weight}
                  onChange={(e) => setEdgeForm({ ...edgeForm, weight: e.target.value })}
                  placeholder="200"
                  className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:border-[#00D4FF] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowAddEdge(false)}
                className="px-4 py-2 border border-[#1e3a5f] text-gray-400 rounded-lg text-sm hover:bg-[#1e3a5f]/30 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddEdge}
                className="px-4 py-2 bg-[#00D4FF] text-[#0a1628] rounded-lg font-medium text-sm hover:bg-[#00D4FF]/90 transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
