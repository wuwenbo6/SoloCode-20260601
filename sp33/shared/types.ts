export interface ModelInfo {
  id: string;
  name: string;
  fileName: string;
  triangleCount: number;
  vertexCount: number;
  thumbnail?: string;
}

export type MaterialType = 'lambertian' | 'metal' | 'dielectric';

export interface MaterialPreset {
  id: string;
  name: string;
  type: MaterialType;
  albedo: [number, number, number];
  roughness?: number;
  metallic?: number;
  ior?: number;
  textureId?: string;
  textureScale?: number;
}

export interface TextureData {
  id: string;
  width: number;
  height: number;
  data: Uint8Array | Float32Array;
}

export interface MaterialAssignment {
  meshName: string;
  materialId: string;
}

export interface OBJData {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  materialIds: Uint32Array;
  materials: MaterialPreset[];
  triangleCount: number;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  aspect: number;
}

export interface RenderParams {
  samplesPerPixel: number;
  maxBounces: number;
  width: number;
  height: number;
  enableAccumulation: boolean;
  enableAO: boolean;
  aoSamples: number;
  aoRadius: number;
  enableSoftShadows: boolean;
  shadowSamples: number;
  lightRadius: number;
}

export interface RenderStats {
  currentSample: number;
  fps: number;
  triangleCount: number;
  rayCount: number;
  renderTime: number;
}
