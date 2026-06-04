interface AABB {
  min: [number, number, number];
  max: [number, number, number];
}

export interface BVHNode {
  aabbMin: [number, number, number];
  aabbMax: [number, number, number];
  leftFirst: number;
  triCount: number;
}

export interface BVHData {
  nodes: BVHNode[];
  triangleIndices: Uint32Array;
  nodeCount: number;
}

function emptyAABB(): AABB {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

function extendAABB(box: AABB, x: number, y: number, z: number): void {
  if (x < box.min[0]) box.min[0] = x;
  if (y < box.min[1]) box.min[1] = y;
  if (z < box.min[2]) box.min[2] = z;
  if (x > box.max[0]) box.max[0] = x;
  if (y > box.max[1]) box.max[1] = y;
  if (z > box.max[2]) box.max[2] = z;
}

function mergeAABB(a: AABB, b: AABB): AABB {
  return {
    min: [
      Math.min(a.min[0], b.min[0]),
      Math.min(a.min[1], b.min[1]),
      Math.min(a.min[2], b.min[2]),
    ],
    max: [
      Math.max(a.max[0], b.max[0]),
      Math.max(a.max[1], b.max[1]),
      Math.max(a.max[2], b.max[2]),
    ],
  };
}

function aabbSurfaceArea(box: AABB): number {
  const d = [
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2],
  ];
  return 2 * (d[0] * d[1] + d[1] * d[2] + d[2] * d[0]);
}

function aabbArea(box: AABB): number {
  const d = [
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2],
  ];
  return d[1] > d[2] ? (d[0] > d[1] ? 0 : 1) : (d[0] > d[2] ? 0 : 2);
}

interface TriInfo {
  centroid: [number, number, number];
  aabb: AABB;
  triIdx: number;
}

export function buildSAHBVH(
  vertices: Float32Array,
  indices: Uint32Array,
  triangleCount: number
): BVHData {
  const triInfos: TriInfo[] = new Array(triangleCount);
  const triIndices = new Uint32Array(triangleCount);

  for (let i = 0; i < triangleCount; i++) {
    const i0 = indices[i * 3];
    const i1 = indices[i * 3 + 1];
    const i2 = indices[i * 3 + 2];

    const v0x = vertices[i0 * 3], v0y = vertices[i0 * 3 + 1], v0z = vertices[i0 * 3 + 2];
    const v1x = vertices[i1 * 3], v1y = vertices[i1 * 3 + 1], v1z = vertices[i1 * 3 + 2];
    const v2x = vertices[i2 * 3], v2y = vertices[i2 * 3 + 1], v2z = vertices[i2 * 3 + 2];

    const aabb = emptyAABB();
    extendAABB(aabb, v0x, v0y, v0z);
    extendAABB(aabb, v1x, v1y, v1z);
    extendAABB(aabb, v2x, v2y, v2z);

    triInfos[i] = {
      centroid: [
        (v0x + v1x + v2x) / 3,
        (v0y + v1y + v2y) / 3,
        (v0z + v1z + v2z) / 3,
      ],
      aabb,
      triIdx: i,
    };
    triIndices[i] = i;
  }

  const maxNodes = triangleCount * 2 + 1;
  const nodes: BVHNode[] = new Array(maxNodes);
  for (let i = 0; i < maxNodes; i++) {
    nodes[i] = {
      aabbMin: [0, 0, 0],
      aabbMax: [0, 0, 0],
      leftFirst: 0,
      triCount: 0,
    };
  }

  let nodeCount = 0;
  let nodesUsed = 1;

  const rootAABB = emptyAABB();
  for (let i = 0; i < triangleCount; i++) {
    rootAABB.min[0] = Math.min(rootAABB.min[0], triInfos[i].aabb.min[0]);
    rootAABB.min[1] = Math.min(rootAABB.min[1], triInfos[i].aabb.min[1]);
    rootAABB.min[2] = Math.min(rootAABB.min[2], triInfos[i].aabb.min[2]);
    rootAABB.max[0] = Math.max(rootAABB.max[0], triInfos[i].aabb.max[0]);
    rootAABB.max[1] = Math.max(rootAABB.max[1], triInfos[i].aabb.max[1]);
    rootAABB.max[2] = Math.max(rootAABB.max[2], triInfos[i].aabb.max[2]);
  }

  nodes[0].aabbMin = rootAABB.min;
  nodes[0].aabbMax = rootAABB.max;
  nodes[0].leftFirst = 0;
  nodes[0].triCount = triangleCount;
  nodeCount = 1;

  const stack: number[] = [0];

  while (stack.length > 0) {
    const nodeIdx = stack.pop()!;
    const node = nodes[nodeIdx];

    if (node.triCount <= 2) continue;

    const first = node.leftFirst;
    const count = node.triCount;

    const nodeAABB: AABB = {
      min: [...node.aabbMin],
      max: [...node.aabbMax],
    };
    const axis = aabbArea(nodeAABB);
    const area = aabbSurfaceArea(nodeAABB);

    let bestCost = Infinity;
    bestCost = count * area;
    let bestPos = -1;
    let bestAxis = axis;

    for (let a = 0; a < 3; a++) {
      const sortAxis = a;

      const slice = triInfos.slice(first, first + count);
      slice.sort((a, b) => a.centroid[sortAxis] - b.centroid[sortAxis]);
      for (let j = 0; j < slice.length; j++) {
        triInfos[first + j] = slice[j];
      }

      const leftBox = emptyAABB();
      const rightBox = emptyAABB();
      const leftArea = new Float32Array(count);
      const rightArea = new Float32Array(count);

      for (let j = 0; j < count; j++) {
        const tri = triInfos[first + j];
        extendAABB(leftBox, tri.aabb.min[0], tri.aabb.min[1], tri.aabb.min[2]);
        extendAABB(leftBox, tri.aabb.max[0], tri.aabb.max[1], tri.aabb.max[2]);
        leftArea[j] = aabbSurfaceArea(leftBox);
      }

      for (let j = count - 1; j >= 0; j--) {
        const tri = triInfos[first + j];
        extendAABB(rightBox, tri.aabb.min[0], tri.aabb.min[1], tri.aabb.min[2]);
        extendAABB(rightBox, tri.aabb.max[0], tri.aabb.max[1], tri.aabb.max[2]);
        rightArea[j] = aabbSurfaceArea(rightBox);
      }

      for (let j = 0; j < count - 1; j++) {
        const cost = 0.5 + (leftArea[j] * (j + 1) + rightArea[j + 1] * (count - 1 - j)) / area;
        if (cost < bestCost) {
          bestCost = cost;
          bestPos = j + 1;
          bestAxis = sortAxis;
        }
      }
    }

    if (bestPos === -1) continue;

    if (bestAxis !== axis) {
      const slice = triInfos.slice(first, first + count);
      slice.sort((a, b) => a.centroid[bestAxis] - b.centroid[bestAxis]);
      for (let j = 0; j < slice.length; j++) {
        triInfos[first + j] = slice[j];
      }
    }

    const leftCount = bestPos;
    const rightCount = count - leftCount;
    if (leftCount === 0 || rightCount === 0) continue;

    const leftAABB = emptyAABB();
    const rightAABB = emptyAABB();

    for (let j = 0; j < leftCount; j++) {
      const t = triInfos[first + j];
      extendAABB(leftAABB, t.aabb.min[0], t.aabb.min[1], t.aabb.min[2]);
      extendAABB(leftAABB, t.aabb.max[0], t.aabb.max[1], t.aabb.max[2]);
    }
    for (let j = 0; j < rightCount; j++) {
      const t = triInfos[first + leftCount + j];
      extendAABB(rightAABB, t.aabb.min[0], t.aabb.min[1], t.aabb.min[2]);
      extendAABB(rightAABB, t.aabb.max[0], t.aabb.max[1], t.aabb.max[2]);
    }

    const leftChildIdx = nodesUsed++;
    const rightChildIdx = nodesUsed++;

    nodes[leftChildIdx].aabbMin = leftAABB.min;
    nodes[leftChildIdx].aabbMax = leftAABB.max;
    nodes[leftChildIdx].leftFirst = first;
    nodes[leftChildIdx].triCount = leftCount;

    nodes[rightChildIdx].aabbMin = rightAABB.min;
    nodes[rightChildIdx].aabbMax = rightAABB.max;
    nodes[rightChildIdx].leftFirst = first + leftCount;
    nodes[rightChildIdx].triCount = rightCount;

    node.leftFirst = leftChildIdx;
    node.triCount = 0;

    nodeCount = nodesUsed;

    stack.push(leftChildIdx);
    stack.push(rightChildIdx);
  }

  for (let i = 0; i < triangleCount; i++) {
    triIndices[i] = triInfos[i].triIdx;
  }

  const resultNodes = nodes.slice(0, nodeCount);

  return {
    nodes: resultNodes,
    triangleIndices: triIndices,
    nodeCount,
  };
}

export function getBVHGPUData(bvh: BVHData): Float32Array {
  const nodeStride = 8;
  const data = new Float32Array(bvh.nodeCount * nodeStride);

  for (let i = 0; i < bvh.nodeCount; i++) {
    const node = bvh.nodes[i];
    const offset = i * nodeStride;

    data[offset] = node.aabbMin[0];
    data[offset + 1] = node.aabbMin[1];
    data[offset + 2] = node.aabbMin[2];
    data[offset + 3] = node.leftFirst;

    data[offset + 4] = node.aabbMax[0];
    data[offset + 5] = node.aabbMax[1];
    data[offset + 6] = node.aabbMax[2];
    data[offset + 7] = node.triCount;
  }

  return data;
}
