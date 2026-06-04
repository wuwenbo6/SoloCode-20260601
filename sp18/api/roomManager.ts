import type { User, DrawOperation, Layer } from "../shared/types.js";

export interface RoomState {
  id: string;
  creatorId: string;
  users: Map<string, User>;
  operations: DrawOperation[];
  layers: Layer[];
  createdAt: number;
}

const rooms = new Map<string, RoomState>();

export function createRoom(creatorId: string, creator: User): string {
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const defaultLayer: Layer = {
    id: "layer-default",
    name: "图层 1",
    userId: creatorId,
    visible: true,
    zIndex: 0,
    createdAt: Date.now(),
  };
  const room: RoomState = {
    id: roomId,
    creatorId,
    users: new Map([[creatorId, creator]]),
    operations: [],
    layers: [defaultLayer],
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  return roomId;
}

export function joinRoom(roomId: string, userId: string, user: User): RoomState | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.users.set(userId, user);
  return room;
}

export function leaveRoom(roomId: string, userId: string): RoomState | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.users.delete(userId);
  if (room.users.size === 0) {
    rooms.delete(roomId);
  }
  return room;
}

export function getRoom(roomId: string): RoomState | null {
  return rooms.get(roomId) ?? null;
}

export function addOperation(roomId: string, op: DrawOperation): void {
  const room = rooms.get(roomId);
  if (room) {
    room.operations.push(op);
  }
}

export function removeOperationByUser(roomId: string, opId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  const op = room.operations.find((o) => o.id === opId);
  if (!op || op.userId !== userId) return false;
  room.operations = room.operations.filter((o) => o.id !== opId);
  return true;
}

export function clearOperations(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.operations = [];
  }
}

export function clearLayerOperations(roomId: string, layerId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.operations = room.operations.filter((op) => op.layerId !== layerId);
  }
}

export function addLayer(roomId: string, layer: Layer): void {
  const room = rooms.get(roomId);
  if (room) {
    room.layers.push(layer);
  }
}

export function removeLayerByUser(roomId: string, layerId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  const layer = room.layers.find((l) => l.id === layerId);
  if (!layer || layer.userId !== userId) return false;
  if (room.layers.length <= 1) return false;
  room.layers = room.layers.filter((l) => l.id !== layerId);
  room.operations = room.operations.filter((op) => op.layerId !== layerId);
  return true;
}

export function updateLayer(roomId: string, layer: Layer, userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  const idx = room.layers.findIndex((l) => l.id === layer.id && l.userId === userId);
  if (idx === -1) return false;
  room.layers[idx] = layer;
  return true;
}

export function reorderLayers(roomId: string, layers: Layer[], userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  const userLayers = layers.filter((l) => l.userId === userId);
  const otherLayers = room.layers.filter((l) => l.userId !== userId);
  room.layers = [...otherLayers, ...userLayers];
  return true;
}
