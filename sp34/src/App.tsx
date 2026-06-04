import React, { useState } from 'react';
import { StudioProvider, useStudio } from './context/StudioContext';
import { Toolbar } from './components/Toolbar';
import { TrackList } from './components/TrackList';
import { PianoRoll } from './components/PianoRoll';
import { EffectsPanel } from './components/EffectsPanel';
import { ProjectModal } from './components/ProjectModal';
import { ExportModal } from './components/ExportModal';
import { VSTPanel } from './components/VSTPanel';
import { AutomationEditor } from './components/AutomationEditor';
import './styles.css';

type CenterTab = 'piano' | 'automation';

const AppContent: React.FC = () => {
  const { state } = useStudio();
  const [centerTab, setCenterTab] = useState<CenterTab>('piano');

  return (
    <>
      <Toolbar />
      <div className="main-content">
        <div className="left-panel">
          <TrackList />
        </div>
        <div className="center-panel">
          <div className="center-tabs">
            <button
              className={`tab-btn ${centerTab === 'piano' ? 'active' : ''}`}
              onClick={() => setCenterTab('piano')}
            >
              🎹 钢琴卷帘
            </button>
            <button
              className={`tab-btn ${centerTab === 'automation' ? 'active' : ''}`}
              onClick={() => setCenterTab('automation')}
            >
              📈 CC 自动化
            </button>
          </div>
          <div className="center-content">
            {centerTab === 'piano' ? <PianoRoll /> : <AutomationEditor />}
          </div>
        </div>
        <div className="right-panel">
          <EffectsPanel />
        </div>
      </div>
      <div className="status-bar">
        <div className="status-item">
          <span className={`status-indicator ${state.isRecording ? 'recording' : ''}`}></span>
          <span>{state.isRecording ? 'Recording (MIDI + CC)' : 'Ready'}</span>
        </div>
        <div className="status-item">
          <span>Project: {state.project.name}</span>
        </div>
        <div className="status-item">
          <span>{state.selectedMidiInput ? 'MIDI Connected' : 'No MIDI Input'}</span>
        </div>
        <div className="status-item">
          <span className={`status-indicator ${state.vstConnected ? 'active' : ''}`}></span>
          <span>VST: {state.vstConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="status-item">
          <span>{state.project.tracks.reduce((acc, t) => acc + t.automation.reduce((a, at) => a + at.events.length, 0), 0)} CC events</span>
        </div>
      </div>
      <ProjectModal />
      <ExportModal />
      <VSTPanel />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <StudioProvider>
      <AppContent />
    </StudioProvider>
  );
};
