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

export interface SyncMessage {
  type: 'text' | 'cursor' | 'selection';
  userId: string;
  data: any;
  timestamp: number;
}

export interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'sync' | 'content-request' | 'content-response';
  from: string;
  to?: string;
  roomId: string;
  data: any;
  timestamp?: number;
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

export interface RoomState {
  roomId: string;
  members: Map<string, {
    user: User;
    socketId: string;
    connected: boolean;
  }>;
  currentContent: string;
  contentVersion: number;
  lastUpdate: number;
}
