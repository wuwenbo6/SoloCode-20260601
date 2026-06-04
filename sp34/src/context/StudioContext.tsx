import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import { Project, Track, Note, QuantizationValue, MIDIDevice, AutomationTrack, VSTPlugin } from '../types';
import { audioEngine } from '../audio/AudioEngine';
import { midiManager } from '../midi/MIDIManager';
import { recordingEngine } from '../audio/RecordingEngine';
import { metronome } from '../audio/Metronome';
import { projectStorage } from '../storage/ProjectStorage';
import { automationManager, CC_MAPPINGS } from '../audio/AutomationManager';
import { audioExporter } from '../audio/AudioExporter';
import { vstBridge } from '../vst/VSTBridge';

interface StudioState {
  project: Project;
  selectedTrackId: string | null;
  isRecording: boolean;
  isPlaying: boolean;
  midiDevices: MIDIDevice[];
  selectedMidiInput: string | null;
  quantization: QuantizationValue;
  metronomeEnabled: boolean;
  projects: Project[];
  showProjectModal: boolean;
  showExportModal: boolean;
  showVSTPanel: boolean;
  vstConnected: boolean;
  availableVSTPlugins: string[];
  activeCCValues: Map<number, number>;
}

type StudioAction =
  | { type: 'SET_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Partial<Project> }
  | { type: 'SET_SELECTED_TRACK'; payload: string | null }
  | { type: 'ADD_TRACK'; payload: Track }
  | { type: 'UPDATE_TRACK'; payload: { trackId: string; updates: Partial<Track> } }
  | { type: 'DELETE_TRACK'; payload: string }
  | { type: 'ADD_NOTE'; payload: { trackId: string; note: Note } }
  | { type: 'DELETE_NOTE'; payload: { trackId: string; noteId: string } }
  | { type: 'ADD_CC_EVENT'; payload: { trackId: string; automationTrack: AutomationTrack } }
  | { type: 'SET_RECORDING'; payload: boolean }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_MIDI_DEVICES'; payload: MIDIDevice[] }
  | { type: 'SET_MIDI_INPUT'; payload: string | null }
  | { type: 'SET_QUANTIZATION'; payload: QuantizationValue }
  | { type: 'SET_METRONOME'; payload: boolean }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_PROJECT_MODAL'; payload: boolean }
  | { type: 'SET_EXPORT_MODAL'; payload: boolean }
  | { type: 'SET_VST_PANEL'; payload: boolean }
  | { type: 'SET_VST_CONNECTED'; payload: boolean }
  | { type: 'SET_AVAILABLE_VST'; payload: string[] }
  | { type: 'UPDATE_CC_VALUE'; payload: { controller: number; value: number } };

const initialState: StudioState = {
  project: projectStorage.createNewProject('My Project'),
  selectedTrackId: null,
  isRecording: false,
  isPlaying: false,
  midiDevices: [],
  selectedMidiInput: null,
  quantization: 16,
  metronomeEnabled: false,
  projects: [],
  showProjectModal: false,
  showExportModal: false,
  showVSTPanel: false,
  vstConnected: false,
  availableVSTPlugins: [],
  activeCCValues: new Map()
};

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.payload, selectedTrackId: action.payload.tracks[0]?.id || null };
    case 'UPDATE_PROJECT':
      return { ...state, project: { ...state.project, ...action.payload } };
    case 'SET_SELECTED_TRACK':
      return { ...state, selectedTrackId: action.payload };
    case 'ADD_TRACK':
      return {
        ...state,
        project: { ...state.project, tracks: [...state.project.tracks, action.payload] }
      };
    case 'UPDATE_TRACK':
      return {
        ...state,
        project: {
          ...state.project,
          tracks: state.project.tracks.map(t =>
            t.id === action.payload.trackId ? { ...t, ...action.payload.updates } : t
          )
        }
      };
    case 'DELETE_TRACK':
      return {
        ...state,
        project: {
          ...state.project,
          tracks: state.project.tracks.filter(t => t.id !== action.payload)
        },
        selectedTrackId: state.selectedTrackId === action.payload ? null : state.selectedTrackId
      };
    case 'ADD_NOTE':
      return {
        ...state,
        project: {
          ...state.project,
          tracks: state.project.tracks.map(t =>
            t.id === action.payload.trackId
              ? { ...t, notes: [...t.notes, action.payload.note] }
              : t
          )
        }
      };
    case 'DELETE_NOTE':
      return {
        ...state,
        project: {
          ...state.project,
          tracks: state.project.tracks.map(t =>
            t.id === action.payload.trackId
              ? { ...t, notes: t.notes.filter(n => n.id !== action.payload.noteId) }
              : t
          )
        }
      };
    case 'ADD_CC_EVENT': {
      const { trackId, automationTrack } = action.payload;
      return {
        ...state,
        project: {
          ...state.project,
          tracks: state.project.tracks.map(t => {
            if (t.id !== trackId) return t;
            const existingIdx = t.automation.findIndex(
              a => a.ccNumber === automationTrack.ccNumber
            );
            if (existingIdx >= 0) {
              const updated = [...t.automation];
              updated[existingIdx] = {
                ...updated[existingIdx],
                events: [...updated[existingIdx].events, ...automationTrack.events]
              };
              return { ...t, automation: updated };
            } else {
              return { ...t, automation: [...t.automation, automationTrack] };
            }
          })
        }
      };
    }
    case 'SET_RECORDING':
      return { ...state, isRecording: action.payload };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_MIDI_DEVICES':
      return { ...state, midiDevices: action.payload };
    case 'SET_MIDI_INPUT':
      return { ...state, selectedMidiInput: action.payload };
    case 'SET_QUANTIZATION':
      return { ...state, quantization: action.payload };
    case 'SET_METRONOME':
      return { ...state, metronomeEnabled: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_PROJECT_MODAL':
      return { ...state, showProjectModal: action.payload };
    case 'SET_EXPORT_MODAL':
      return { ...state, showExportModal: action.payload };
    case 'SET_VST_PANEL':
      return { ...state, showVSTPanel: action.payload };
    case 'SET_VST_CONNECTED':
      return { ...state, vstConnected: action.payload };
    case 'SET_AVAILABLE_VST':
      return { ...state, availableVSTPlugins: action.payload };
    case 'UPDATE_CC_VALUE': {
      const newMap = new Map(state.activeCCValues);
      newMap.set(action.payload.controller, action.payload.value);
      return { ...state, activeCCValues: newMap };
    }
    default:
      return state;
  }
}

interface StudioContextType {
  state: StudioState;
  dispatch: React.Dispatch<StudioAction>;
  exportProgress: number;
  isExporting: boolean;
  saveProject: () => Promise<void>;
  loadProject: (project: Project) => Promise<void>;
  createNewProject: () => void;
  deleteProject: (id: string) => Promise<void>;
  exportProject: () => void;
  importProject: (file: File) => Promise<void>;
  exportToWAV: (trackIds?: string[]) => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  startPlayback: () => void;
  stopPlayback: () => void;
  toggleMetronome: () => void;
  setBPM: (bpm: number) => void;
  addTrack: () => void;
  updateTrackEffects: (trackId: string) => void;
  connectVST: (host?: string) => Promise<void>;
  disconnectVST: () => void;
  loadVSTPlugin: (trackId: string, pluginName: string) => Promise<VSTPlugin | null>;
  unloadVSTPlugin: (pluginId: string) => void;
  updateVSTParameter: (pluginId: string, paramId: string, value: number) => void;
}

const StudioContext = createContext<StudioContextType | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const init = async () => {
      await audioEngine.init();
      await projectStorage.init();
      const midiAvailable = await midiManager.init();

      if (midiAvailable) {
        dispatch({ type: 'SET_MIDI_DEVICES', payload: midiManager.getInputs() });
      }

      const projects = await projectStorage.getAllProjects();
      dispatch({ type: 'SET_PROJECTS', payload: projects });

      if (state.project.tracks.length > 0) {
        dispatch({ type: 'SET_SELECTED_TRACK', payload: state.project.tracks[0].id });
      }

      vstBridge.onConnection((connected) => {
        dispatch({ type: 'SET_VST_CONNECTED', payload: connected });
      });

      vstBridge.onPluginList((plugins) => {
        dispatch({ type: 'SET_AVAILABLE_VST', payload: plugins });
      });

      vstBridge.onError((error) => {
        console.error('VST Bridge error:', error);
      });
    };

    init();

    return () => {
      audioEngine.dispose();
      midiManager.dispose();
      recordingEngine.dispose();
      metronome.dispose();
      projectStorage.close();
      automationManager.dispose();
      vstBridge.dispose();
    };
  }, []);

  useEffect(() => {
    const cleanupNoteOn = midiManager.onNoteOn(async (midiNumber, velocity, _timestamp) => {
      await audioEngine.resume();
      const audioTime = audioEngine.getCurrentTime();
      audioEngine.playNote(midiNumber, velocity, state.selectedTrackId || 'default');

      if (state.isRecording && state.selectedTrackId) {
        recordingEngine.recordNoteOn(midiNumber, velocity, audioTime);
      }

      if (state.selectedTrackId) {
        const track = state.project.tracks.find(t => t.id === state.selectedTrackId);
        if (track?.vst?.enabled && track.vst.id) {
          vstBridge.sendNoteOn(track.vst.id, midiNumber, velocity);
        }
      }
    });

    const cleanupNoteOff = (midiNumber: number) => {
      const audioTime = audioEngine.getCurrentTime();
      audioEngine.stopNote(midiNumber);

      if (state.isRecording && state.selectedTrackId) {
        const note = recordingEngine.recordNoteOff(midiNumber, audioTime);
        if (note) {
          dispatch({ type: 'ADD_NOTE', payload: { trackId: state.selectedTrackId, note } });
        }
      }

      if (state.selectedTrackId) {
        const track = state.project.tracks.find(t => t.id === state.selectedTrackId);
        if (track?.vst?.enabled && track.vst.id) {
          vstBridge.sendNoteOff(track.vst.id, midiNumber);
        }
      }
    };

    const cleanupMidiNoteOff = midiManager.onNoteOff(cleanupNoteOff);

    const cleanupCC = midiManager.onControlChange((controller, value, _timestamp) => {
      const audioTime = audioEngine.getCurrentTime();
      dispatch({ type: 'UPDATE_CC_VALUE', payload: { controller, value } });

      if (state.selectedTrackId) {
        const ccEvent = automationManager.handleCCEvent(
          controller,
          value,
          audioTime,
          state.selectedTrackId,
          state.isPlaying
        );

        if (ccEvent && state.isRecording) {
          const mapping = CC_MAPPINGS[controller];
          const paramName = mapping?.param || `cc_${controller}`;
          const autoTrack: AutomationTrack = {
            id: `auto-${state.selectedTrackId}-${controller}-${Date.now()}`,
            trackId: state.selectedTrackId,
            parameterName: paramName,
            ccNumber: controller,
            events: [ccEvent]
          };
          dispatch({
            type: 'ADD_CC_EVENT',
            payload: { trackId: state.selectedTrackId, automationTrack: autoTrack }
          });
        }
      }
    });

    const cleanupDeviceChange = midiManager.onDeviceChange(() => {
      dispatch({ type: 'SET_MIDI_DEVICES', payload: midiManager.getInputs() });
    });

    return () => {
      cleanupNoteOn();
      cleanupMidiNoteOff();
      cleanupCC();
      cleanupDeviceChange();
    };
  }, [state.isRecording, state.isPlaying, state.selectedTrackId, state.project.tracks]);

  useEffect(() => {
    state.project.tracks.forEach(track => {
      audioEngine.updateTrackEffects(track.id, track.effects);
      audioEngine.setTrackVolume(track.id, track.muted ? 0 : track.volume);
    });
  }, [state.project.tracks]);

  useEffect(() => {
    recordingEngine.setBPM(state.project.bpm);
    recordingEngine.setQuantization(state.quantization);
    metronome.setBPM(state.project.bpm);
  }, [state.project.bpm, state.quantization]);

  const saveProject = useCallback(async () => {
    await projectStorage.saveProject(state.project);
    const projects = await projectStorage.getAllProjects();
    dispatch({ type: 'SET_PROJECTS', payload: projects });
  }, [state.project]);

  const loadProject = useCallback(async (project: Project) => {
    dispatch({ type: 'SET_PROJECT', payload: project });
    dispatch({ type: 'SET_PROJECT_MODAL', payload: false });
  }, []);

  const createNewProject = useCallback(() => {
    const newProject = projectStorage.createNewProject('New Project');
    dispatch({ type: 'SET_PROJECT', payload: newProject });
    dispatch({ type: 'SET_PROJECT_MODAL', payload: false });
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await projectStorage.deleteProject(id);
    const projects = await projectStorage.getAllProjects();
    dispatch({ type: 'SET_PROJECTS', payload: projects });
  }, []);

  const exportProject = useCallback(() => {
    projectStorage.downloadProject(state.project);
  }, [state.project]);

  const importProject = useCallback(async (file: File) => {
    const project = await projectStorage.loadFromFile(file);
    dispatch({ type: 'SET_PROJECT', payload: project });
    dispatch({ type: 'SET_PROJECT_MODAL', payload: false });
  }, []);

  const exportToWAV = useCallback(async (trackIds?: string[]) => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      const blob = await audioExporter.exportToWAV(
        state.project,
        trackIds,
        (progress) => setExportProgress(progress)
      );

      const filename = `${state.project.name.replace(/\s+/g, '_')}.wav`;
      audioExporter.downloadWAV(blob, filename);
    } catch (error) {
      console.error('Export failed:', error);
      alert('导出失败: ' + (error as Error).message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      dispatch({ type: 'SET_EXPORT_MODAL', payload: false });
    }
  }, [state.project]);

  const startRecording = useCallback(() => {
    if (state.selectedTrackId) {
      recordingEngine.startRecording(state.selectedTrackId);
      automationManager.startRecording(state.selectedTrackId);
      dispatch({ type: 'SET_RECORDING', payload: true });
      if (state.metronomeEnabled) {
        metronome.start();
      }
    }
  }, [state.selectedTrackId, state.metronomeEnabled]);

  const stopRecording = useCallback(() => {
    const recordedAutomations = automationManager.stopRecording();
    recordedAutomations.forEach(autoTrack => {
      dispatch({
        type: 'ADD_CC_EVENT',
        payload: { trackId: state.selectedTrackId!, automationTrack: autoTrack }
      });
    });
    recordingEngine.stopRecording();
    dispatch({ type: 'SET_RECORDING', payload: false });
    metronome.stop();
  }, [state.selectedTrackId]);

  const startPlayback = useCallback(() => {
    const track = state.project.tracks.find(t => t.id === state.selectedTrackId);
    if (track) {
      recordingEngine.startPlayback(track, undefined, () => {
        dispatch({ type: 'SET_PLAYING', payload: false });
      });
      dispatch({ type: 'SET_PLAYING', payload: true });
    }
  }, [state.project.tracks, state.selectedTrackId]);

  const stopPlayback = useCallback(() => {
    recordingEngine.stopPlayback();
    dispatch({ type: 'SET_PLAYING', payload: false });
  }, []);

  const toggleMetronome = useCallback(() => {
    const enabled = metronome.toggle();
    dispatch({ type: 'SET_METRONOME', payload: enabled });
  }, []);

  const setBPM = useCallback((bpm: number) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: { bpm } });
  }, []);

  const addTrack = useCallback(() => {
    const trackNum = state.project.tracks.length + 1;
    const newTrack = projectStorage.createNewTrack(`Track ${trackNum}`);
    dispatch({ type: 'ADD_TRACK', payload: newTrack });
    dispatch({ type: 'SET_SELECTED_TRACK', payload: newTrack.id });
  }, [state.project.tracks.length]);

  const updateTrackEffects = useCallback((trackId: string) => {
    const track = state.project.tracks.find(t => t.id === trackId);
    if (track) {
      audioEngine.updateTrackEffects(track.id, track.effects);
    }
  }, [state.project.tracks]);

  const connectVST = useCallback(async (host?: string) => {
    try {
      await vstBridge.connect(host);
    } catch (error) {
      console.error('Failed to connect VST:', error);
      throw error;
    }
  }, []);

  const disconnectVST = useCallback(() => {
    vstBridge.disconnect();
  }, []);

  const loadVSTPlugin = useCallback(async (trackId: string, pluginName: string): Promise<VSTPlugin | null> => {
    try {
      const plugin = await vstBridge.loadPlugin(pluginName, trackId);
      if (plugin) {
        dispatch({
          type: 'UPDATE_TRACK',
          payload: { trackId, updates: { vst: plugin } }
        });
      }
      return plugin;
    } catch (error) {
      console.error('Failed to load VST plugin:', error);
      return null;
    }
  }, []);

  const unloadVSTPlugin = useCallback((pluginId: string) => {
    vstBridge.unloadPlugin(pluginId);
    const track = state.project.tracks.find(t => t.vst?.id === pluginId);
    if (track) {
      dispatch({
        type: 'UPDATE_TRACK',
        payload: { trackId: track.id, updates: { vst: undefined } }
      });
    }
  }, [state.project.tracks]);

  const updateVSTParameter = useCallback((pluginId: string, paramId: string, value: number) => {
    vstBridge.setParameter(pluginId, paramId, value);
    const track = state.project.tracks.find(t => t.vst?.id === pluginId);
    if (track?.vst) {
      const updatedParams = track.vst.parameters.map(p =>
        p.id === paramId ? { ...p, value } : p
      );
      dispatch({
        type: 'UPDATE_TRACK',
        payload: {
          trackId: track.id,
          updates: {
            vst: { ...track.vst, parameters: updatedParams }
          }
        }
      });
    }
  }, [state.project.tracks]);

  return (
    <StudioContext.Provider value={{
      state,
      dispatch,
      exportProgress,
      isExporting,
      saveProject,
      loadProject,
      createNewProject,
      deleteProject,
      exportProject,
      importProject,
      exportToWAV,
      startRecording,
      stopRecording,
      startPlayback,
      stopPlayback,
      toggleMetronome,
      setBPM,
      addTrack,
      updateTrackEffects,
      connectVST,
      disconnectVST,
      loadVSTPlugin,
      unloadVSTPlugin,
      updateVSTParameter
    }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}
