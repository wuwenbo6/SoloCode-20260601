const express = require('express');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const sql = 'SELECT id, name, is_default, created_at, updated_at FROM configs WHERE user_id = ?';
  db.all(sql, [req.user.id], (err, configs) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(configs);
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const sql = 'SELECT * FROM configs WHERE id = ? AND user_id = ?';
  db.get(sql, [req.params.id, req.user.id], (err, config) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    config.config_data = JSON.parse(config.config_data);
    res.json(config);
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { name, config_data, is_default } = req.body;

  if (!name || !config_data) {
    return res.status(400).json({ error: 'Name and config data are required' });
  }

  if (is_default) {
    db.run('UPDATE configs SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  }

  const sql = 'INSERT INTO configs (user_id, name, config_data, is_default) VALUES (?, ?, ?, ?)';
  db.run(sql, [req.user.id, name, JSON.stringify(config_data), is_default ? 1 : 0], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({
      id: this.lastID,
      name,
      is_default: is_default || false,
      message: 'Config saved successfully'
    });
  });
});

router.put('/:id', authenticateToken, (req, res) => {
  const { name, config_data, is_default } = req.body;

  if (is_default) {
    db.run('UPDATE configs SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  }

  const sql = 'UPDATE configs SET name = ?, config_data = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?';
  db.run(sql, [name, JSON.stringify(config_data), is_default ? 1 : 0, req.params.id, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Config not found' });
    }
    res.json({ message: 'Config updated successfully' });
  });
});

router.delete('/:id', authenticateToken, (req, res) => {
  const sql = 'DELETE FROM configs WHERE id = ? AND user_id = ?';
  db.run(sql, [req.params.id, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Config not found' });
    }
    res.json({ message: 'Config deleted successfully' });
  });
});

router.get('/sync/default', authenticateToken, (req, res) => {
  const sql = 'SELECT * FROM configs WHERE user_id = ? AND is_default = 1 LIMIT 1';
  db.get(sql, [req.user.id], (err, config) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!config) {
      return res.status(404).json({ error: 'No default config found' });
    }
    config.config_data = JSON.parse(config.config_data);
    res.json(config);
  });
});

module.exports = router;