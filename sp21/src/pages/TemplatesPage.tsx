import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, FileText, Search } from 'lucide-react';
import { useTemplates } from '../hooks/useTemplates';

export default function TemplatesPage() {
  const { templates, loading, error, deleteTemplate } = useTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const getPreviewText = (content: string) => {
    const lines = content.split('\n').slice(0, 5);
    return lines.join('\n');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">模板管理</h1>
          <p className="text-slate-500 mt-1">创建和管理打印模板</p>
        </div>
        <Link
          to="/templates/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <Plus className="w-5 h-5" />
          新建模板
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-20 bg-slate-100 rounded-lg mb-4" />
              <div className="flex gap-2">
                <div className="h-9 bg-slate-200 rounded-lg flex-1" />
                <div className="h-9 bg-slate-200 rounded-lg flex-1" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">
            {searchQuery ? '未找到匹配的模板' : '暂无打印模板'}
          </h3>
          <p className="text-slate-500 mb-6">
            {searchQuery ? '尝试使用其他关键词搜索' : '点击上方按钮创建第一个打印模板'}
          </p>
          {!searchQuery && (
            <Link
              to="/templates/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              创建模板
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div
              key={template._id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all overflow-hidden group"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{template.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{template.description}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                    {template.width}mm
                  </span>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 mb-4 font-mono text-xs text-slate-600 whitespace-pre-line overflow-hidden" style={{ maxHeight: '120px' }}>
                  {getPreviewText(template.content)}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {template.variables.slice(0, 5).map(v => (
                    <span
                      key={v.name}
                      className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full"
                    >
                      {`{${v.name}}`}
                    </span>
                  ))}
                  {template.variables.length > 5 && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                      +{template.variables.length - 5}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/templates/${template._id}/edit`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                    编辑
                  </Link>
                  
                  {deleteConfirm === template._id ? (
                    <div className="flex-1 flex gap-1">
                      <button
                        onClick={() => handleDelete(template._id)}
                        className="flex-1 px-2 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-all"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 px-2 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-300 transition-all"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(template._id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除
                    </button>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                创建于 {new Date(template.createdAt).toLocaleDateString('zh-CN')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
