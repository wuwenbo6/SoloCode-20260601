import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';

export const ExportModal: React.FC = () => {
  const { state, dispatch, exportToWAV, exportProgress, isExporting } = useStudio();
  const [selectedTracks, setSelectedTracks] = useState<string[]>(
    state.project.tracks.map(t => t.id)
  );

  if (!state.showExportModal) return null;

  const handleToggleTrack = (trackId: string) => {
    setSelectedTracks(prev =>
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };

  const handleSelectAll = () => {
    setSelectedTracks(state.project.tracks.map(t => t.id));
  };

  const handleDeselectAll = () => {
    setSelectedTracks([]);
  };

  const handleExport = async () => {
    if (selectedTracks.length === 0) {
      alert('请至少选择一个轨道');
      return;
    }

    try {
      await exportToWAV(selectedTracks);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !isExporting && dispatch({ type: 'SET_EXPORT_MODAL', payload: false })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>导出 WAV</h2>
          <button
            className="btn-close"
            onClick={() => !isExporting && dispatch({ type: 'SET_EXPORT_MODAL', payload: false })}
            disabled={isExporting}
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="export-section">
            <h4>选择轨道</h4>
            <div className="export-track-actions">
              <button className="btn btn-small btn-outline" onClick={handleSelectAll}>全选</button>
              <button className="btn btn-small btn-outline" onClick={handleDeselectAll}>取消全选</button>
            </div>
            <div className="track-selection">
              {state.project.tracks.map(track => (
                <label key={track.id} className="track-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTracks.includes(track.id)}
                    onChange={() => handleToggleTrack(track.id)}
                    disabled={isExporting}
                  />
                  <span className="track-name">{track.name}</span>
                  <span className="track-info">{track.notes.length} 音符</span>
                </label>
              ))}
            </div>
          </div>

          <div className="export-section">
            <h4>导出信息</h4>
            <div className="export-info">
              <div className="info-row">
                <span>采样率:</span>
                <span>44100 Hz</span>
              </div>
              <div className="info-row">
                <span>位深度:</span>
                <span>16-bit</span>
              </div>
              <div className="info-row">
                <span>声道:</span>
                <span>立体声</span>
              </div>
              <div className="info-row">
                <span>BPM:</span>
                <span>{state.project.bpm}</span>
              </div>
              <div className="info-row">
                <span>输出文件名:</span>
                <span>{state.project.name.replace(/\s+/g, '_')}.wav</span>
              </div>
            </div>
          </div>

          {isExporting && (
            <div className="export-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${exportProgress}%` }}
                ></div>
              </div>
              <span className="progress-text">渲染中... {Math.round(exportProgress)}%</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'SET_EXPORT_MODAL', payload: false })}
            disabled={isExporting}
          >
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting || selectedTracks.length === 0}
          >
            {isExporting ? '导出中...' : '导出 WAV'}
          </button>
        </div>
      </div>
    </div>
  );
};
