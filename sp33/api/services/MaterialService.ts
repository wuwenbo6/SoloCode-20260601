import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MaterialPreset } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const MATERIALS_FILE = path.join(DATA_DIR, 'materials.json');

export class MaterialService {
  private materialsCache: MaterialPreset[] | null = null;

  async getMaterials(): Promise<MaterialPreset[]> {
    if (this.materialsCache) {
      return this.materialsCache;
    }

    const data = await fs.readFile(MATERIALS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    this.materialsCache = parsed.materials;
    return this.materialsCache!;
  }

  async getMaterialById(id: string): Promise<MaterialPreset | null> {
    const materials = await this.getMaterials();
    return materials.find(m => m.id === id) || null;
  }

  async createMaterial(material: Omit<MaterialPreset, 'id'>): Promise<MaterialPreset> {
    const materials = await this.getMaterials();
    const newMaterial: MaterialPreset = {
      ...material,
      id: `mat-${Date.now().toString(36)}`
    };
    materials.push(newMaterial);
    await this.saveMaterials(materials);
    return newMaterial;
  }

  async updateMaterial(id: string, updates: Partial<MaterialPreset>): Promise<MaterialPreset | null> {
    const materials = await this.getMaterials();
    const index = materials.findIndex(m => m.id === id);
    if (index < 0) return null;

    materials[index] = { ...materials[index], ...updates };
    await this.saveMaterials(materials);
    return materials[index];
  }

  async deleteMaterial(id: string): Promise<boolean> {
    const materials = await this.getMaterials();
    const filtered = materials.filter(m => m.id !== id);
    if (filtered.length === materials.length) return false;

    await this.saveMaterials(filtered);
    return true;
  }

  private async saveMaterials(materials: MaterialPreset[]): Promise<void> {
    await fs.writeFile(MATERIALS_FILE, JSON.stringify({ materials }, null, 2));
    this.materialsCache = materials;
  }
}

export const materialService = new MaterialService();
