import React from 'react';
import { useStudio } from '../context/StudioContext';

export const TrackList: React.FC = () => {
  const { state, dispatch, addTrack } = useStudio();

  const toggleMute = (trackId: string) => {
    const track = state.project.tracks.find(t => t.id === trackId);
    if (track) {
      dispatch({
        type: 'UPDATE_TRACK',
        payload: { trackId, updates: { muted: !track.muted } }
      });
    }
  };

  const toggleSolo = (trackId: string) => {
    const track = state.project.tracks.find(t => t.id === trackId);
    if (track) {
      dispatch({
        type: 'UPDATE_TRACK',
        payload: { trackId, updates: { solo: !track.solo } }
      });
    }
  };

  const handleVolumeChange = (trackId: string, volume: number) => {
    dispatch({
      type: 'UPDATE_TRACK',
      payload: { trackId, updates: { volume } }
    });
  };

  const handleDeleteTrack = (trackId: string) => {
    if (state.project.tracks.length > 1) {
      dispatch({ type: 'DELETE_TRACK', payload: trackId });
    }
  };

  const handleRenameTrack = (trackId: string, name: string) => {
    dispatch({
      type: 'UPDATE_TRACK',
      payload: { trackId, updates: { name } }
    });
  };

  return (
    <div className="track-list">
      <div className="track-list-header">
        <h3>Tracks</h3>
        <button className="btn btn-small btn-primary" onClick={addTrack}>
          + Add Track
        </button>
      </div>
      <div className="track-list-content">
        {state.project.tracks.map((track) => (
          <div
            key={track.id}
            className={`track-item ${state.selectedTrackId === track.id ? 'selected' : ''}`}
            onClick={() => dispatch({ type: 'SET_SELECTED_TRACK', payload: track.id })}
          >
            <div className="track-info">
              <input
                type="text"
                value={track.name}
                onChange={(e) => handleRenameTrack(track.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="track-name-input"
              />
              <div className="track-stats">
                <span>{track.notes.length} notes</span>
              </div>
            </div>
            <div className="track-controls" onClick={(e) => e.stopPropagation()}>
              <button
                className={`btn-tiny ${track.muted ? 'btn-danger active' : 'btn-outline'}`}
                onClick={() => toggleMute(track.id)}
                title="Mute"
              >
                M
              </button>
              <button
                className={`btn-tiny ${track.solo ? 'btn-success active' : 'btn-outline'}`}
                onClick={() => toggleSolo(track.id)}
                title="Solo"
              >
                S
              </button>
              <div className="volume-slider">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume}
                  onChange={(e) => handleVolumeChange(track.id, Number(e.target.value))}
                />
              </div>
              <button
                className="btn-tiny btn-danger"
                onClick={() => handleDeleteTrack(track.id)}
                disabled={state.project.tracks.length <= 1}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
