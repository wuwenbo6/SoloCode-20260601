import { useStore } from '@/hooks/useStore';
import { useParams } from 'react-router-dom';
import { exportTemplatesJSON } from '@/lib/api';
import { Download } from 'lucide-react';

export function TemplateTable() {
  const templates = useStore((s) => s.templates);
  const selectedTemplate = useStore((s) => s.selectedTemplate);
  const setSelectedTemplate = useStore((s) => s.setSelectedTemplate);
  const { sourceId } = useParams<{ sourceId: string }>();

  return (
    <div className="gradient-border p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">模板定义</h2>
        <button
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
          onClick={() => exportTemplatesJSON(Number(sourceId))}
          disabled={templates.length === 0}
        >
          <Download className="w-4 h-4" />
          导出 JSON
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/30">
              <th className="text-left px-5 py-3 text-slate-400 font-medium">模板 ID</th>
              <th className="text-left px-5 py-3 text-slate-400 font-medium">字段数</th>
              <th className="text-left px-5 py-3 text-slate-400 font-medium">企业字段</th>
              <th className="text-left px-5 py-3 text-slate-400 font-medium">最后刷新</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                  暂无模板数据
                </td>
              </tr>
            ) : (
              templates.map((tmpl) => {
                const enterpriseFields = tmpl.fields.filter((f) => f.isEnterprise).length;
                return (
                  <tr
                    key={tmpl.templateId}
                    className={`border-b border-slate-700/20 cursor-pointer transition-colors ${
                      selectedTemplate === tmpl.templateId
                        ? 'bg-cyan-950/40'
                        : 'hover:bg-cyan-950/20'
                    }`}
                    onClick={() =>
                      setSelectedTemplate(
                        selectedTemplate === tmpl.templateId ? null : tmpl.templateId
                      )
                    }
                  >
                    <td className="px-5 py-3">
                      <span className="font-mono text-amber-400">{tmpl.templateId}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded text-xs font-mono">
                        {tmpl.fieldCount}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {enterpriseFields > 0 ? (
                        <span className="bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded text-xs font-mono">
                          {enterpriseFields} 个
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(tmpl.lastRefresh).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedTemplate !== null && (
        <FieldDetailTable />
      )}
    </div>
  );
}

function FieldDetailTable() {
  const templates = useStore((s) => s.templates);
  const selectedTemplate = useStore((s) => s.selectedTemplate);

  const tmpl = templates.find((t) => t.templateId === selectedTemplate);
  if (!tmpl) return null;

  const ipFieldTypes = new Set([8, 12, 15, 18, 27, 28, 47, 62, 63, 225, 226, 281, 282]);
  const portFieldTypes = new Set([7, 11, 227, 228, 283, 284]);

  return (
    <div className="border-t border-slate-700/50">
      <div className="px-5 py-3 bg-slate-800/30">
        <h3 className="text-sm font-medium text-slate-300">
          模板 {selectedTemplate} 字段定义
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/30">
            <th className="text-left px-5 py-2 text-slate-400 font-medium">#</th>
            <th className="text-left px-5 py-2 text-slate-400 font-medium">类型编号</th>
            <th className="text-left px-5 py-2 text-slate-400 font-medium">类型名称</th>
            <th className="text-left px-5 py-2 text-slate-400 font-medium">企业编号</th>
            <th className="text-left px-5 py-2 text-slate-400 font-medium">长度</th>
          </tr>
        </thead>
        <tbody>
          {tmpl.fields.map((field, i) => {
            let badgeClass = 'bg-slate-500/20 text-slate-300';
            if (field.isEnterprise) badgeClass = 'bg-pink-500/20 text-pink-300';
            else if (ipFieldTypes.has(field.type)) badgeClass = 'bg-blue-500/20 text-blue-300';
            else if (portFieldTypes.has(field.type)) badgeClass = 'bg-emerald-500/20 text-emerald-300';
            else if (field.type === 4) badgeClass = 'bg-amber-500/20 text-amber-300';
            else if (field.type === 1 || field.type === 2) badgeClass = 'bg-purple-500/20 text-purple-300';

            return (
              <tr key={i} className="border-b border-slate-700/10">
                <td className="px-5 py-2 text-slate-500 font-mono">{i + 1}</td>
                <td className="px-5 py-2 font-mono text-slate-400">{field.type}</td>
                <td className="px-5 py-2">
                  <span className={`${badgeClass} px-2 py-0.5 rounded text-xs font-mono`}>
                    {field.typeName}
                  </span>
                </td>
                <td className="px-5 py-2">
                  {field.isEnterprise ? (
                    <span className="bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded text-xs font-mono">
                      PEN {field.enterpriseNumber}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">-</span>
                  )}
                </td>
                <td className="px-5 py-2 font-mono text-slate-400">{field.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
