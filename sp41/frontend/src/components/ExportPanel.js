import React, { useState } from 'react';
import { exportApi } from '../api';

const ExportPanel = ({ deviceId, userProfile }) => {
  const [dateRange, setDateRange] = useState({
    start: '-7d',
    end: 'now()'
  });
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!deviceId) {
      alert('请先连接设备');
      return;
    }

    setExporting(true);
    try {
      const response = await exportApi.exportCSV(deviceId, dateRange.start, dateRange.end);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartband-data-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export CSV error:', error);
      alert('导出失败');
    }
    setExporting(false);
  };

  const handleExportPDF = async () => {
    if (!deviceId) {
      alert('请先连接设备');
      return;
    }

    setExporting(true);
    try {
      const response = await exportApi.exportPDF(
        deviceId,
        dateRange.start,
        dateRange.end,
        userProfile
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartband-report-${Date.now()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export PDF error:', error);
      alert('导出失败');
    }
    setExporting(false);
  };

  return (
    <div className="export-panel">
      <h3>数据导出</h3>

      <div className="export-options">
        <div className="date-range-selector">
          <label>时间范围:</label>
          <select
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          >
            <option value="-1d">最近1天</option>
            <option value="-7d">最近7天</option>
            <option value="-30d">最近30天</option>
            <option value="-90d">最近90天</option>
          </select>
        </div>

        <div className="export-buttons">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="btn btn-export-csv"
          >
            {exporting ? '导出中...' : '导出 CSV'}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="btn btn-export-pdf"
          >
            {exporting ? '导出中...' : '导出 PDF 报告'}
          </button>
        </div>
      </div>

      <p className="export-note">
        导出的数据包括步数、心率和睡眠记录。PDF报告会包含统计摘要和分析结果。
      </p>
    </div>
  );
};

export default ExportPanel;
