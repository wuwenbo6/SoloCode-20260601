import { create } from 'zustand';

export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  audioLevel: number;
  isHandRaised: boolean;
  handRaiseTime: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'caption';
}

export interface Caption {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  allowMultiple: boolean;
  creatorId: string;
  creatorName: string;
  isActive: boolean;
  createdAt: number;
  results: number[];
  totalVotes: number;
}

export interface PlaybackEvent {
  type: 'chat' | 'caption' | 'poll-start' | 'poll-end' | 'hand-raise' | 'hand-lower' | 'join' | 'leave';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface RecordingMetadata {
  roomId: string;
  roomName: string;
  startTime: number;
  endTime: number;
  duration: number;
  filePath: string;
  events: PlaybackEvent[];
  participants: { id: string; name: string }[];
}

export type PanelType = 'none' | 'participants' | 'chat' | 'poll';

interface MeetingState {
  roomId: string;
  userName: string;
  isHost: boolean;
  isRecording: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isVirtualBgOn: boolean;
  isCaptioning: boolean;
  participants: Participant[];
  chatMessages: ChatMessage[];
  encryptionKeys: CryptoKeyPair | null;
  sharedKeys: Map<string, CryptoKey>;
  isEncrypted: boolean;
  panelOpen: PanelType;
  captions: Caption[];
  currentCaption: string;
  polls: Poll[];
  activePollId: string | null;
  recordingList: RecordingMetadata[];
  playbackPosition: number;
  isPlaybackMode: boolean;
  isHandRaised: boolean;

  setRoomId: (id: string) => void;
  setUserName: (name: string) => void;
  setIsHost: (val: boolean) => void;
  setIsRecording: (val: boolean) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  addRemoteStream: (peerId: string, stream: MediaStream) => void;
  removeRemoteStream: (peerId: string) => void;
  setIsMuted: (val: boolean) => void;
  setIsCameraOff: (val: boolean) => void;
  setIsScreenSharing: (val: boolean) => void;
  setIsVirtualBgOn: (val: boolean) => void;
  setIsCaptioning: (val: boolean) => void;
  setParticipants: (participants: Participant[]) => void;
  updateParticipant: (peerId: string, updates: Partial<Participant>) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setEncryptionKeys: (keys: CryptoKeyPair) => void;
  addSharedKey: (peerId: string, key: CryptoKey) => void;
  setIsEncrypted: (val: boolean) => void;
  setPanelOpen: (panel: PanelType) => void;
  addCaption: (caption: Caption) => void;
  setCurrentCaption: (text: string) => void;
  clearCurrentCaption: () => void;
  addPoll: (poll: Poll) => void;
  updatePoll: (pollId: string, updates: Partial<Poll>) => void;
  endPoll: (pollId: string, results: { results: number[]; totalVotes: number }) => void;
  setActivePollId: (id: string | null) => void;
  setRecordingList: (recordings: RecordingMetadata[]) => void;
  setPlaybackPosition: (pos: number) => void;
  setIsPlaybackMode: (val: boolean) => void;
  setIsHandRaised: (val: boolean) => void;
  raiseHand: (peerId: string) => void;
  lowerHand: (peerId: string) => void;
  lowerAllHands: () => void;
  reset: () => void;
}

const initialState = {
  roomId: '',
  userName: '',
  isHost: false,
  isRecording: false,
  localStream: null as MediaStream | null,
  remoteStreams: new Map<string, MediaStream>(),
  isMuted: false,
  isCameraOff: false,
  isScreenSharing: false,
  isVirtualBgOn: false,
  isCaptioning: false,
  participants: [] as Participant[],
  chatMessages: [] as ChatMessage[],
  encryptionKeys: null as CryptoKeyPair | null,
  sharedKeys: new Map<string, CryptoKey>(),
  isEncrypted: false,
  panelOpen: 'none' as PanelType,
  captions: [] as Caption[],
  currentCaption: '',
  polls: [] as Poll[],
  activePollId: null as string | null,
  recordingList: [] as RecordingMetadata[],
  playbackPosition: 0,
  isPlaybackMode: false,
  isHandRaised: false,
};

export const useMeetingStore = create<MeetingState>((set) => ({
  ...initialState,

  setRoomId: (id) => set({ roomId: id }),
  setUserName: (name) => set({ userName: name }),
  setIsHost: (val) => set({ isHost: val }),
  setIsRecording: (val) => set({ isRecording: val }),
  setLocalStream: (stream) => set({ localStream: stream }),
  addRemoteStream: (peerId, stream) =>
    set((state) => {
      const next = new Map(state.remoteStreams);
      next.set(peerId, stream);
      return { remoteStreams: next };
    }),
  removeRemoteStream: (peerId) =>
    set((state) => {
      const next = new Map(state.remoteStreams);
      next.delete(peerId);
      return { remoteStreams: next };
    }),
  setIsMuted: (val) => set({ isMuted: val }),
  setIsCameraOff: (val) => set({ isCameraOff: val }),
  setIsScreenSharing: (val) => set({ isScreenSharing: val }),
  setIsVirtualBgOn: (val) => set({ isVirtualBgOn: val }),
  setIsCaptioning: (val) => set({ isCaptioning: val }),
  setParticipants: (participants) => set({ participants }),
  updateParticipant: (peerId, updates) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === peerId ? { ...p, ...updates } : p
      ),
    })),
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  setEncryptionKeys: (keys) => set({ encryptionKeys: keys }),
  addSharedKey: (peerId, key) =>
    set((state) => {
      const next = new Map(state.sharedKeys);
      next.set(peerId, key);
      return { sharedKeys: next };
    }),
  setIsEncrypted: (val) => set({ isEncrypted: val }),
  setPanelOpen: (panel) => set({ panelOpen: panel }),
  addCaption: (caption) =>
    set((state) => ({ captions: [...state.captions.slice(-100), caption] })),
  setCurrentCaption: (text) => set({ currentCaption: text }),
  clearCurrentCaption: () => set({ currentCaption: '' }),
  addPoll: (poll) =>
    set((state) => ({ polls: [...state.polls, poll] })),
  updatePoll: (pollId, updates) =>
    set((state) => ({
      polls: state.polls.map((p) =>
        p.id === pollId ? { ...p, ...updates } : p
      ),
    })),
  endPoll: (pollId, results) =>
    set((state) => ({
      polls: state.polls.map((p) =>
        p.id === pollId
          ? { ...p, isActive: false, results: results.results, totalVotes: results.totalVotes }
          : p
      ),
    })),
  setActivePollId: (id) => set({ activePollId: id }),
  setRecordingList: (recordings) => set({ recordingList: recordings }),
  setPlaybackPosition: (pos) => set({ playbackPosition: pos }),
  setIsPlaybackMode: (val) => set({ isPlaybackMode: val }),
  setIsHandRaised: (val) => set({ isHandRaised: val }),
  raiseHand: (peerId) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === peerId ? { ...p, isHandRaised: true, handRaiseTime: Date.now() } : p
      ),
      isHandRaised: state.localStream && state.participants.some((p) => p.id === peerId) ? true : state.isHandRaised,
    })),
  lowerHand: (peerId) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === peerId ? { ...p, isHandRaised: false, handRaiseTime: 0 } : p
      ),
      isHandRaised: state.participants.some((p) => p.id === peerId && state.isHandRaised)
        ? state.participants.filter((p) => p.id !== peerId).some((p) => p.isHandRaised)
        : state.isHandRaised,
    })),
  lowerAllHands: () =>
    set((state) => ({
      participants: state.participants.map((p) => ({ ...p, isHandRaised: false, handRaiseTime: 0 })),
      isHandRaised: false,
    })),
  reset: () => set(initialState),
}));
