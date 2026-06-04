import type { Request, Response } from 'express';
import { materialService } from '../services/MaterialService.js';
import type { MaterialPreset } from '../../shared/types.js';

export class MaterialController {
  async getMaterials(req: Request, res: Response): Promise<void> {
    try {
      const materials = await materialService.getMaterials();
      res.json({ materials });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load materials' });
    }
  }

  async getMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const material = await materialService.getMaterialById(id);
      
      if (!material) {
        res.status(404).json({ error: 'Material not found' });
        return;
      }

      res.json({ material });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load material' });
    }
  }

  async createMaterial(req: Request, res: Response): Promise<void> {
    try {
      const material = req.body as Omit<MaterialPreset, 'id'>;
      const newMaterial = await materialService.createMaterial(material);
      res.json({ success: true, id: newMaterial.id });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create material' });
    }
  }

  async updateMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body as Partial<MaterialPreset>;
      const updated = await materialService.updateMaterial(id, updates);
      
      if (!updated) {
        res.status(404).json({ error: 'Material not found' });
        return;
      }

      res.json({ success: true, material: updated });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update material' });
    }
  }

  async deleteMaterial(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await materialService.deleteMaterial(id);
      
      if (!deleted) {
        res.status(404).json({ error: 'Material not found' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete material' });
    }
  }
}

export const materialController = new MaterialController();
