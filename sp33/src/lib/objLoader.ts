import type { OBJData, MaterialPreset, TextureData } from '../../shared/types.js';

interface ParseState {
  positions: number[][];
  normals: number[][];
  uvs: number[][];
  indices: number[];
  vertexData: number[];
  normalData: number[];
  uvData: number[];
  materialIds: number[];
  currentMaterialId: number;
  materials: Map<string, number>;
  materialList: MaterialPreset[];
  triangleCount: number;
}

const DEFAULT_MATERIALS: Record<string, Partial<MaterialPreset>> = {
  light: {
    name: '光源',
    type: 'lambertian',
    albedo: [15.0, 15.0, 15.0],
  },
  floor: {
    name: '地板',
    type: 'lambertian',
    albedo: [0.9, 0.9, 0.9],
    textureId: 'checkerboard',
    textureScale: 8.0,
  },
  ceiling: {
    name: '天花板',
    type: 'lambertian',
    albedo: [0.9, 0.9, 0.9],
  },
  backwall: {
    name: '后墙',
    type: 'lambertian',
    albedo: [0.9, 0.9, 0.9],
  },
  redwall: {
    name: '红墙',
    type: 'lambertian',
    albedo: [0.9, 0.1, 0.1],
  },
  greenwall: {
    name: '绿墙',
    type: 'lambertian',
    albedo: [0.1, 0.9, 0.1],
  },
  metal: {
    name: '金属',
    type: 'metal',
    albedo: [1.0, 0.85, 0.3],
    roughness: 0.1,
  },
  glass: {
    name: '玻璃',
    type: 'dielectric',
    albedo: [1.0, 1.0, 1.0],
    ior: 1.5,
  },
  default: {
    name: '默认',
    type: 'lambertian',
    albedo: [0.7, 0.7, 0.7],
  },
};

function createParseState(): ParseState {
  return {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    vertexData: [],
    normalData: [],
    uvData: [],
    materialIds: [],
    currentMaterialId: 0,
    materials: new Map(),
    materialList: [],
    triangleCount: 0,
  };
}

function getOrCreateMaterialId(
  state: ParseState,
  materialName: string
): number {
  if (state.materials.has(materialName)) {
    return state.materials.get(materialName)!;
  }

  const preset = DEFAULT_MATERIALS[materialName] || DEFAULT_MATERIALS.default;
  const material: MaterialPreset = {
    id: `mat-${materialName}`,
    name: preset.name || materialName,
    type: (preset.type as 'lambertian' | 'metal' | 'dielectric') || 'lambertian',
    albedo: (preset.albedo as [number, number, number]) || [0.7, 0.7, 0.7],
    roughness: preset.roughness,
    ior: preset.ior,
  };

  const id = state.materialList.length;
  state.materials.set(materialName, id);
  state.materialList.push(material);
  return id;
}

function parseFaceVertex(
  faceStr: string,
  state: ParseState
): { posIdx: number; normIdx: number; uvIdx: number } {
  const parts = faceStr.split('/');
  const posIdx = parseInt(parts[0], 10) - 1;
  const uvIdx = parts[1] ? parseInt(parts[1], 10) - 1 : -1;
  const normIdx = parts[2] ? parseInt(parts[2], 10) - 1 : -1;
  return { posIdx, normIdx, uvIdx };
}

function addVertex(
  state: ParseState,
  posIdx: number,
  normIdx: number,
  uvIdx: number
): number {
  const pos = state.positions[posIdx] || [0, 0, 0];
  const norm = normIdx >= 0 ? state.normals[normIdx] || [0, 1, 0] : [0, 1, 0];
  const uv = uvIdx >= 0 ? state.uvs[uvIdx] || [0, 0] : [0, 0];

  const vertexIdx = state.vertexData.length / 3;

  state.vertexData.push(pos[0], pos[1], pos[2]);
  state.normalData.push(norm[0], norm[1], norm[2]);
  state.uvData.push(uv[0], uv[1]);

  return vertexIdx;
}

export function parseOBJ(content: string): OBJData {
  const state = createParseState();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    const type = parts[0];

    switch (type) {
      case 'v': {
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        state.positions.push([x, y, z]);
        break;
      }

      case 'vn': {
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        state.normals.push([x, y, z]);
        break;
      }

      case 'vt': {
        const u = parseFloat(parts[1]);
        const v = parseFloat(parts[2]);
        state.uvs.push([u, v]);
        break;
      }

      case 'usemtl': {
        const matName = parts[1] || 'default';
        state.currentMaterialId = getOrCreateMaterialId(state, matName);
        break;
      }

      case 'f': {
        const vertices: { posIdx: number; normIdx: number; uvIdx: number }[] = [];
        for (let i = 1; i < parts.length; i++) {
          vertices.push(parseFaceVertex(parts[i], state));
        }

        for (let i = 1; i < vertices.length - 1; i++) {
          const v0 = addVertex(
            state,
            vertices[0].posIdx,
            vertices[0].normIdx,
            vertices[0].uvIdx
          );
          const v1 = addVertex(
            state,
            vertices[i].posIdx,
            vertices[i].normIdx,
            vertices[i].uvIdx
          );
          const v2 = addVertex(
            state,
            vertices[i + 1].posIdx,
            vertices[i + 1].normIdx,
            vertices[i + 1].uvIdx
          );

          state.indices.push(v0, v1, v2);
          state.materialIds.push(
            state.currentMaterialId,
            state.currentMaterialId,
            state.currentMaterialId
          );
          state.triangleCount++;
        }
        break;
      }
    }
  }

  return {
    vertices: new Float32Array(state.vertexData),
    normals: new Float32Array(state.normalData),
    uvs: new Float32Array(state.uvData),
    indices: new Uint32Array(state.indices),
    materialIds: new Uint32Array(state.materialIds),
    materials: state.materialList,
    triangleCount: state.triangleCount,
  };
}

export async function loadOBJFromURL(url: string): Promise<OBJData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load OBJ: ${response.statusText}`);
  }
  const content = await response.text();
  return parseOBJ(content);
}

export async function loadModelFromAPI(modelId: string): Promise<OBJData> {
  const response = await fetch(`/api/models`);
  const { models } = await response.json();
  const model = models.find((m: { id: string }) => m.id === modelId);
  
  if (!model) {
    throw new Error(`Model not found: ${modelId}`);
  }

  return loadOBJFromURL(`/api/models/${model.fileName}`);
}

export function getMaterialGPUData(materials: MaterialPreset[]): Float32Array {
  const data = new Float32Array(materials.length * 8);
  
  for (let i = 0; i < materials.length; i++) {
    const mat = materials[i];
    const offset = i * 8;
    
    const typeCode = mat.type === 'lambertian' ? 0 : mat.type === 'metal' ? 1 : 2;
    
    data[offset] = mat.albedo[0];
    data[offset + 1] = mat.albedo[1];
    data[offset + 2] = mat.albedo[2];
    data[offset + 3] = typeCode;
    data[offset + 4] = mat.roughness ?? 0;
    data[offset + 5] = mat.ior ?? 1.5;
    data[offset + 6] = mat.textureScale ?? 1.0;
    data[offset + 7] = mat.textureId ? 1.0 : 0.0;
  }
  
  return data;
}

export function generateCheckerboardTexture(
  width: number = 512,
  height: number = 512,
  scale: number = 8
): TextureData {
  const data = new Uint8Array(width * height * 4);
  const texelSize = Math.floor(Math.min(width, height) / scale);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const checkX = Math.floor(x / texelSize);
      const checkY = Math.floor(y / texelSize);
      
      if ((checkX + checkY) % 2 === 0) {
        data[idx] = 240;
        data[idx + 1] = 240;
        data[idx + 2] = 240;
      } else {
        data[idx] = 30;
        data[idx + 1] = 30;
        data[idx + 2] = 30;
      }
      data[idx + 3] = 255;
    }
  }

  return { id: 'checkerboard', width, height, data };
}

export function generateUVTestTexture(
  width: number = 512,
  height: number = 512
): TextureData {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const u = x / (width - 1);
      const v = y / (height - 1);
      
      data[idx] = Math.floor(u * 255);
      data[idx + 1] = Math.floor(v * 255);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  return { id: 'uvtest', width, height, data };
}

export function getTextureGPUData(texture: TextureData): Float32Array {
  const size = texture.width * texture.height * 4;
  const data = new Float32Array(size);
  
  if (texture.data instanceof Uint8Array) {
    for (let i = 0; i < size; i++) {
      data[i] = texture.data[i] / 255.0;
    }
  } else {
    data.set(texture.data as Float32Array);
  }
  
  return data;
}
