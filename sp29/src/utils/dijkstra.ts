interface GraphNode {
  id: number;
  name: string;
  x: number;
  y: number;
  floor: number;
  blocked?: boolean;
}

interface GraphEdge {
  id: number;
  from_node_id: number;
  to_node_id: number;
  weight: number;
  blocked?: boolean;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  floor: number;
}

interface PathResult {
  path: GraphNode[];
  distance: number;
  edgeIds: number[];
}

function pointInRect(px: number, py: number, obs: Obstacle): boolean {
  return px >= obs.x && px <= obs.x + obs.width && py >= obs.y && py <= obs.y + obs.height;
}

function segmentIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  obs: Obstacle
): boolean {
  if (pointInRect(x1, y1, obs) || pointInRect(x2, y2, obs)) return true;

  const left = obs.x;
  const right = obs.x + obs.width;
  const top = obs.y;
  const bottom = obs.y + obs.height;

  const edges: Array<[[number, number], [number, number]]> = [
    [[left, top], [right, top]],
    [[right, top], [right, bottom]],
    [[right, bottom], [left, bottom]],
    [[left, bottom], [left, top]],
  ];

  for (const [[ax, ay], [bx, by]] of edges) {
    if (segmentsIntersect(x1, y1, x2, y2, ax, ay, bx, by)) return true;
  }
  return false;
}

function segmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const d1 = cross(x3, y3, x4, y4, x1, y1);
  const d2 = cross(x3, y3, x4, y4, x2, y2);
  const d3 = cross(x1, y1, x2, y2, x3, y3);
  const d4 = cross(x1, y1, x2, y2, x4, y4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(x3, y3, x4, y4, x1, y1)) return true;
  if (d2 === 0 && onSegment(x3, y3, x4, y4, x2, y2)) return true;
  if (d3 === 0 && onSegment(x1, y1, x2, y2, x3, y3)) return true;
  if (d4 === 0 && onSegment(x1, y1, x2, y2, x4, y4)) return true;

  return false;
}

function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function onSegment(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number
): boolean {
  return Math.min(ax, bx) <= cx && cx <= Math.max(ax, bx) &&
         Math.min(ay, by) <= cy && cy <= Math.max(ay, by);
}

export function dijkstra(
  nodes: GraphNode[],
  edges: GraphEdge[],
  startNodeId: number,
  endNodeId: number,
  obstacles: Obstacle[] = []
): PathResult | null {
  const nodeMap = new Map<number, GraphNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const activeNodes = nodes.filter(n => !n.blocked);
  const activeNodeIds = new Set(activeNodes.map(n => n.id));

  const adj = new Map<number, Array<{ to: number; weight: number; edgeId: number }>>();
  activeNodes.forEach(n => adj.set(n.id, []));

  edges.forEach(e => {
    if (e.blocked) return;
    if (!activeNodeIds.has(e.from_node_id) || !activeNodeIds.has(e.to_node_id)) return;

    const fromNode = nodeMap.get(e.from_node_id);
    const toNode = nodeMap.get(e.to_node_id);
    if (!fromNode || !toNode) return;

    const blockedByObstacle = obstacles.some(obs =>
      segmentIntersectsRect(fromNode.x, fromNode.y, toNode.x, toNode.y, obs)
    );
    if (blockedByObstacle) return;

    adj.get(e.from_node_id)?.push({ to: e.to_node_id, weight: e.weight, edgeId: e.id });
    adj.get(e.to_node_id)?.push({ to: e.from_node_id, weight: e.weight, edgeId: e.id });
  });

  const dist = new Map<number, number>();
  const prev = new Map<number, { nodeId: number; edgeId: number } | null>();
  const visited = new Set<number>();

  activeNodes.forEach(n => {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  });
  dist.set(startNodeId, 0);

  while (true) {
    let minDist = Infinity;
    let u = -1;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minDist) {
        minDist = d;
        u = id;
      }
    }
    if (u === -1 || u === endNodeId) break;
    visited.add(u);

    for (const edge of adj.get(u) || []) {
      if (visited.has(edge.to)) continue;
      const alt = minDist + edge.weight;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, { nodeId: u, edgeId: edge.edgeId });
      }
    }
  }

  if (dist.get(endNodeId) === Infinity) return null;

  const pathNodes: GraphNode[] = [];
  const edgeIds: number[] = [];
  let current: number | null = endNodeId;
  while (current !== null) {
    pathNodes.unshift(nodeMap.get(current)!);
    const p = prev.get(current);
    if (p) {
      edgeIds.unshift(p.edgeId);
      current = p.nodeId;
    } else {
      current = null;
    }
  }

  return { path: pathNodes, distance: dist.get(endNodeId)!, edgeIds };
}

export type { GraphNode, GraphEdge, PathResult, Obstacle };
