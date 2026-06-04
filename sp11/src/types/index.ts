export interface User {
  id: string;
  nickname: string;
  color: string;
  roomId: string;
  isHost: boolean;
  joinedAt: Date;
}

export interface Room {
  id: string;
  name: string;
  password?: string;
  hostId: string;
  createdAt: Date;
  updatedAt: Date;
  members: User[];
}

export interface Version {
  id: string;
  roomId: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  autoSaved: boolean;
  message?: string;
}

export interface CursorPosition {
  userId: string;
  line: number;
  column: number;
  selection?: {
    anchor: { line: number; column: number };
    head: { line: number; column: number };
  };
}

export interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  state: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'sync';
  from: string;
  to?: string;
  roomId: string;
  data: any;
  timestamp?: number;
}

export interface EditorSyncMessage {
  type: 'text-change' | 'cursor' | 'selection' | 'full-content';
  userId: string;
  data: any;
  timestamp: number;
  version?: number;
}

export interface OfflineEdit {
  id: string;
  content: string;
  timestamp: number;
  baseVersion: number;
}

export interface Notification {
  id: string;
  type: 'mention' | 'system' | 'conflict' | 'success' | 'warning';
  title: string;
  message: string;
  fromUser?: User;
  timestamp: number;
  read: boolean;
  data?: any;
}

export interface Mention {
  userId: string;
  userName: string;
  position: { line: number; column: number };
  mentionedBy: User;
  timestamp: number;
}

export interface StoreState {
  currentUser: User | null;
  currentRoom: Room | null;
  roomMembers: User[];
  peers: Map<string, PeerConnection>;
  iceServers: ICEServer[];
  editorContent: string;
  contentVersion: number;
  cursors: Map<string, CursorPosition>;
  remoteCursors: Map<string, CursorPosition>;
  versions: Version[];
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isOnline: boolean;
  offlineEdits: OfflineEdit[];
  notifications: Notification[];
  unreadNotifications: number;
  error: string | null;
}

export interface StoreActions {
  setCurrentUser: (user: User | null) => void;
  setCurrentRoom: (room: Room | null) => void;
  setRoomMembers: (members: User[]) => void;
  addPeer: (peerId: string, connection: PeerConnection) => void;
  removePeer: (peerId: string) => void;
  updatePeerState: (peerId: string, state: PeerConnection['state']) => void;
  setIceServers: (servers: ICEServer[]) => void;
  setEditorContent: (content: string, version?: number) => void;
  setContentVersion: (version: number) => void;
  updateCursor: (userId: string, cursor: CursorPosition) => void;
  removeCursor: (userId: string) => void;
  updateRemoteCursor: (userId: string, cursor: CursorPosition) => void;
  removeRemoteCursor: (userId: string) => void;
  setVersions: (versions: Version[]) => void;
  addVersion: (version: Version) => void;
  setConnectionStatus: (status: StoreState['connectionStatus']) => void;
  setOnline: (online: boolean) => void;
  addOfflineEdit: (edit: OfflineEdit) => void;
  clearOfflineEdits: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export interface CreateRoomRequest {
  nickname: string;
  roomName?: string;
  password?: string;
}

export interface CreateRoomResponse {
  roomId: string;
  user: User;
  iceServers: ICEServer[];
}

export interface JoinRoomRequest {
  nickname: string;
  roomId: string;
  password?: string;
}

export interface JoinRoomResponse {
  room: Room;
  user: User;
  currentContent: string;
  members: User[];
  iceServers: ICEServer[];
}

export interface SaveVersionRequest {
  content: string;
  message?: string;
  autoSaved?: boolean;
}

export interface SaveVersionResponse {
  version: Version;
}
