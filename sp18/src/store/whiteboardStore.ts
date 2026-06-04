import { create } from "zustand";
import type { ToolType, DrawOperation, User, CursorData, Layer } from "../../shared/types";
import { generateId } from "../../shared/types";

interface WhiteboardState {
  roomId: string | null;
  userId: string;
  userName: string;
  userColor: string;
  currentTool: ToolType;
  currentColor: string;
  currentLineWidth: number;
  currentFontSize: number;
  currentFontFamily: string;
  operations: DrawOperation[];
  myUndoStack: string[];
  myRedoStack: string[];
  users: User[];
  cursors: Map<string, CursorData>;
  autoCorrect: boolean;
  layers: Layer[];
  activeLayerId: string;

  setRoomId: (roomId: string | null) => void;
  setUserId: (userId: string) => void;
  setUserName: (userName: string) => void;
  setUserColor: (userColor: string) => void;
  setCurrentTool: (tool: ToolType) => void;
  setCurrentColor: (color: string) => void;
  setCurrentLineWidth: (width: number) => void;
  setCurrentFontSize: (size: number) => void;
  setCurrentFontFamily: (font: string) => void;
  setAutoCorrect: (v: boolean) => void;
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  updateCursor: (data: CursorData) => void;
  removeCursor: (userId: string) => void;
  addOperation: (op: DrawOperation) => void;
  setOperations: (ops: DrawOperation[]) => void;
  removeOperationById: (opId: string) => void;
  clearAllOperations: () => void;
  pushMyUndo: (opId: string) => void;
  popMyUndo: () => string | undefined;
  popMyRedo: () => string | undefined;
  getMyUndoCount: () => number;
  getMyRedoCount: () => number;
  setLayers: (layers: Layer[]) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layer: Layer) => void;
  reorderLayers: (layers: Layer[]) => void;
  setActiveLayerId: (layerId: string) => void;
  clearLayerOperations: (layerId: string) => void;
  getSortedOperations: () => DrawOperation[];
}

const USER_COLORS = [
  "#ff6b35",
  "#00c9a7",
  "#845ec2",
  "#d65db1",
  "#ff9671",
  "#ffc75f",
  "#0089ba",
  "#c34a36",
];

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  roomId: null,
  userId: generateId(),
  userName: "",
  userColor: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
  currentTool: "pen",
  currentColor: "#1a1a2e",
  currentLineWidth: 2,
  currentFontSize: 16,
  currentFontFamily: "Inter",
  operations: [],
  myUndoStack: [],
  myRedoStack: [],
  users: [],
  cursors: new Map(),
  autoCorrect: true,
  layers: [],
  activeLayerId: "layer-default",

  setRoomId: (roomId) => set({ roomId }),
  setUserId: (userId) => set({ userId }),
  setUserName: (userName) => set({ userName }),
  setUserColor: (userColor) => set({ userColor }),
  setCurrentTool: (currentTool) => set({ currentTool }),
  setCurrentColor: (currentColor) => set({ currentColor }),
  setCurrentLineWidth: (currentLineWidth) => set({ currentLineWidth }),
  setCurrentFontSize: (currentFontSize) => set({ currentFontSize }),
  setCurrentFontFamily: (currentFontFamily) => set({ currentFontFamily }),
  setAutoCorrect: (autoCorrect) => set({ autoCorrect }),
  setUsers: (users) => set({ users }),
  addUser: (user) => set((s) => ({ users: [...s.users, user] })),
  removeUser: (userId) => set((s) => ({ users: s.users.filter((u) => u.id !== userId) })),
  updateCursor: (data) =>
    set((s) => {
      const newCursors = new Map(s.cursors);
      newCursors.set(data.userId, data);
      return { cursors: newCursors };
    }),
  removeCursor: (userId) =>
    set((s) => {
      const newCursors = new Map(s.cursors);
      newCursors.delete(userId);
      return { cursors: newCursors };
    }),
  addOperation: (op) => set((s) => ({ operations: [...s.operations, op] })),
  setOperations: (ops) => set({ operations: ops }),
  removeOperationById: (opId) =>
    set((s) => ({ operations: s.operations.filter((op) => op.id !== opId) })),
  clearAllOperations: () => set({ operations: [], myUndoStack: [], myRedoStack: [] }),
  pushMyUndo: (opId) => set((s) => ({ myUndoStack: [...s.myUndoStack, opId], myRedoStack: [] })),
  popMyUndo: () => {
    const { myUndoStack } = get();
    if (myUndoStack.length === 0) return undefined;
    const opId = myUndoStack[myUndoStack.length - 1];
    set((s) => ({
      myUndoStack: s.myUndoStack.slice(0, -1),
      myRedoStack: [...s.myRedoStack, opId],
    }));
    return opId;
  },
  popMyRedo: () => {
    const { myRedoStack } = get();
    if (myRedoStack.length === 0) return undefined;
    const opId = myRedoStack[myRedoStack.length - 1];
    set((s) => ({
      myRedoStack: s.myRedoStack.slice(0, -1),
      myUndoStack: [...s.myUndoStack, opId],
    }));
    return opId;
  },
  getMyUndoCount: () => get().myUndoStack.length,
  getMyRedoCount: () => get().myRedoStack.length,
  setLayers: (layers) => set({ layers }),
  addLayer: (layer) => set((s) => ({ layers: [...s.layers, layer] })),
  removeLayer: (layerId) =>
    set((s) => ({
      layers: s.layers.filter((l) => l.id !== layerId),
      operations: s.operations.filter((op) => op.layerId !== layerId),
    })),
  updateLayer: (layer) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === layer.id ? layer : l)),
    })),
  reorderLayers: (layers) => set({ layers }),
  setActiveLayerId: (activeLayerId) => set({ activeLayerId }),
  clearLayerOperations: (layerId) =>
    set((s) => ({
      operations: s.operations.filter((op) => op.layerId !== layerId),
    })),
  getSortedOperations: () => {
    const { layers, operations } = get();
    const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
    const layerZIndex = new Map(layers.map((l, i) => [l.id, i]));
    return operations
      .filter((op) => visibleLayerIds.has(op.layerId))
      .sort((a, b) => (layerZIndex.get(a.layerId) || 0) - (layerZIndex.get(b.layerId) || 0));
  },
}));
