import {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  SaveVersionRequest,
  SaveVersionResponse,
  Version,
  Room,
  ICEServer,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = {
  async createRoom(data: CreateRoomRequest): Promise<CreateRoomResponse> {
    const response = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to create room');
    }
    return result.data;
  },

  async joinRoom(roomId: string, data: JoinRoomRequest): Promise<JoinRoomResponse> {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to join room');
    }
    return result.data;
  },

  async getRoom(roomId: string): Promise<Room> {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get room');
    }
    return result.data.room;
  },

  async getVersions(roomId: string, page = 1, limit = 20): Promise<{ versions: Version[]; pagination: any }> {
    const response = await fetch(
      `${API_BASE_URL}/rooms/${roomId}/versions?page=${page}&limit=${limit}`
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get versions');
    }
    return result.data;
  },

  async getVersion(roomId: string, versionId: string): Promise<Version> {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/versions/${versionId}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get version');
    }
    return result.data.version;
  },

  async saveVersion(
    roomId: string,
    userId: string,
    data: SaveVersionRequest
  ): Promise<SaveVersionResponse> {
    const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/versions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to save version');
    }
    return result.data;
  },

  async restoreVersion(
    roomId: string,
    versionId: string,
    userId: string
  ): Promise<Version> {
    const response = await fetch(
      `${API_BASE_URL}/rooms/${roomId}/versions/${versionId}/restore`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
      }
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to restore version');
    }
    return result.data.version;
  },

  async getIceServers(): Promise<ICEServer[]> {
    const response = await fetch(`${API_BASE_URL}/rooms/ice-servers`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to get ICE servers');
    }
    return result.data.iceServers;
  },
};
