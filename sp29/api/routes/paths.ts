import { Router, type Request, type Response } from 'express';
import db from '../db.js';

const router = Router();

router.get('/floors', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM floors ORDER BY floor_number').all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/path-nodes', (req: Request, res: Response) => {
  try {
    const floor = req.query.floor ? Number(req.query.floor) : null;
    let stmt;
    if (floor !== null) {
      stmt = db.prepare('SELECT * FROM path_nodes WHERE floor = ?');
      const rows = stmt.all(floor);
      res.json({ success: true, data: rows });
    } else {
      const rows = db.prepare('SELECT * FROM path_nodes').all();
      res.json({ success: true, data: rows });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/path-nodes', (req: Request, res: Response) => {
  try {
    const { name, x, y, floor, blocked } = req.body;
    if (!name || x === undefined || y === undefined) {
      res.status(400).json({ success: false, error: 'name, x, y are required' });
      return;
    }
    const stmt = db.prepare(
      'INSERT INTO path_nodes (name, x, y, floor, blocked) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, x, y, floor ?? 1, blocked ? 1 : 0);
    const row = db.prepare('SELECT * FROM path_nodes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/path-nodes/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM path_nodes WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Node not found' });
      return;
    }
    const { name, x, y, floor, blocked } = req.body;
    const stmt = db.prepare(
      'UPDATE path_nodes SET name = ?, x = ?, y = ?, floor = ?, blocked = ? WHERE id = ?'
    );
    stmt.run(
      name ?? (existing as any).name,
      x ?? (existing as any).x,
      y ?? (existing as any).y,
      floor ?? (existing as any).floor,
      blocked !== undefined ? (blocked ? 1 : 0) : (existing as any).blocked,
      req.params.id
    );
    const row = db.prepare('SELECT * FROM path_nodes WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/path-nodes/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM path_nodes WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Node not found' });
      return;
    }
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/path-edges', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM path_edges').all();
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/path-edges', (req: Request, res: Response) => {
  try {
    const { from_node_id, to_node_id, weight, blocked } = req.body;
    if (!from_node_id || !to_node_id || weight === undefined) {
      res.status(400).json({ success: false, error: 'from_node_id, to_node_id, weight are required' });
      return;
    }
    const stmt = db.prepare(
      'INSERT INTO path_edges (from_node_id, to_node_id, weight, blocked) VALUES (?, ?, ?, ?)'
    );
    const result = stmt.run(from_node_id, to_node_id, weight, blocked ? 1 : 0);
    const row = db.prepare('SELECT * FROM path_edges WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: 'Edge already exists between these nodes' });
      return;
    }
    if (err.message?.includes('FOREIGN KEY')) {
      res.status(400).json({ success: false, error: 'Referenced node does not exist' });
      return;
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/path-edges/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM path_edges WHERE id = ?').get(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Edge not found' });
      return;
    }
    const { from_node_id, to_node_id, weight, blocked } = req.body;
    const stmt = db.prepare(
      'UPDATE path_edges SET from_node_id = ?, to_node_id = ?, weight = ?, blocked = ? WHERE id = ?'
    );
    stmt.run(
      from_node_id ?? (existing as any).from_node_id,
      to_node_id ?? (existing as any).to_node_id,
      weight ?? (existing as any).weight,
      blocked !== undefined ? (blocked ? 1 : 0) : (existing as any).blocked,
      req.params.id
    );
    const row = db.prepare('SELECT * FROM path_edges WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/path-edges/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM path_edges WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Edge not found' });
      return;
    }
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/obstacles', (req: Request, res: Response) => {
  try {
    const floor = req.query.floor ? Number(req.query.floor) : null;
    let rows;
    if (floor !== null) {
      rows = db.prepare('SELECT * FROM obstacles WHERE floor = ?').all(floor);
    } else {
      rows = db.prepare('SELECT * FROM obstacles').all();
    }
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/obstacles', (req: Request, res: Response) => {
  try {
    const { x, y, width, height, floor } = req.body;
    if (x === undefined || y === undefined || !width || !height) {
      res.status(400).json({ success: false, error: 'x, y, width, height are required' });
      return;
    }
    const stmt = db.prepare(
      'INSERT INTO obstacles (x, y, width, height, floor) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(x, y, width, height, floor ?? 1);
    const row = db.prepare('SELECT * FROM obstacles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/obstacles/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM obstacles WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Obstacle not found' });
      return;
    }
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/path-graph', (req: Request, res: Response) => {
  try {
    const floor = req.query.floor ? Number(req.query.floor) : 1;
    const nodes = db.prepare('SELECT * FROM path_nodes WHERE floor = ?').all(floor);
    const edges = db.prepare(`
      SELECT pe.* FROM path_edges pe
      JOIN path_nodes pn1 ON pe.from_node_id = pn1.id
      JOIN path_nodes pn2 ON pe.to_node_id = pn2.id
      WHERE pn1.floor = ? AND pn2.floor = ?
    `).all(floor, floor);
    const obstacles = db.prepare('SELECT * FROM obstacles WHERE floor = ?').all(floor);
    res.json({ success: true, data: { nodes, edges, obstacles } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
