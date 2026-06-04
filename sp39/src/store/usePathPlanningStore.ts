import { create } from 'zustand';
import { useSimulationStore, GridSize } from './useSimulationStore';

interface Point {
  x: number;
  y: number;
}

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export interface Robot {
  id: string;
  name: string;
  color: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  path: Point[];
  currentPathIndex: number;
  x: number;
  y: number;
  speed: number;
  active: boolean;
  arrived: boolean;
  trail: Point[];
}

const ROBOT_COLORS = [
  '#00ff88',
  '#ff6b35',
  '#4ecdc4',
  '#ff3366',
  '#ffdd57',
  '#a855f7',
  '#06b6d4',
  '#f97316',
];

function heuristic(a: Point, b: Point): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

function getNeighbors(pos: Point, gridSize: number): Point[] {
  const dirs: Point[] = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 },
  ];
  return dirs
    .map(d => ({ x: pos.x + d.x, y: pos.y + d.y }))
    .filter(p => p.x >= 0 && p.x < gridSize && p.y >= 0 && p.y < gridSize);
}

export function findPath(
  start: Point,
  end: Point,
  obstacles: Uint32Array,
  gridSize: GridSize,
): Point[] {
  const startIdx = Math.floor(start.y) * gridSize + Math.floor(start.x);
  const endIdx = Math.floor(end.y) * gridSize + Math.floor(end.x);

  if (obstacles[startIdx] === 1 || obstacles[endIdx] === 1) {
    return [];
  }

  const sx = Math.floor(start.x);
  const sy = Math.floor(start.y);
  const ex = Math.floor(end.x);
  const ey = Math.floor(end.y);

  if (sx === ex && sy === ey) return [{ x: end.x, y: end.y }];

  const openSet: PathNode[] = [];
  const closedSet = new Set<number>();

  const startNode: PathNode = {
    x: sx, y: sy, g: 0,
    h: heuristic({ x: sx, y: sy }, { x: ex, y: ey }),
    f: 0, parent: null,
  };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  const gScores = new Map<number, number>();
  gScores.set(sy * gridSize + sx, 0);

  const maxIterations = gridSize * gridSize;
  let iterations = 0;

  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;

    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }

    const current = openSet.splice(bestIdx, 1)[0];
    const currentKey = current.y * gridSize + current.x;

    if (current.x === ex && current.y === ey) {
      const path: Point[] = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x + 0.5, y: node.y + 0.5 });
        node = node.parent;
      }
      return smoothPath(path, obstacles, gridSize);
    }

    closedSet.add(currentKey);

    const neighbors = getNeighbors({ x: current.x, y: current.y }, gridSize);
    for (const neighbor of neighbors) {
      const nKey = neighbor.y * gridSize + neighbor.x;
      if (closedSet.has(nKey)) continue;

      if (obstacles[nKey] === 1) continue;

      const isDiagonal = neighbor.x !== current.x && neighbor.y !== current.x;
      if (isDiagonal) {
        const key1 = current.y * gridSize + neighbor.x;
        const key2 = neighbor.y * gridSize + current.x;
        if (obstacles[key1] === 1 || obstacles[key2] === 1) continue;
      }

      const moveCost = isDiagonal ? Math.SQRT2 : 1.0;
      const tentativeG = current.g + moveCost;

      const existingG = gScores.get(nKey);
      if (existingG !== undefined && tentativeG >= existingG) continue;

      gScores.set(nKey, tentativeG);

      const h = heuristic(neighbor, { x: ex, y: ey });
      const node: PathNode = {
        x: neighbor.x, y: neighbor.y,
        g: tentativeG, h, f: tentativeG + h,
        parent: current,
      };

      const existingIdx = openSet.findIndex(n => n.x === neighbor.x && n.y === neighbor.y);
      if (existingIdx >= 0) {
        openSet[existingIdx] = node;
      } else {
        openSet.push(node);
      }
    }
  }

  return [];
}

function smoothPath(path: Point[], obstacles: Uint32Array, gridSize: GridSize): Point[] {
  if (path.length <= 2) return path;

  const smoothed: Point[] = [path[0]];
  let current = 0;

  while (current < path.length - 1) {
    let farthest = current + 1;
    for (let i = path.length - 1; i > current + 1; i--) {
      if (hasLineOfSight(path[current], path[i], obstacles, gridSize)) {
        farthest = i;
        break;
      }
    }
    smoothed.push(path[farthest]);
    current = farthest;
  }

  return smoothed;
}

function hasLineOfSight(a: Point, b: Point, obstacles: Uint32Array, gridSize: GridSize): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(a.x + dx * t);
    const y = Math.floor(a.y + dy * t);

    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return false;
    if (obstacles[y * gridSize + x] === 1) return false;
  }

  return true;
}

export function createRobot(
  id: string,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  index: number,
): Robot {
  return {
    id,
    name: `Robot-${id.slice(0, 4)}`,
    color: ROBOT_COLORS[index % ROBOT_COLORS.length],
    startX,
    startY,
    targetX,
    targetY,
    path: [],
    currentPathIndex: 0,
    x: startX,
    y: startY,
    speed: 1.5,
    active: true,
    arrived: false,
    trail: [],
  };
}

export function updateRobot(robot: Robot, dt: number): Robot {
  if (!robot.active || robot.arrived || robot.path.length === 0) return robot;

  const targetIdx = Math.min(robot.currentPathIndex + 1, robot.path.length - 1);
  const target = robot.path[targetIdx];

  const dx = target.x - robot.x;
  const dy = target.y - robot.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.5) {
    robot.x = target.x;
    robot.y = target.y;
    robot.currentPathIndex = targetIdx;

    if (targetIdx >= robot.path.length - 1) {
      robot.arrived = true;
      return { ...robot, trail: [...robot.trail, { x: robot.x, y: robot.y }].slice(-200) };
    }
  } else {
    const step = robot.speed * dt;
    robot.x += (dx / dist) * Math.min(step, dist);
    robot.y += (dy / dist) * Math.min(step, dist);
  }

  const newTrail = [...robot.trail, { x: robot.x, y: robot.y }].slice(-200);
  return { ...robot, trail: newTrail };
}

interface PathPlanningState {
  mode: 'none' | 'setStart' | 'setTarget';
  robots: Robot[];
  pendingStart: Point | null;
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  isPlayingBack: boolean;
  playbackProgress: number;

  setMode: (mode: 'none' | 'setStart' | 'setTarget') => void;
  addRobot: (robot: Robot) => void;
  removeRobot: (id: string) => void;
  updateRobotState: (id: string, robot: Robot) => void;
  clearRobots: () => void;
  setPendingStart: (point: Point | null) => void;
  setRecording: (recording: boolean) => void;
  setRecordedBlob: (blob: Blob | null) => void;
  setRecordedUrl: (url: string | null) => void;
  setPlayback: (playing: boolean) => void;
  setPlaybackProgress: (progress: number) => void;
}

export const usePathPlanningStore = create<PathPlanningState>((set) => ({
  mode: 'none',
  robots: [],
  pendingStart: null,
  isRecording: false,
  recordedBlob: null,
  recordedUrl: null,
  isPlayingBack: false,
  playbackProgress: 0,

  setMode: (mode) => set({ mode }),
  addRobot: (robot) => set((state) => ({ robots: [...state.robots, robot] })),
  removeRobot: (id) => set((state) => ({ robots: state.robots.filter(r => r.id !== id) })),
  updateRobotState: (id, robot) => set((state) => ({
    robots: state.robots.map(r => r.id === id ? robot : r),
  })),
  clearRobots: () => set({ robots: [] }),
  setPendingStart: (point) => set({ pendingStart: point }),
  setRecording: (recording) => set({ isRecording: recording }),
  setRecordedBlob: (blob) => set({ recordedBlob: blob }),
  setRecordedUrl: (url) => set({ recordedUrl: url }),
  setPlayback: (playing) => set({ isPlayingBack: playing }),
  setPlaybackProgress: (progress) => set({ playbackProgress: progress }),
}));
