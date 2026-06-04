import { useState, useMemo } from 'react';
import { Send, FileText, AlertCircle, Printer, Clock, List, ListOrdered, QrCode, Barcode, ChevronDown, Play, X } from 'lucide-react';
import { usePrinterStore } from '../store/printerStore';
import { useTemplates } from '../hooks/useTemplates';
import { usePrinting } from '../hooks/usePrinting';
import PrintPreview from '../components/PrintPreview';
import type { PrintQueueItem } from '../../shared/types';

export default function PrintPage() {
  const { printers, selectedPrinterId, selectedTemplate, setSelectedTemplate, setSelectedPrinter } = usePrinterStore();
  const { templates, fillTemplate } = useTemplates();
  const { print, enqueuePrint, cancelQueueJob, retryQueueJob, testPrint, printBarcode, isPrinting, progress, error: printError, printQueue, queueStats } = usePrinting();

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [copies, setCopies] = useState(1);
  const [printMode, setPrintMode] = useState<'instant' | 'queue'>('instant');

  const [showBarcodeTest, setShowBarcodeTest] = useState(false);
  const [barcodeContent, setBarcodeContent] = useState('1234567890128');
  const [barcodeType, setBarcodeType] = useState<'CODE-128' | 'EAN-13' | 'QR'>('CODE-128');

  const printerList = Array.from(printers.values());

  const selectedPrinter = useMemo(() => {
    if (!selectedPrinterId) return null;
    return printers.get(selectedPrinterId);
  }, [printers, selectedPrinterId]);

  const previewContent = useMemo(() => {
    if (!selectedTemplate) return '';
    return fillTemplate(selectedTemplate.content, formData);
  }, [selectedTemplate, formData, fillTemplate]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t._id === templateId);
    if (template) {
      setSelectedTemplate(template);
      const initialData: Record<string, any> = {};
      template.variables.forEach(v => {
        initialData[v.name] = v.defaultValue || '';
        if (v.type === 'date') {
          initialData[v.name] = new Date().toLocaleString('zh-CN');
        }
      });
      setFormData(initialData);
      setTemplateError(null);
    }
  };

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePrint = async () => {
    if (!selectedTemplate) {
      setTemplateError('请先选择打印模板');
      return;
    }

    const missingVars = selectedTemplate.variables
      .filter(v => v.required && (!formData[v.name] || formData[v.name] === ''))
      .map(v => v.label);

    if (missingVars.length > 0) {
      setTemplateError(`请填写必填字段: ${missingVars.join(', ')}`);
      return;
    }

    setTemplateError(null);

    if (printMode === 'instant') {
      try {
        await print(selectedTemplate, formData, selectedPrinterId);
      } catch (err) {
        console.error('Print error:', err);
      }
    } else {
      enqueuePrint(selectedTemplate, formData, selectedPrinterId, { copies });
    }
  };

  const handleTestPrint = async () => {
    try {
      await testPrint(selectedPrinterId);
    } catch (err) {
      console.error('Test print error:', err);
    }
  };

  const handlePrintBarcode = async () => {
    try {
      await printBarcode(barcodeContent, barcodeType, selectedPrinterId);
      setShowBarcodeTest(false);
    } catch (err) {
      console.error('Barcode print error:', err);
    }
  };

  const getStatusBadgeClass = (status: PrintQueueItem['status']) => {
    switch (status) {
      case 'queued': return 'bg-blue-100 text-blue-700';
      case 'printing': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusText = (status: PrintQueueItem['status']) => {
    switch (status) {
      case 'queued': return '排队中';
      case 'printing': return '打印中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return '未知';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">打印操作</h1>
          <p className="text-slate-500 mt-1">选择模板，填充数据，打印收据</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              showQueue
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="w-4 h-4" />
            打印队列
            {queueStats.queued > 0 && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {queueStats.queued}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowBarcodeTest(!showBarcodeTest)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            <Barcode className="w-4 h-4" />
            条码打印
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {showBarcodeTest && (
            <div className="bg-white rounded-2xl shadow-sm border-2 border-blue-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Barcode className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-800">条码/二维码测试打印</h2>
                </div>
                <button
                  onClick={() => setShowBarcodeTest(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    类型
                  </label>
                  <div className="flex gap-2">
                    {(['CODE-128', 'EAN-13', 'QR'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setBarcodeType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          barcodeType === type
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type === 'QR' ? <QrCode className="w-4 h-4 inline mr-1" /> : <Barcode className="w-4 h-4 inline mr-1" />}
                        {type === 'QR' ? '二维码' : type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    内容
                  </label>
                  <input
                    type="text"
                    value={barcodeContent}
                    onChange={(e) => setBarcodeContent(e.target.value)}
                    placeholder={barcodeType === 'EAN-13' ? '13位数字' : '输入内容'}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {barcodeType === 'EAN-13' ? 'EAN-13 需要13位数字' : barcodeType === 'QR' ? '二维码支持任意文本' : 'CODE-128 支持字母数字'}
                  </p>
                </div>

                <button
                  onClick={handlePrintBarcode}
                  disabled={!barcodeContent || !selectedPrinter?.status.connected}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                >
                  打印{barcodeType === 'QR' ? '二维码' : '条码'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Printer className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-800">选择打印机</h2>
            </div>

            {printerList.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Printer className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>暂无连接的打印机</p>
                <p className="text-sm">请前往「打印机管理」页面添加打印机</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {printerList.map(printer => (
                  <div
                    key={printer.id}
                    onClick={() => setSelectedPrinter(printer.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedPrinterId === printer.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      printer.status.connected ? 'bg-green-100' : 'bg-slate-100'
                    }`}>
                      <Printer className={`w-5 h-5 ${
                        printer.status.connected ? 'text-green-600' : 'text-slate-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">
                        {printer.alias || printer.device.productName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {printer.status.connected ? (
                          <span className="text-green-600">✅ 在线</span>
                        ) : (
                          <span className="text-red-600">❌ 离线</span>
                        )}
                        {printer.isDefault && <span className="ml-2 text-yellow-600">⭐ 默认</span>}
                      </p>
                    </div>
                    {printer.status.connected && !printer.status.paperOk && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">缺纸</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-800">选择模板</h2>
            </div>

            <select
              value={selectedTemplate?._id || ''}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="">请选择打印模板</option>
              {templates.map(template => (
                <option key={template._id} value={template._id}>
                  {template.name} - {template.width}mm
                </option>
              ))}
            </select>

            {selectedTemplate && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">{selectedTemplate.name}</span>: {selectedTemplate.description}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  包含 {selectedTemplate.variables.length} 个变量
                </p>
              </div>
            )}
          </div>

          {selectedTemplate && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">填充数据</h2>

              <div className="space-y-4">
                {selectedTemplate.variables.map(variable => (
                  <div key={variable.name}>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {variable.label}
                      {variable.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {variable.type === 'string' && (
                      <input
                        type="text"
                        value={formData[variable.name] || ''}
                        onChange={(e) => handleInputChange(variable.name, e.target.value)}
                        placeholder={`请输入${variable.label}`}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    )}

                    {variable.type === 'number' && (
                      <input
                        type="number"
                        value={formData[variable.name] || ''}
                        onChange={(e) => handleInputChange(variable.name, e.target.value)}
                        placeholder={`请输入${variable.label}`}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    )}

                    {variable.type === 'date' && (
                      <input
                        type="text"
                        value={formData[variable.name] || ''}
                        onChange={(e) => handleInputChange(variable.name, e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      />
                    )}

                    {variable.type === 'boolean' && (
                      <select
                        value={formData[variable.name] || 'false'}
                        onChange={(e) => handleInputChange(variable.name, e.target.value === 'true')}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      >
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">打印设置</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  打印方式
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPrintMode('instant')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      printMode === 'instant'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    立即打印
                  </button>
                  <button
                    onClick={() => setPrintMode('queue')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      printMode === 'queue'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    加入队列
                  </button>
                </div>
              </div>

              {printMode === 'queue' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    打印份数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={!selectedTemplate || isPrinting || !selectedPrinter?.status.connected}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300"
            >
              {isPrinting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  打印中 {progress}%
                </>
              ) : printMode === 'queue' ? (
                <>
                  <Clock className="w-5 h-5" />
                  加入队列
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  打印收据
                </>
              )}
            </button>

            <button
              onClick={handleTestPrint}
              disabled={!selectedPrinter?.status.connected || isPrinting}
              className="px-6 py-3.5 border-2 border-blue-600 text-blue-600 font-medium rounded-xl hover:bg-blue-50 disabled:border-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
            >
              测试打印
            </button>
          </div>

          {(templateError || printError) && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">错误</p>
                <p className="text-sm text-red-600">{templateError || printError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <PrintPreview content={previewContent} width={selectedTemplate?.width || 58} />

          {showQueue && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-800">打印队列</h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">排队 {queueStats.queued}</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">完成 {queueStats.completed}</span>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded">失败 {queueStats.failed}</span>
                </div>
              </div>

              {printQueue.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <ListOrdered className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p>打印队列为空</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {printQueue.map(item => (
                    <div
                      key={item.id}
                      className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClass(item.status)}`}>
                            {getStatusText(item.status)}
                          </span>
                          <span className="font-medium text-slate-800">{item.templateName}</span>
                        </div>
                        {item.copies > 1 && (
                          <span className="text-xs text-slate-500">× {item.copies}</span>
                        )}
                      </div>

                      <p className="text-sm text-slate-500 mb-2">
                        打印机: {item.printerName || '未指定'}
                      </p>

                      {item.status === 'failed' && item.errorMessage && (
                        <p className="text-sm text-red-600 mb-2">{item.errorMessage}</p>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                        {item.retries > 0 && <span>重试 {item.retries}/{item.maxRetries}</span>}
                      </div>

                      {item.status === 'failed' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => retryQueueJob(item.id)}
                            className="flex-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-all"
                          >
                            <Play className="w-4 h-4 inline mr-1" />
                            重试
                          </button>
                          <button
                            onClick={() => cancelQueueJob(item.id)}
                            className="flex-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-all"
                          >
                            <X className="w-4 h-4 inline mr-1" />
                            取消
                          </button>
                        </div>
                      )}

                      {item.status === 'queued' && (
                        <button
                          onClick={() => cancelQueueJob(item.id)}
                          className="w-full mt-3 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded transition-all"
                        >
                          <X className="w-4 h-4 inline mr-1" />
                          取消任务
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
