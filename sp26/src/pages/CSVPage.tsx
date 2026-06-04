import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { csvService } from '@/services/csvService';
import { AssetStatusLabels } from '../../shared/types';
import type { CreateAssetRequest } from '../../shared/types';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  successItems: string[];
  failedItems: Array<{ row: number; error: string; data: unknown }>;
}

export default function CSVPage() {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setImportResult(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = csvService.parseCSV(text);
      setPreviewData(rows.slice(0, 10));
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        alert('请上传CSV文件');
      }
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const handleImport = async () => {
    if (previewData.length === 0) {
      alert('请先选择CSV文件');
      return;
    }

    setImporting(true);
    try {
      const assetData = csvService.mapToAssetData(previewData);
      const result = await csvService.importAssets(assetData as Omit<CreateAssetRequest, 'uid'>[]);
      setImportResult(result);
    } catch (error) {
      console.error('Import failed:', error);
      alert('导入失败，请检查数据格式');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await csvService.exportAssets();
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    csvService.downloadTemplate();
  };

  const resetImport = () => {
    setPreviewData([]);
    setImportResult(null);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">批量导入导出</h1>
        <p className="text-gray-600">通过CSV文件批量管理资产数据</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => { setActiveTab('import'); resetImport(); }}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'import'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-5 h-5 inline mr-2" />
              批量导入
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                activeTab === 'export'
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Download className="w-5 h-5 inline mr-2" />
              批量导出
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'import' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">导入资产数据</h2>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center px-4 py-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  下载导入模板
                </button>
              </div>

              {!importResult && (
                <>
                  <div
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                      dragActive
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-primary-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    
                    {previewData.length > 0 ? (
                      <div>
                        <FileSpreadsheet className="w-12 h-12 mx-auto text-green-500 mb-4" />
                        <p className="text-lg font-medium text-gray-900">{fileName}</p>
                        <p className="text-sm text-gray-500 mt-1">预览 {previewData.length} 条记录</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-lg font-medium text-gray-900">拖拽CSV文件到此处</p>
                        <p className="text-sm text-gray-500 mt-1">或点击选择文件</p>
                        <p className="text-xs text-gray-400 mt-2">仅支持 .csv 格式文件</p>
                      </div>
                    )}
                  </div>

                  {previewData.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">数据预览（前10行）</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                {Object.keys(previewData[0]).map((key) => (
                                  <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.map((row, index) => (
                                <tr key={index} className="border-b border-gray-100">
                                  {Object.values(row).map((value, vIndex) => (
                                    <td key={vIndex} className="px-3 py-2 text-gray-700">
                                      {value || '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex">
                          <HelpCircle className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-700">
                            <p className="font-medium">状态值说明</p>
                            <p className="mt-1">支持中文状态值：{Object.entries(AssetStatusLabels).map(([_, label]) => label).join('、')}</p>
                            <p className="mt-1">也支持英文代码：in_use、idle、maintenance、scrapped</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <button
                          onClick={resetImport}
                          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          重新选择
                        </button>
                        <button
                          onClick={handleImport}
                          disabled={importing}
                          className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                        >
                          {importing ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              导入中...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              确认导入
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}

              {importResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-xl p-6 text-center">
                      <FileText className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                      <p className="text-2xl font-bold text-gray-900">{importResult.total}</p>
                      <p className="text-sm text-gray-500">总记录数</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-6 text-center">
                      <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2" />
                      <p className="text-2xl font-bold text-green-700">{importResult.success}</p>
                      <p className="text-sm text-green-600">成功</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-6 text-center">
                      <XCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                      <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                      <p className="text-sm text-red-600">失败</p>
                    </div>
                  </div>

                  {importResult.failedItems.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <h3 className="font-medium text-red-800 mb-3">失败记录详情</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {importResult.failedItems.map((item, index) => (
                          <div key={index} className="flex items-start p-2 bg-white rounded-lg">
                            <AlertCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              <span className="font-medium text-red-700">第 {item.row} 行：</span>
                              <span className="text-red-600">{item.error}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={resetImport}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      继续导入
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">导出资产数据</h2>
              
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">导出全部资产数据</p>
                <p className="text-sm text-gray-500 mb-6">导出为CSV格式，包含所有资产信息</p>
                
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {exporting ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      导出中...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      导出CSV文件
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <HelpCircle className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">导出字段说明</p>
                    <p className="mt-1">UID、资产名称、分类、位置、状态、描述、图片URL、采购日期、采购价格、最近盘点时间、创建时间、更新时间</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
