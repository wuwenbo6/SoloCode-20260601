import { create } from 'zustand';
import {
  StoreState,
  StoreActions,
  User,
  Room,
  PeerConnection,
  ICEServer,
  CursorPosition,
  Version,
  OfflineEdit,
  Notification,
} from '../types';

const initialState: StoreState = {
  currentUser: null,
  currentRoom: null,
  roomMembers: [],
  peers: new Map(),
  iceServers: [],
  editorContent: '',
  contentVersion: 0,
  cursors: new Map(),
  remoteCursors: new Map(),
  versions: [],
  connectionStatus: 'disconnected',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineEdits: [],
  notifications: [],
  unreadNotifications: 0,
  error: null,
};

export const useStore = create<StoreState & StoreActions>((set) => ({
  ...initialState,

  setCurrentUser: (user: User | null) => set({ currentUser: user }),

  setCurrentRoom: (room: Room | null) => set({ currentRoom: room }),

  setRoomMembers: (members: User[]) => set({ roomMembers: members }),

  addPeer: (peerId: string, connection: PeerConnection) =>
    set((state) => {
      const newPeers = new Map(state.peers);
      newPeers.set(peerId, connection);
      return { peers: newPeers };
    }),

  removePeer: (peerId: string) =>
    set((state) => {
      const newPeers = new Map(state.peers);
      newPeers.delete(peerId);
      const newCursors = new Map(state.cursors);
      newCursors.delete(peerId);
      return { peers: newPeers, cursors: newCursors };
    }),

  updatePeerState: (peerId: string, state: PeerConnection['state']) =>
    set((prevState) => {
      const newPeers = new Map(prevState.peers);
      const peer = newPeers.get(peerId);
      if (peer) {
        newPeers.set(peerId, { ...peer, state });
      }
      return { peers: newPeers };
    }),

  setIceServers: (servers: ICEServer[]) => set({ iceServers: servers }),

  setEditorContent: (content: string, version?: number) =>
    set((state) => {
      if (version !== undefined && version < state.contentVersion) {
        return {};
      }
      return {
        editorContent: content,
        contentVersion: version !== undefined ? version : state.contentVersion,
      };
    }),

  setContentVersion: (version: number) => set({ contentVersion: version }),

  updateCursor: (userId: string, cursor: CursorPosition) =>
    set((state) => {
      const newCursors = new Map(state.cursors);
      newCursors.set(userId, cursor);
      return { cursors: newCursors };
    }),

  removeCursor: (userId: string) =>
    set((state) => {
      const newCursors = new Map(state.cursors);
      newCursors.delete(userId);
      return { cursors: newCursors };
    }),

  updateRemoteCursor: (userId: string, cursor: CursorPosition) =>
    set((state) => {
      const newRemoteCursors = new Map(state.remoteCursors);
      newRemoteCursors.set(userId, cursor);
      return { remoteCursors: newRemoteCursors };
    }),

  removeRemoteCursor: (userId: string) =>
    set((state) => {
      const newRemoteCursors = new Map(state.remoteCursors);
      newRemoteCursors.delete(userId);
      return { remoteCursors: newRemoteCursors };
    }),

  setVersions: (versions: Version[]) => set({ versions }),

  addVersion: (version: Version) =>
    set((state) => ({
      versions: [version, ...state.versions],
    })),

  setConnectionStatus: (status: StoreState['connectionStatus']) =>
    set({ connectionStatus: status }),

  setOnline: (online: boolean) => set({ isOnline: online }),

  addOfflineEdit: (edit: OfflineEdit) =>
    set((state) => ({
      offlineEdits: [...state.offlineEdits, edit],
    })),

  clearOfflineEdits: () => set({ offlineEdits: [] }),

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) =>
    set((state) => {
      const newNotification: Notification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false,
      };
      return {
        notifications: [newNotification, ...state.notifications].slice(0, 50),
        unreadNotifications: state.unreadNotifications + 1,
      };
    }),

  markNotificationRead: (notificationId: string) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === notificationId);
      const wasUnread = notification && !notification.read;
      return {
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadNotifications: wasUnread ? Math.max(0, state.unreadNotifications - 1) : state.unreadNotifications,
      };
    }),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadNotifications: 0,
    })),

  clearNotifications: () => set({ notifications: [], unreadNotifications: 0 }),

  setError: (error: string | null) => set({ error }),

  reset: () => set(initialState),
}));
