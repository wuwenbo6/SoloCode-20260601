import React from 'react';
import { useStudio } from '../context/StudioContext';
import { midiManager } from '../midi/MIDIManager';
import { CC_MAPPINGS } from '../audio/AutomationManager';

export const Toolbar: React.FC = () => {
  const { state, dispatch, startRecording, stopRecording, startPlayback, stopPlayback, toggleMetronome, setBPM, saveProject, exportProject } = useStudio();

  const handleMidiInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value || null;
    dispatch({ type: 'SET_MIDI_INPUT', payload: deviceId });
    midiManager.selectInput(deviceId);
  };

  const handleQuantizationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SET_QUANTIZATION', payload: Number(e.target.value) as any });
  };

  const activeCCEntries = Array.from(state.activeCCValues.entries()).slice(0, 4);

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button
          className={`btn ${state.isRecording ? 'btn-danger active' : 'btn-danger'}`}
          onClick={state.isRecording ? stopRecording : startRecording}
          disabled={!state.selectedTrackId}
          title={state.isRecording ? '停止录音 (包括 CC 自动化)' : '开始录音 (音符 + CC 自动化)'}
        >
          {state.isRecording ? 'Stop' : 'Record'}
        </button>
        <button
          className={`btn ${state.isPlaying ? 'btn-warning active' : 'btn-primary'}`}
          onClick={state.isPlaying ? stopPlayback : startPlayback}
          disabled={!state.selectedTrackId}
        >
          {state.isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>

      <div className="toolbar-section">
        <button
          className={`btn ${state.metronomeEnabled ? 'btn-success active' : 'btn-secondary'}`}
          onClick={toggleMetronome}
        >
          Metronome
        </button>
        <div className="input-group">
          <label>BPM:</label>
          <input
            type="number"
            min="30"
            max="300"
            value={state.project.bpm}
            onChange={(e) => setBPM(Number(e.target.value))}
            className="input-small"
          />
        </div>
        <div className="input-group">
          <label>Quantize:</label>
          <select
            value={state.quantization}
            onChange={handleQuantizationChange}
            className="input-small"
          >
            <option value="1">1/1</option>
            <option value="2">1/2</option>
            <option value="4">1/4</option>
            <option value="8">1/8</option>
            <option value="16">1/16</option>
            <option value="32">1/32</option>
          </select>
        </div>
      </div>

      <div className="toolbar-section">
        <div className="input-group">
          <label>MIDI In:</label>
          <select
            value={state.selectedMidiInput || ''}
            onChange={handleMidiInputChange}
            className="input-medium"
          >
            <option value="">None</option>
            {state.midiDevices.map(device => (
              <option key={device.id} value={device.id}>{device.name}</option>
            ))}
          </select>
        </div>
      </div>

      {activeCCEntries.length > 0 && (
        <div className="toolbar-section cc-indicators">
          {activeCCEntries.map(([cc, value]) => {
            const mapping = CC_MAPPINGS[cc];
            return (
              <div key={cc} className="cc-indicator">
                <span className="cc-label">CC{cc}{mapping ? ` ${mapping.param}` : ''}</span>
                <div className="cc-bar">
                  <div
                    className="cc-bar-fill"
                    style={{ width: `${(value / 127) * 100}%` }}
                  ></div>
                </div>
                <span className="cc-value">{value}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="toolbar-section toolbar-right">
        <span className={`vst-status ${state.vstConnected ? 'connected' : 'disconnected'}`}>
          ● VST {state.vstConnected ? '已连接' : '未连接'}
        </span>
        <button
          className="btn btn-outline"
          onClick={() => dispatch({ type: 'SET_VST_PANEL', payload: true })}
          title="VST 插件桥接"
        >
          VST
        </button>
        <button
          className="btn btn-outline"
          onClick={() => dispatch({ type: 'SET_EXPORT_MODAL', payload: true })}
          title="导出 WAV 音频"
        >
          Export WAV
        </button>
        <button
          className="btn btn-outline"
          onClick={() => dispatch({ type: 'SET_PROJECT_MODAL', payload: true })}
        >
          Projects
        </button>
        <button className="btn btn-outline" onClick={saveProject}>
          Save
        </button>
        <button className="btn btn-outline" onClick={exportProject}>
          Export JSON
        </button>
      </div>
    </div>
  );
};
