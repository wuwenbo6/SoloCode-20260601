import type { Request, Response } from 'express';
import { modelService } from '../services/ModelService.js';

export class ModelController {
  async getModels(req: Request, res: Response): Promise<void> {
    try {
      const models = await modelService.getModels();
      res.json({ models });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load models' });
    }
  }

  async getModel(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      const filePath = await modelService.getModelFilePath(name);
      
      if (!filePath) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      res.setHeader('Content-Type', 'model/obj');
      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load model' });
    }
  }

  async uploadModel(req: Request, res: Response): Promise<void> {
    try {
      const { fileName, content } = req.body;
      await modelService.saveModel(fileName, content);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save model' });
    }
  }
}

export const modelController = new ModelController();
