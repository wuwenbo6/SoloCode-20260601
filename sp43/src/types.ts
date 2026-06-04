export const GRID_SIZE = 128;
export const PARTICLE_COUNT = GRID_SIZE * GRID_SIZE;
export const CELL_COUNT = (GRID_SIZE - 1) * (GRID_SIZE - 1);

export const SPRING_TYPE = {
  STRUCTURAL: 0,
  SHEAR: 1,
  BEND: 2,
} as const;

export const MOUSE_MODE = {
  DRAG: 0,
  TEAR: 1,
  FORCE: 2,
} as const;

export type MouseMode = typeof MOUSE_MODE[keyof typeof MOUSE_MODE];

export interface Particle {
  position: [number, number, number];
  prevPosition: [number, number, number];
  predictPosition: [number, number, number];
  mass: number;
  invMass: number;
  pinned: number;
}

export interface Spring {
  a: number;
  b: number;
  restLength: number;
  compliance: number;
  type: number;
  broken: number;
  tension: number;
  breakThreshold: number;
}

export interface SimParams {
  structCompliance: number;
  shearCompliance: number;
  bendCompliance: number;
  damping: number;
  gravity: [number, number, number];
  deltaTime: number;
  numParticles: number;
  numSprings: number;
  globalBreakThreshold: number;
  subSteps: number;
}

export interface WindParams {
  strength: number;
  time: number;
  frequency: number;
  direction: [number, number, number];
}

export interface MouseInteraction {
  mode: number;
  active: number;
  particleIndex: number;
  radius: number;
  worldPos: [number, number, number];
  force: [number, number, number];
}

export interface SphereCollider {
  position: [number, number, number];
  radius: number;
}

export interface SelfCollisionParams {
  thickness: number;
  stiffness: number;
  enabled: number;
}

export interface Camera {
  viewProj: Float32Array;
  position: [number, number, number];
}

export const PARTICLE_SIZE = 64;
export const SPRING_SIZE = 32;
export const SIM_PARAMS_SIZE = 48;
export const WIND_PARAMS_SIZE = 32;
export const MOUSE_INTERACTION_SIZE = 48;
export const CAMERA_SIZE = 80;
export const RENDER_PARAMS_SIZE = 16;
export const SPHERE_SIZE = 16;
export const MAX_SPHERES = 8;
export const SELF_COLLISION_SIZE = 16;

export function getParticleIndex(x: number, y: number): number {
  return y * GRID_SIZE + x;
}

export function createParticles(): Float32Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(PARTICLE_COUNT * PARTICLE_SIZE);
  const data = new Float32Array(buffer) as Float32Array<ArrayBuffer>;
  const spacing = 8 / (GRID_SIZE - 1);

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = getParticleIndex(x, y);
      const offset = idx * (PARTICLE_SIZE / 4);

      const px = (x - GRID_SIZE / 2) * spacing;
      const py = 5;
      const pz = (y - GRID_SIZE / 2) * spacing;

      data[offset + 0] = px;
      data[offset + 1] = py;
      data[offset + 2] = pz;

      data[offset + 4] = px;
      data[offset + 5] = py - 0.01;
      data[offset + 6] = pz;

      data[offset + 8] = px;
      data[offset + 9] = py - 0.01;
      data[offset + 10] = pz;

      data[offset + 11] = 1.0;
      data[offset + 12] = 1.0;

      const uintView = new Uint32Array(buffer, (offset + 13) * 4, 1);
      uintView[0] = 0;
    }
  }

  return data;
}

export function createSprings(): { data: Float32Array<ArrayBuffer>; count: number; structCount: number } {
  const structSprings: Spring[] = [];
  const shearSprings: Spring[] = [];
  const bendSprings: Spring[] = [];

  const spacing = 8 / (GRID_SIZE - 1);

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE - 1; x++) {
      const i = getParticleIndex(x, y);
      structSprings.push({
        a: i,
        b: getParticleIndex(x + 1, y),
        restLength: spacing,
        compliance: 0.00001,
        type: SPRING_TYPE.STRUCTURAL,
        broken: 0,
        tension: 0,
        breakThreshold: 3.0,
      });
    }
  }

  for (let y = 0; y < GRID_SIZE - 1; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = getParticleIndex(x, y);
      structSprings.push({
        a: i,
        b: getParticleIndex(x, y + 1),
        restLength: spacing,
        compliance: 0.00001,
        type: SPRING_TYPE.STRUCTURAL,
        broken: 0,
        tension: 0,
        breakThreshold: 3.0,
      });
    }
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const i = getParticleIndex(x, y);

      if (x < GRID_SIZE - 1 && y < GRID_SIZE - 1) {
        shearSprings.push({
          a: i,
          b: getParticleIndex(x + 1, y + 1),
          restLength: spacing * Math.SQRT2,
          compliance: 0.0001,
          type: SPRING_TYPE.SHEAR,
          broken: 0,
          tension: 0,
          breakThreshold: 4.0,
        });
        shearSprings.push({
          a: getParticleIndex(x + 1, y),
          b: getParticleIndex(x, y + 1),
          restLength: spacing * Math.SQRT2,
          compliance: 0.0001,
          type: SPRING_TYPE.SHEAR,
          broken: 0,
          tension: 0,
          breakThreshold: 4.0,
        });
      }

      if (x < GRID_SIZE - 2) {
        bendSprings.push({
          a: i,
          b: getParticleIndex(x + 2, y),
          restLength: spacing * 2,
          compliance: 0.001,
          type: SPRING_TYPE.BEND,
          broken: 0,
          tension: 0,
          breakThreshold: 5.0,
        });
      }
      if (y < GRID_SIZE - 2) {
        bendSprings.push({
          a: i,
          b: getParticleIndex(x, y + 2),
          restLength: spacing * 2,
          compliance: 0.001,
          type: SPRING_TYPE.BEND,
          broken: 0,
          tension: 0,
          breakThreshold: 5.0,
        });
      }
    }
  }

  const springs = [...structSprings, ...shearSprings, ...bendSprings];
  const structCount = structSprings.length;

  const buffer = new ArrayBuffer(springs.length * SPRING_SIZE);
  const data = new Float32Array(buffer) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < springs.length; i++) {
    const s = springs[i];
    const offset = i * (SPRING_SIZE / 4);

    const view = new Uint32Array(buffer, offset * 4, SPRING_SIZE / 4);
    view[0] = s.a;
    view[1] = s.b;
    data[offset + 2] = s.restLength;
    data[offset + 3] = s.compliance;
    view[4] = s.type;
    view[5] = s.broken;
    data[offset + 6] = s.tension;
    data[offset + 7] = s.breakThreshold;
  }

  return { data, count: springs.length, structCount };
}

export function mat4Perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function mat4LookAt(eye: [number, number, number], center: [number, number, number], up: [number, number, number]): Float32Array {
  const [ex, ey, ez] = eye;
  const [cx, cy, cz] = center;
  const [ux, uy, uz] = up;

  let z0 = ex - cx, z1 = ey - cy, z2 = ez - cz;
  let len = Math.hypot(z0, z1, z2);
  z0 /= len; z1 /= len; z2 /= len;

  let x0 = uy * z2 - uz * z1, x1 = uz * z0 - ux * z2, x2 = ux * z1 - uy * z0;
  len = Math.hypot(x0, x1, x2);
  x0 /= len; x1 /= len; x2 /= len;

  const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;

  return new Float32Array([
    x0, y0, z0, 0,
    x1, y1, z1, 0,
    x2, y2, z2, 0,
    -(x0 * ex + x1 * ey + x2 * ez),
    -(y0 * ex + y1 * ey + y2 * ez),
    -(z0 * ex + z1 * ey + z2 * ez),
    1,
  ]);
}

export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + j] * b[i * 4 + k];
      }
      result[i * 4 + j] = sum;
    }
  }
  return result;
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  viewProjInv: Float32Array,
  depth: number = 0
): [number, number, number] {
  const x = (screenX / width) * 2 - 1;
  const y = -((screenY / height) * 2 - 1);
  const z = depth * 2 - 1;

  const clip = new Float32Array([x, y, z, 1]);
  const world = new Float32Array(4);

  for (let i = 0; i < 4; i++) {
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      sum += clip[j] * viewProjInv[i * 4 + j];
    }
    world[i] = sum;
  }

  const w = world[3];
  return [world[0] / w, world[1] / w, world[2] / w];
}

export function mat4Inverse(m: Float32Array): Float32Array {
  const inv = new Float32Array(16);

  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] +
           m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] -
           m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] +
           m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] -
            m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] -
           m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] +
           m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] -
           m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] +
            m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] +
           m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] -
           m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] +
            m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] -
            m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] -
           m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] +
           m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] -
            m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] +
            m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

  let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  if (det === 0) return inv;
  det = 1.0 / det;

  for (let i = 0; i < 16; i++) {
    inv[i] *= det;
  }

  return inv;
}
