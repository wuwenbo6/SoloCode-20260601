export interface Point {
  x: number;
  y: number;
}

export type ToolType = "pen" | "rect" | "circle" | "line" | "eraser" | "text";

export type CorrectedShapeType = "circle" | "rectangle" | "triangle";

export interface CorrectedShape {
  type: CorrectedShapeType;
  center: Point;
  radius?: number;
  width?: number;
  height?: number;
  vertices?: Point[];
}

export interface TextData {
  content: string;
  fontSize: number;
  fontFamily: string;
}

export interface DrawOperation {
  id: string;
  type: ToolType;
  userId: string;
  roomId: string;
  layerId: string;
  points: Point[];
  color: string;
  lineWidth: number;
  timestamp: number;
  corrected?: CorrectedShape;
  text?: TextData;
}

export interface Layer {
  id: string;
  name: string;
  userId: string;
  visible: boolean;
  zIndex: number;
  createdAt: number;
}

export interface CursorData {
  userId: string;
  roomId: string;
  x: number;
  y: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
}

export interface ClientToServerEvents {
  "room:create": () => void;
  "room:join": (roomId: string) => void;
  "room:leave": (roomId: string) => void;
  "draw:operation": (op: DrawOperation) => void;
  "cursor:move": (data: CursorData) => void;
  "canvas:clear": (roomId: string) => void;
  "undo:operation": (roomId: string, opId: string) => void;
  "redo:operation": (roomId: string, op: DrawOperation) => void;
  "layer:create": (roomId: string, layer: Layer) => void;
  "layer:delete": (roomId: string, layerId: string) => void;
  "layer:update": (roomId: string, layer: Layer) => void;
  "layer:reorder": (roomId: string, layers: Layer[]) => void;
  "layer:clear": (roomId: string, layerId: string) => void;
}

export interface ServerToClientEvents {
  "room:created": (roomId: string) => void;
  "room:joined": (roomId: string, users: User[], operations: DrawOperation[], layers: Layer[]) => void;
  "room:userJoined": (user: User) => void;
  "room:userLeft": (userId: string) => void;
  "draw:broadcast": (op: DrawOperation) => void;
  "cursor:broadcast": (data: CursorData) => void;
  "canvas:cleared": () => void;
  "undo:broadcast": (opId: string) => void;
  "layer:created": (layer: Layer) => void;
  "layer:deleted": (layerId: string) => void;
  "layer:updated": (layer: Layer) => void;
  "layer:reordered": (layers: Layer[]) => void;
  "layer:cleared": (layerId: string) => void;
  "error": (message: string) => void;
}

export const USER_COLORS = [
  "#ff6b35",
  "#00c9a7",
  "#845ec2",
  "#d65db1",
  "#ff9671",
  "#ffc75f",
  "#0089ba",
  "#c34a36",
];

export const AVAILABLE_FONTS = [
  "Inter",
  "Noto Sans SC",
  "JetBrains Mono",
  "Georgia",
  "Courier New",
];

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
