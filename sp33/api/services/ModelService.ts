import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ModelInfo } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const MODELS_DIR = path.join(__dirname, '../../public/models');

export class ModelService {
  private modelsCache: ModelInfo[] | null = null;

  async getModels(): Promise<ModelInfo[]> {
    if (this.modelsCache) {
      return this.modelsCache;
    }

    const dataPath = path.join(DATA_DIR, 'models.json');
    const data = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(data);
    this.modelsCache = parsed.models;
    return this.modelsCache!;
  }

  async getModelById(id: string): Promise<ModelInfo | null> {
    const models = await this.getModels();
    return models.find(m => m.id === id) || null;
  }

  async getModelFilePath(fileName: string): Promise<string | null> {
    const filePath = path.join(MODELS_DIR, fileName);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  async saveModel(fileName: string, content: string): Promise<void> {
    const filePath = path.join(MODELS_DIR, fileName);
    await fs.writeFile(filePath, content);
    this.modelsCache = null;
  }

  async updateModelInfo(model: ModelInfo): Promise<void> {
    const models = await this.getModels();
    const index = models.findIndex(m => m.id === model.id);
    if (index >= 0) {
      models[index] = model;
    } else {
      models.push(model);
    }

    const dataPath = path.join(DATA_DIR, 'models.json');
    await fs.writeFile(dataPath, JSON.stringify({ models }, null, 2));
    this.modelsCache = models;
  }
}

export const modelService = new ModelService();
