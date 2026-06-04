import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Trash2, Eye, Code, Variable } from 'lucide-react';
import { useTemplates } from '../hooks/useTemplates';
import type { TemplateVariable } from '../../shared/types';
import PrintPreview from '../components/PrintPreview';

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  
  const { createTemplate, updateTemplate, fetchTemplateById, extractVariables, loading, error } = useTemplates();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [width, setWidth] = useState<58 | 80>(58);
  const [showPreview, setShowPreview] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && id) {
      loadTemplate(id);
    }
  }, [id, isNew]);

  const loadTemplate = async (templateId: string) => {
    try {
      const template = await fetchTemplateById(templateId);
      setName(template.name);
      setDescription(template.description);
      setContent(template.content);
      setVariables(template.variables);
      setWidth(template.width as 58 | 80);
    } catch (err) {
      console.error('Load template error:', err);
    }
  };

  useEffect(() => {
    if (content) {
      const extracted = extractVariables(content);
      setVariables(prev => {
        const merged = [...extracted];
        prev.forEach(v => {
          const existing = merged.find(e => e.name === v.name);
          if (existing) {
            existing.label = v.label;
            existing.type = v.type;
            existing.required = v.required;
            existing.defaultValue = v.defaultValue;
          }
        });
        return merged;
      });
    }
  }, [content, extractVariables]);

  const handleVariableChange = (index: number, field: keyof TemplateVariable, value: any) => {
    setVariables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addVariable = () => {
    const name = prompt('请输入变量名称（不含大括号）:');
    if (name && !variables.find(v => v.name === name)) {
      setVariables(prev => [...prev, {
        name,
        label: name,
        type: 'string',
        required: true,
        defaultValue: ''
      }]);
      setContent(prev => prev + `\n{${name}}`);
    }
  };

  const removeVariable = (index: number) => {
    const varName = variables[index].name;
    setVariables(prev => prev.filter((_, i) => i !== index));
    setContent(prev => prev.replace(new RegExp(`\\{${varName}\\}`, 'g'), ''));
  };

  const insertVariable = (varName: string) => {
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = content.substring(0, start) + `{${varName}}` + content.substring(end);
      setContent(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + varName.length + 2, start + varName.length + 2);
      }, 0);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setSaveError('请输入模板名称');
      return;
    }
    if (!content.trim()) {
      setSaveError('请输入模板内容');
      return;
    }

    setSaveError(null);

    try {
      if (isNew) {
        await createTemplate({ name, description, content, variables, width });
      } else if (id) {
        await updateTemplate(id, { name, description, content, variables, width });
      }
      navigate('/templates');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败');
    }
  };

  const previewContent = useMemo(() => {
    const sampleData: Record<string, any> = {};
    variables.forEach(v => {
      switch (v.type) {
        case 'string':
          sampleData[v.name] = v.defaultValue || `[${v.label}]`;
          break;
        case 'number':
          sampleData[v.name] = v.defaultValue || '0.00';
          break;
        case 'date':
          sampleData[v.name] = new Date().toLocaleString('zh-CN');
          break;
        case 'boolean':
          sampleData[v.name] = v.defaultValue || '否';
          break;
      }
    });

    let result = content;
    const regex = /\{([^}]+)\}/g;
    result = result.replace(regex, (match, key) => {
      return sampleData[key.trim()] || match;
    });

    return result;
  }, [content, variables]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/templates"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isNew ? '新建模板' : '编辑模板'}
            </h1>
            <p className="text-slate-500 mt-1">
              {isNew ? '创建新的打印模板' : '修改现有打印模板'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showPreview ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            预览
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
          >
            <Save className="w-5 h-5" />
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {(error || saveError) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error || saveError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">基本信息</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  模板名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入模板名称"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="请输入模板描述"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  纸张宽度
                </label>
                <select
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) as 58 | 80)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value={58}>58mm (小票打印机)</option>
                  <option value={80}>80mm (标准打印机)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-800">模板内容</h2>
              </div>
              <button
                onClick={addVariable}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加变量
              </button>
            </div>

            <textarea
              name="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`例如：
{店名}
{地址}
----------------
商品名称      金额
{商品列表}
----------------
合计: {合计金额}
谢谢惠顾！`}
              rows={15}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none bg-slate-900 text-slate-100"
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-slate-500">
              使用 {'{变量名}'} 格式定义变量，例如 {'{店名}'}、{'{金额}'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Variable className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-800">变量定义</h2>
            </div>

            {variables.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Variable className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p>暂无变量定义</p>
                <p className="text-sm">在模板内容中输入 {'{变量名}'} 自动添加</p>
              </div>
            ) : (
              <div className="space-y-3">
                {variables.map((variable, index) => (
                  <div
                    key={variable.name}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 font-mono text-sm rounded">
                      {`{${variable.name}}`}
                    </span>
                    
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={variable.label}
                        onChange={(e) => handleVariableChange(index, 'label', e.target.value)}
                        placeholder="标签"
                        className="px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <select
                        value={variable.type}
                        onChange={(e) => handleVariableChange(index, 'type', e.target.value)}
                        className="px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="string">字符串</option>
                        <option value="number">数字</option>
                        <option value="date">日期</option>
                        <option value="boolean">布尔</option>
                      </select>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={variable.required}
                          onChange={(e) => handleVariableChange(index, 'required', e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        必填
                      </label>
                      <input
                        type="text"
                        value={variable.defaultValue || ''}
                        onChange={(e) => handleVariableChange(index, 'defaultValue', e.target.value)}
                        placeholder="默认值"
                        className="px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={() => insertVariable(variable.name)}
                      className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      插入
                    </button>
                    <button
                      onClick={() => removeVariable(index)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showPreview && (
          <div>
            <PrintPreview content={previewContent} width={width} />
          </div>
        )}
      </div>
    </div>
  );
}
