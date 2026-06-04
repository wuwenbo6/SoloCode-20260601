import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

router.get('/beacons/coordinates', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(
      'SELECT id, uuid, name, x, y, floor, tx_power, path_loss_exp FROM beacons'
    ).all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/beacons', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM beacons').all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/beacons/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM beacons WHERE id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ success: false, error: 'Beacon not found' });
      return;
    }
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/beacons', (req: Request, res: Response) => {
  try {
    const { uuid, name, x, y, floor, tx_power, path_loss_exp } = req.body;
    if (!uuid || !name || x === undefined || y === undefined) {
      res.status(400).json({ success: false, error: 'uuid, name, x, y are required' });
      return;
    }
    const stmt = db.prepare(
      'INSERT INTO beacons (uuid, name, x, y, floor, tx_power, path_loss_exp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(uuid, name, x, y, floor ?? 1, tx_power ?? -59, path_loss_exp ?? 2.0);
    const row = db.prepare('SELECT * FROM beacons WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: 'Beacon UUID already exists' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/beacons/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM beacons WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Beacon not found' });
      return;
    }
    const { uuid, name, x, y, floor, tx_power, path_loss_exp } = req.body;
    const stmt = db.prepare(
      `UPDATE beacons SET uuid = ?, name = ?, x = ?, y = ?, floor = ?, tx_power = ?, path_loss_exp = ?, updated_at = datetime('now') WHERE id = ?`
    );
    stmt.run(
      uuid ?? (existing as any).uuid,
      name ?? (existing as any).name,
      x ?? (existing as any).x,
      y ?? (existing as any).y,
      floor ?? (existing as any).floor,
      tx_power ?? (existing as any).tx_power,
      path_loss_exp ?? (existing as any).path_loss_exp,
      req.params.id
    );
    const row = db.prepare('SELECT * FROM beacons WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: 'Beacon UUID already exists' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/beacons/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM beacons WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Beacon not found' });
      return;
    }
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
