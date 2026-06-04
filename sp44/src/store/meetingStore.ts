import { create } from 'zustand';

export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  audioLevel: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export type PanelType = 'none' | 'participants' | 'chat';

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
  participants: Participant[];
  chatMessages: ChatMessage[];
  encryptionKeys: CryptoKeyPair | null;
  sharedKeys: Map<string, CryptoKey>;
  isEncrypted: boolean;
  panelOpen: PanelType;

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
  setParticipants: (participants: Participant[]) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setEncryptionKeys: (keys: CryptoKeyPair) => void;
  addSharedKey: (peerId: string, key: CryptoKey) => void;
  setIsEncrypted: (val: boolean) => void;
  setPanelOpen: (panel: PanelType) => void;
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
  participants: [] as Participant[],
  chatMessages: [] as ChatMessage[],
  encryptionKeys: null as CryptoKeyPair | null,
  sharedKeys: new Map<string, CryptoKey>(),
  isEncrypted: false,
  panelOpen: 'none' as PanelType,
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
  setParticipants: (participants) => set({ participants }),
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
  reset: () => set(initialState),
}));
