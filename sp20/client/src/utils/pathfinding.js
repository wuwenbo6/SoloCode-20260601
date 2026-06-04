class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(item, priority) {
    const element = { item, priority };
    let low = 0;
    let high = this.items.length;
    
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.items[mid].priority < element.priority) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    this.items.splice(low, 0, element);
  }

  dequeue() {
    const first = this.items.shift();
    return first && first.item;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  clear() {
    this.items = [];
  }
}

const heuristic = (nodeA, nodeB) => {
  return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.z - nodeB.z);
};

const euclideanDistance = (nodeA, nodeB) => {
  const dx = nodeA.x - nodeB.x;
  const dz = nodeA.z - nodeB.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const findPath = (navmesh, startPos, endPos, collisionManager = null) => {
  const { nodes, edges } = navmesh;
  
  if (!nodes || nodes.length === 0) return [];

  const findNearestNode = (pos) => {
    let nearest = nodes[0];
    let minDist = Infinity;
    
    for (const node of nodes) {
      const dist = Math.sqrt(Math.pow(node.x - pos.x, 2) + Math.pow(node.z - pos.z, 2));
      if (dist < minDist) {
        if (collisionManager && collisionManager.bvh) {
          const collision = collisionManager.checkLineCollision(
            { x: pos.x, y: pos.y || 1.6, z: pos.z },
            { x: node.x, y: pos.y || 1.6, z: node.z },
            0.3
          );
          if (collision) continue;
        }
        minDist = dist;
        nearest = node;
      }
    }
    return nearest;
  };

  const startNode = findNearestNode(startPos);
  const endNode = findNearestNode(endPos);

  if (startNode.id === endNode.id) {
    return [startNode];
  }

  const openSet = new PriorityQueue();
  openSet.enqueue(startNode.id, 0);

  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  const closedSet = new Set();

  gScore.set(startNode.id, 0);
  fScore.set(startNode.id, heuristic(startNode, endNode));

  const neighbors = new Map();
  for (const node of nodes) {
    neighbors.set(node.id, []);
  }
  for (const [a, b] of edges) {
    neighbors.get(a)?.push(b);
    neighbors.get(b)?.push(a);
  }

  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  let iterations = 0;
  const maxIterations = nodes.length * 2;

  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    const currentId = openSet.dequeue();
    
    if (closedSet.has(currentId)) continue;
    closedSet.add(currentId);
    
    if (currentId === endNode.id) {
      const path = [];
      let curr = currentId;
      while (curr !== undefined) {
        path.unshift(nodeMap.get(curr));
        curr = cameFrom.get(curr);
      }
      
      return optimizePath(path, startPos, endPos, collisionManager);
    }

    const currentNode = nodeMap.get(currentId);
    const currentNeighbors = neighbors.get(currentId) || [];

    for (const neighborId of currentNeighbors) {
      if (closedSet.has(neighborId)) continue;

      const neighborNode = nodeMap.get(neighborId);
      
      let edgeCost = euclideanDistance(currentNode, neighborNode);
      
      if (collisionManager && collisionManager.bvh) {
        const collision = collisionManager.checkLineCollision(
          { x: currentNode.x, y: startPos.y || 1.6, z: currentNode.z },
          { x: neighborNode.x, y: startPos.y || 1.6, z: neighborNode.z },
          0.3
        );
        if (collision) {
          edgeCost *= 100;
        }
      }

      const tentativeGScore = (gScore.get(currentId) || Infinity) + edgeCost;

      if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeGScore);
        fScore.set(neighborId, tentativeGScore + heuristic(neighborNode, endNode));
        openSet.enqueue(neighborId, fScore.get(neighborId));
      }
    }
  }

  console.warn(`Pathfinding failed after ${iterations} iterations`);
  return [];
};

const optimizePath = (path, startPos, endPos, collisionManager = null) => {
  if (path.length < 3) return path;

  let optimized = [path[0]];
  let i = 0;

  while (i < path.length - 1) {
    let farthestReachable = i + 1;
    
    for (let j = path.length - 1; j > i; j--) {
      if (collisionManager && collisionManager.bvh) {
        const collision = collisionManager.checkLineCollision(
          { x: path[i].x, y: startPos.y || 1.6, z: path[i].z },
          { x: path[j].x, y: startPos.y || 1.6, z: path[j].z },
          0.4
        );
        if (!collision) {
          farthestReachable = j;
          break;
        }
      } else {
        farthestReachable = j;
        break;
      }
    }
    
    optimized.push(path[farthestReachable]);
    i = farthestReachable;
  }

  return optimized;
};

export const smoothPath = (path, iterations = 3) => {
  if (path.length < 3) return path;

  let smoothed = [...path];
  
  for (let iter = 0; iter < iterations; iter++) {
    const newSmoothed = [smoothed[0]];
    
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = newSmoothed[newSmoothed.length - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];
      
      const midX = (prev.x + curr.x + next.x) / 3;
      const midZ = (prev.z + curr.z + next.z) / 3;
      
      const tension = 0.3;
      const smoothedX = curr.x * (1 - tension) + midX * tension;
      const smoothedZ = curr.z * (1 - tension) + midZ * tension;
      
      newSmoothed.push({ ...curr, x: smoothedX, z: smoothedZ });
    }
    
    newSmoothed.push(smoothed[smoothed.length - 1]);
    smoothed = newSmoothed;
  }

  return smoothed;
};

export const generateDensePath = (path, stepSize = 0.2) => {
  if (path.length < 2) return path;

  const densePath = [path[0]];
  
  for (let i = 1; i < path.length; i++) {
    const prev = densePath[densePath.length - 1];
    const curr = path[i];
    
    const dx = curr.x - prev.x;
    const dz = curr.z - prev.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist < stepSize) {
      densePath.push(curr);
      continue;
    }
    
    const steps = Math.ceil(dist / stepSize);
    const stepX = dx / steps;
    const stepZ = dz / steps;
    
    for (let j = 1; j <= steps; j++) {
      densePath.push({
        ...curr,
        x: prev.x + stepX * j,
        z: prev.z + stepZ * j
      });
    }
  }

  return densePath;
};

export const simplifyPath = (path, tolerance = 0.1) => {
  if (path.length < 3) return path;

  const result = [path[0]];
  let lastKept = 0;

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[lastKept];
    const curr = path[i];
    const next = path[i + 1];
    
    const cross = Math.abs(
      (curr.x - prev.x) * (next.z - prev.z) -
      (curr.z - prev.z) * (next.x - prev.x)
    );
    
    if (cross > tolerance) {
      result.push(curr);
      lastKept = i;
    }
  }

  result.push(path[path.length - 1]);
  return result;
};
