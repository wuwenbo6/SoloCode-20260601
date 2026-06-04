import { create } from 'zustand';
import { KalmanFilter1D } from '@/utils/kalman';
import { trilaterate, type BeaconReading, type Position } from '@/utils/trilateration';
import type { GraphNode, GraphEdge, PathResult, Obstacle } from '@/utils/dijkstra';
import { dijkstra } from '@/utils/dijkstra';

interface BeaconInfo {
  id: number;
  uuid: string;
  name: string;
  x: number;
  y: number;
  floor: number;
  tx_power: number;
  path_loss_exp: number;
  rssi: number | null;
  filteredRssi: number | null;
  distance: number | null;
}

interface RemoteUser {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  floor: number;
}

interface RssiHistoryPoint {
  x: number;
  y: number;
  rssi: number;
  count: number;
}

interface FloorInfo {
  id: number;
  name: string;
  floor_number: number;
  width: number;
  height: number;
}

interface PositionState {
  currentFloor: number;
  floors: FloorInfo[];
  beacons: BeaconInfo[];
  position: Position | null;
  positionHistory: Array<{ x: number; y: number; timestamp: number }>;
  isScanning: boolean;
  simulationMode: boolean;
  simulationInterval: ReturnType<typeof setInterval> | null;

  pathNodes: GraphNode[];
  pathEdges: GraphEdge[];
  obstacles: Obstacle[];
  navigationPath: PathResult | null;
  navigationTarget: { x: number; y: number; name: string } | null;
  highlightedEdgeIds: number[];

  remoteUsers: RemoteUser[];
  localUserId: string | null;
  localUserName: string | null;
  localUserColor: string | null;
  wsConnected: boolean;

  showHeatmap: boolean;
  rssiHistory: Map<string, RssiHistoryPoint>;
  heatmapData: Array<{ x: number; y: number; rssi: number }>;

  fetchFloors: () => Promise<void>;
  setCurrentFloor: (floor: number) => void;
  fetchBeacons: () => Promise<void>;
  startScan: () => void;
  stopScan: () => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  updateBeaconRssi: (uuid: string, rssi: number) => void;
  calculatePosition: () => void;
  setNavigationTarget: (target: { x: number; y: number; name: string } | null) => void;
  calculatePath: (startX: number, startY: number) => void;
  clearNavigation: () => void;
  fetchPathGraph: () => Promise<void>;

  connectWS: () => void;
  disconnectWS: () => void;
  broadcastPosition: () => void;

  toggleHeatmap: () => void;
  addRssiSample: (x: number, y: number, rssi: number) => void;
  generateHeatmap: () => void;
}

let kalmanFilters = new Map<string, KalmanFilter1D>();
let ws: WebSocket | null = null;
let wsBroadcastInterval: ReturnType<typeof setInterval> | null = null;
const rssiHistoryKey = (x: number, y: number) => `${Math.floor(x / 10)},${Math.floor(y / 10)}`;

const usePositionStore = create<PositionState>((set, get) => ({
  currentFloor: 1,
  floors: [],
  beacons: [],
  position: null,
  positionHistory: [],
  isScanning: false,
  simulationMode: false,
  simulationInterval: null,

  pathNodes: [],
  pathEdges: [],
  obstacles: [],
  navigationPath: null,
  navigationTarget: null,
  highlightedEdgeIds: [],

  remoteUsers: [],
  localUserId: null,
  localUserName: null,
  localUserColor: null,
  wsConnected: false,

  showHeatmap: false,
  rssiHistory: new Map(),
  heatmapData: [],

  fetchFloors: async () => {
    try {
      const res = await fetch('/api/floors');
      const json = await res.json();
      if (json.success) {
        set({ floors: json.data });
      }
    } catch (err) {
      console.error('Failed to fetch floors:', err);
    }
  },

  setCurrentFloor: (floor) => {
    set({ currentFloor: floor });
    get().fetchBeacons();
    get().fetchPathGraph();
    set({ navigationPath: null, navigationTarget: null, highlightedEdgeIds: [] });
  },

  fetchBeacons: async () => {
    try {
      const { currentFloor } = get();
      const res = await fetch('/api/beacons/coordinates');
      const json = await res.json();
      if (json.success) {
        const beacons: BeaconInfo[] = json.data
          .filter((b: any) => b.floor === currentFloor)
          .map((b: any) => ({
            id: b.id,
            uuid: b.uuid,
            name: b.name,
            x: b.x,
            y: b.y,
            floor: b.floor,
            tx_power: b.tx_power,
            path_loss_exp: b.path_loss_exp,
            rssi: null,
            filteredRssi: null,
            distance: null,
          }));
        set({ beacons });
      }
    } catch (err) {
      console.error('Failed to fetch beacons:', err);
    }
  },

  startScan: () => {
    set({ isScanning: true });
  },

  stopScan: () => {
    set({ isScanning: false });
  },

  startSimulation: () => {
    const { simulationInterval } = get();
    if (simulationInterval) clearInterval(simulationInterval);

    const interval = setInterval(() => {
      const { beacons, currentFloor, updateBeaconRssi, calculatePosition, position } = get();
      beacons.forEach((b) => {
        if (b.floor === currentFloor) {
          const baseRssi = -45 - Math.random() * 35;
          const rssi = Math.round(baseRssi);
          updateBeaconRssi(b.uuid, rssi);
        }
      });
      calculatePosition();
      if (position) {
        const filtered = Array.from(get().rssiHistory.values())[0];
        if (filtered) {
          get().addRssiSample(position.x, position.y, filtered.rssi);
        }
      }
    }, 1500);

    set({ simulationMode: true, simulationInterval: interval, isScanning: true });
  },

  stopSimulation: () => {
    const { simulationInterval } = get();
    if (simulationInterval) clearInterval(simulationInterval);
    set({ simulationMode: false, simulationInterval: null, isScanning: false });
  },

  updateBeaconRssi: (uuid: string, rssi: number) => {
    const { beacons } = get();
    const beacon = beacons.find((b) => b.uuid === uuid);
    if (!beacon) return;

    let filter = kalmanFilters.get(uuid);
    if (!filter) {
      filter = new KalmanFilter1D(0.125, 4.0, rssi);
      kalmanFilters.set(uuid, filter);
    }
    const filteredRssi = filter.update(rssi);
    const distance = Math.pow(10, (beacon.tx_power - filteredRssi) / (10 * beacon.path_loss_exp));

    set({
      beacons: beacons.map((b) =>
        b.uuid === uuid ? { ...b, rssi, filteredRssi, distance } : b
      ),
    });
  },

  calculatePosition: () => {
    const { beacons, position, positionHistory, currentFloor } = get();
    const readings: BeaconReading[] = beacons
      .filter((b) => b.filteredRssi !== null && b.floor === currentFloor)
      .map((b) => ({
        uuid: b.uuid,
        rssi: b.filteredRssi!,
        x: b.x,
        y: b.y,
        txPower: b.tx_power,
        pathLossExp: b.path_loss_exp,
      }));

    const newPosition = trilaterate(readings);
    if (!newPosition) return;

    let smoothedPosition = newPosition;
    if (position) {
      const alpha = 0.4;
      smoothedPosition = {
        x: alpha * newPosition.x + (1 - alpha) * position.x,
        y: alpha * newPosition.y + (1 - alpha) * position.y,
        accuracy: newPosition.accuracy,
      };
    }

    const newHistory = [
      ...positionHistory,
      { x: smoothedPosition.x, y: smoothedPosition.y, timestamp: Date.now() },
    ].slice(-50);

    const activeBeacons = readings.slice(0, 3);
    if (activeBeacons.length > 0) {
      const avgRssi = activeBeacons.reduce((s, r) => s + r.rssi, 0) / activeBeacons.length;
      get().addRssiSample(smoothedPosition.x, smoothedPosition.y, avgRssi);
    }

    set({ position: smoothedPosition, positionHistory: newHistory });
  },

  setNavigationTarget: (target) => {
    set({ navigationTarget: target });
  },

  calculatePath: (startX: number, startY: number) => {
    const { pathNodes, pathEdges, obstacles, navigationTarget, currentFloor } = get();
    if (!navigationTarget || pathNodes.length === 0) return;

    const activeNodes = pathNodes.filter(n => !n.blocked && n.floor === currentFloor);
    if (activeNodes.length === 0) return;

    let closestStart = activeNodes[0];
    let minStartDist = Infinity;
    activeNodes.forEach((n) => {
      const d = Math.sqrt((n.x - startX) ** 2 + (n.y - startY) ** 2);
      if (d < minStartDist) {
        minStartDist = d;
        closestStart = n;
      }
    });

    let closestEnd = activeNodes[0];
    let minEndDist = Infinity;
    activeNodes.forEach((n) => {
      const d = Math.sqrt((n.x - navigationTarget.x) ** 2 + (n.y - navigationTarget.y) ** 2);
      if (d < minEndDist) {
        minEndDist = d;
        closestEnd = n;
      }
    });

    const result = dijkstra(pathNodes, pathEdges, closestStart.id, closestEnd.id, obstacles);
    if (result) {
      set({
        navigationPath: result,
        highlightedEdgeIds: result.edgeIds,
      });
    } else {
      set({
        navigationPath: null,
        highlightedEdgeIds: [],
      });
    }
  },

  clearNavigation: () => {
    set({ navigationPath: null, navigationTarget: null, highlightedEdgeIds: [] });
  },

  fetchPathGraph: async () => {
    try {
      const { currentFloor } = get();
      const res = await fetch(`/api/path-graph?floor=${currentFloor}`);
      const json = await res.json();
      if (json.success) {
        const nodes = json.data.nodes.map((n: any) => ({
          ...n,
          blocked: !!n.blocked,
        }));
        const edges = json.data.edges.map((e: any) => ({
          ...e,
          blocked: !!e.blocked,
        }));
        set({
          pathNodes: nodes,
          pathEdges: edges,
          obstacles: json.data.obstacles || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch path graph:', err);
    }
  },

  connectWS: () => {
    if (ws) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      ws = new WebSocket(`${protocol}//${host}:3001/ws`);

      ws.onopen = () => {
        set({ wsConnected: true });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'init') {
            set({
              localUserId: data.userId,
              localUserName: data.name,
              localUserColor: data.color,
              remoteUsers: data.users || [],
            });
          } else if (data.type === 'position') {
            const { remoteUsers } = get();
            const idx = remoteUsers.findIndex((u) => u.userId === data.userId);
            if (idx >= 0) {
              const newUsers = [...remoteUsers];
              newUsers[idx] = { ...newUsers[idx], x: data.x, y: data.y, floor: data.floor };
              set({ remoteUsers: newUsers });
            } else {
              set({
                remoteUsers: [...remoteUsers, {
                  userId: data.userId,
                  name: data.name,
                  color: data.color,
                  x: data.x,
                  y: data.y,
                  floor: data.floor,
                }],
              });
            }
          } else if (data.type === 'user_join') {
            const { remoteUsers } = get();
            if (!remoteUsers.find(u => u.userId === data.userId)) {
              set({
                remoteUsers: [...remoteUsers, {
                  userId: data.userId,
                  name: data.name,
                  color: data.color,
                  x: 0,
                  y: 0,
                  floor: 1,
                }],
              });
            }
          } else if (data.type === 'user_leave') {
            const { remoteUsers } = get();
            set({ remoteUsers: remoteUsers.filter(u => u.userId !== data.userId) });
          }
        } catch (err) {
          console.error('WS message parse error:', err);
        }
      };

      ws.onclose = () => {
        set({ wsConnected: false, remoteUsers: [] });
        ws = null;
        if (wsBroadcastInterval) {
          clearInterval(wsBroadcastInterval);
          wsBroadcastInterval = null;
        }
      };

      wsBroadcastInterval = setInterval(() => {
        const { position, currentFloor, wsConnected } = get();
        if (ws && wsConnected && position) {
          ws.send(JSON.stringify({
            type: 'position',
            x: position.x,
            y: position.y,
            floor: currentFloor,
          }));
        }
      }, 2000);
    } catch (err) {
      console.error('WS connection error:', err);
    }
  },

  disconnectWS: () => {
    if (wsBroadcastInterval) {
      clearInterval(wsBroadcastInterval);
      wsBroadcastInterval = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    set({ wsConnected: false, remoteUsers: [], localUserId: null, localUserName: null, localUserColor: null });
  },

  broadcastPosition: () => {
  },

  toggleHeatmap: () => {
    const { showHeatmap } = get();
    if (!showHeatmap) {
      get().generateHeatmap();
    }
    set({ showHeatmap: !showHeatmap });
  },

  addRssiSample: (x: number, y: number, rssi: number) => {
    const { rssiHistory } = get();
    const key = rssiHistoryKey(x, y);
    const existing = rssiHistory.get(key);
    if (existing) {
      existing.count++;
      existing.rssi = existing.rssi + (rssi - existing.rssi) / existing.count;
    } else {
      rssiHistory.set(key, { x, y, rssi, count: 1 });
    }
  },

  generateHeatmap: () => {
    const { rssiHistory, beacons, currentFloor } = get();
    const floorBeacons = beacons.filter(b => b.floor === currentFloor);
    const points: Array<{ x: number; y: number; rssi: number }> = [];

    for (let x = 25; x <= 575; x += 20) {
      for (let y = 25; y <= 475; y += 20) {
        let avgRssi = -90;
        let totalWeight = 0;

        floorBeacons.forEach((beacon) => {
          const dist = Math.sqrt((beacon.x - x) ** 2 + (beacon.y - y) ** 2);
          const weight = 1 / Math.max(dist, 10);
          const estRssi = beacon.tx_power - 10 * beacon.path_loss_exp * Math.log10(Math.max(dist / 100, 0.01));
          avgRssi += weight * Math.max(estRssi, -90);
          totalWeight += weight;
        });

        rssiHistory.forEach((sample) => {
          const dist = Math.sqrt((sample.x - x) ** 2 + (sample.y - y) ** 2);
          if (dist < 60) {
            const weight = sample.count * 3 / Math.max(dist, 5);
            avgRssi += weight * sample.rssi;
            totalWeight += weight;
          }
        });

        if (totalWeight > 0) {
          avgRssi = avgRssi / totalWeight;
        }

        points.push({ x, y, rssi: Math.min(Math.max(avgRssi, -90), -30) });
      }
    }

    set({ heatmapData: points });
  },
}));

export default usePositionStore;
export type { BeaconInfo, PositionState, RemoteUser, FloorInfo };
