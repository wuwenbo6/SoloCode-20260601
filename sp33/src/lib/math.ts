export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export const vec3 = {
  create(x = 0, y = 0, z = 0): Vec3 {
    return [x, y, z];
  },

  add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  },

  sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  mul(v: Vec3, s: number): Vec3 {
    return [v[0] * s, v[1] * s, v[2] * s];
  },

  mulVec(a: Vec3, b: Vec3): Vec3 {
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  },

  div(v: Vec3, s: number): Vec3 {
    return [v[0] / s, v[1] / s, v[2] / s];
  },

  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },

  cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },

  length(v: Vec3): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  },

  lengthSq(v: Vec3): number {
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
  },

  normalize(v: Vec3): Vec3 {
    const len = vec3.length(v);
    return len > 0 ? vec3.div(v, len) : [0, 0, 0];
  },

  negate(v: Vec3): Vec3 {
    return [-v[0], -v[1], -v[2]];
  },

  lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  },

  clamp(v: Vec3, min: number, max: number): Vec3 {
    return [
      Math.max(min, Math.min(max, v[0])),
      Math.max(min, Math.min(max, v[1])),
      Math.max(min, Math.min(max, v[2])),
    ];
  },

  reflect(v: Vec3, n: Vec3): Vec3 {
    const d = 2 * vec3.dot(v, n);
    return [v[0] - d * n[0], v[1] - d * n[1], v[2] - d * n[2]];
  },

  refract(uv: Vec3, n: Vec3, etai_over_etat: number): Vec3 {
    const cos_theta = Math.min(vec3.dot(vec3.negate(uv), n), 1.0);
    const r_out_perp = vec3.mul(
      vec3.add(uv, vec3.mul(n, cos_theta)),
      etai_over_etat
    );
    const r_out_parallel = vec3.mul(
      n,
      -Math.sqrt(Math.abs(1.0 - vec3.lengthSq(r_out_perp)))
    );
    return vec3.add(r_out_perp, r_out_parallel);
  },

  random(min = 0, max = 1): Vec3 {
    return [
      Math.random() * (max - min) + min,
      Math.random() * (max - min) + min,
      Math.random() * (max - min) + min,
    ];
  },

  randomInUnitSphere(): Vec3 {
    while (true) {
      const p = vec3.random(-1, 1);
      if (vec3.lengthSq(p) < 1) return p;
    }
  },

  randomUnitVector(): Vec3 {
    return vec3.normalize(vec3.randomInUnitSphere());
  },

  randomOnHemisphere(normal: Vec3): Vec3 {
    const onSphere = vec3.randomUnitVector();
    return vec3.dot(onSphere, normal) > 0 ? onSphere : vec3.negate(onSphere);
  },

  nearZero(v: Vec3): boolean {
    const s = 1e-8;
    return Math.abs(v[0]) < s && Math.abs(v[1]) < s && Math.abs(v[2]) < s;
  },
};

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function reflectance(cosine: number, refIdx: number): number {
  let r0 = (1 - refIdx) / (1 + refIdx);
  r0 = r0 * r0;
  return r0 + (1 - r0) * Math.pow(1 - cosine, 5);
}
