import React from 'react';
import { useStudio } from '../context/StudioContext';
import { EffectChain } from '../types';

export const EffectsPanel: React.FC = () => {
  const { state, dispatch, updateTrackEffects } = useStudio();

  const selectedTrack = state.project.tracks.find(t => t.id === state.selectedTrackId);

  if (!selectedTrack) {
    return (
      <div className="effects-panel">
        <div className="panel-empty">Select a track to edit effects</div>
      </div>
    );
  }

  const updateEffects = (updates: Partial<EffectChain>) => {
    dispatch({
      type: 'UPDATE_TRACK',
      payload: {
        trackId: state.selectedTrackId!,
        updates: {
          effects: { ...selectedTrack.effects, ...updates }
        }
      }
    });
    setTimeout(() => updateTrackEffects(state.selectedTrackId!), 0);
  };

  return (
    <div className="effects-panel">
      <h3>Effects</h3>
      
      <div className="effect-section">
        <div className="effect-header">
          <label className="switch">
            <input
              type="checkbox"
              checked={selectedTrack.effects.reverb.enabled}
              onChange={(e) => updateEffects({
                reverb: { ...selectedTrack.effects.reverb, enabled: e.target.checked }
              })}
            />
            <span className="slider"></span>
          </label>
          <span className="effect-name">Reverb</span>
        </div>
        {selectedTrack.effects.reverb.enabled && (
          <div className="effect-controls">
            <div className="control-group">
              <label>Mix: {Math.round(selectedTrack.effects.reverb.mix * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedTrack.effects.reverb.mix}
                onChange={(e) => updateEffects({
                  reverb: { ...selectedTrack.effects.reverb, mix: Number(e.target.value) }
                })}
              />
            </div>
            <div className="control-group">
              <label>Decay: {selectedTrack.effects.reverb.decay.toFixed(1)}s</label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={selectedTrack.effects.reverb.decay}
                onChange={(e) => updateEffects({
                  reverb: { ...selectedTrack.effects.reverb, decay: Number(e.target.value) }
                })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="effect-section">
        <div className="effect-header">
          <label className="switch">
            <input
              type="checkbox"
              checked={selectedTrack.effects.delay.enabled}
              onChange={(e) => updateEffects({
                delay: { ...selectedTrack.effects.delay, enabled: e.target.checked }
              })}
            />
            <span className="slider"></span>
          </label>
          <span className="effect-name">Delay</span>
        </div>
        {selectedTrack.effects.delay.enabled && (
          <div className="effect-controls">
            <div className="control-group">
              <label>Time: {(selectedTrack.effects.delay.time * 1000).toFixed(0)}ms</label>
              <input
                type="range"
                min="0.01"
                max="2"
                step="0.01"
                value={selectedTrack.effects.delay.time}
                onChange={(e) => updateEffects({
                  delay: { ...selectedTrack.effects.delay, time: Number(e.target.value) }
                })}
              />
            </div>
            <div className="control-group">
              <label>Feedback: {Math.round(selectedTrack.effects.delay.feedback * 100)}%</label>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.01"
                value={selectedTrack.effects.delay.feedback}
                onChange={(e) => updateEffects({
                  delay: { ...selectedTrack.effects.delay, feedback: Number(e.target.value) }
                })}
              />
            </div>
            <div className="control-group">
              <label>Mix: {Math.round(selectedTrack.effects.delay.mix * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedTrack.effects.delay.mix}
                onChange={(e) => updateEffects({
                  delay: { ...selectedTrack.effects.delay, mix: Number(e.target.value) }
                })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="effect-section">
        <div className="effect-header">
          <label className="switch">
            <input
              type="checkbox"
              checked={selectedTrack.effects.filter.enabled}
              onChange={(e) => updateEffects({
                filter: { ...selectedTrack.effects.filter, enabled: e.target.checked }
              })}
            />
            <span className="slider"></span>
          </label>
          <span className="effect-name">Filter</span>
        </div>
        {selectedTrack.effects.filter.enabled && (
          <div className="effect-controls">
            <div className="control-group">
              <label>Type</label>
              <select
                value={selectedTrack.effects.filter.type}
                onChange={(e) => updateEffects({
                  filter: { 
                    ...selectedTrack.effects.filter, 
                    type: e.target.value as BiquadFilterType 
                  }
                })}
              >
                <option value="lowpass">Low Pass</option>
                <option value="highpass">High Pass</option>
                <option value="bandpass">Band Pass</option>
                <option value="notch">Notch</option>
                <option value="peaking">Peaking</option>
                <option value="lowshelf">Low Shelf</option>
                <option value="highshelf">High Shelf</option>
              </select>
            </div>
            <div className="control-group">
              <label>Freq: {selectedTrack.effects.filter.frequency.toFixed(0)}Hz</label>
              <input
                type="range"
                min="20"
                max="20000"
                step="1"
                value={selectedTrack.effects.filter.frequency}
                onChange={(e) => updateEffects({
                  filter: { ...selectedTrack.effects.filter, frequency: Number(e.target.value) }
                })}
              />
            </div>
            <div className="control-group">
              <label>Q: {selectedTrack.effects.filter.q.toFixed(2)}</label>
              <input
                type="range"
                min="0.1"
                max="20"
                step="0.1"
                value={selectedTrack.effects.filter.q}
                onChange={(e) => updateEffects({
                  filter: { ...selectedTrack.effects.filter, q: Number(e.target.value) }
                })}
              />
            </div>
            {(selectedTrack.effects.filter.type === 'peaking' || 
              selectedTrack.effects.filter.type === 'lowshelf' ||
              selectedTrack.effects.filter.type === 'highshelf') && (
              <div className="control-group">
                <label>Gain: {selectedTrack.effects.filter.gain.toFixed(1)}dB</label>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="1"
                  value={selectedTrack.effects.filter.gain}
                  onChange={(e) => updateEffects({
                    filter: { ...selectedTrack.effects.filter, gain: Number(e.target.value) }
                  })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
