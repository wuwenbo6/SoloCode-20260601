const express = require('express');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const sql = 'SELECT id, name, created_at FROM macros WHERE user_id = ?';
  db.all(sql, [req.user.id], (err, macros) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(macros);
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const sql = 'SELECT * FROM macros WHERE id = ? AND user_id = ?';
  db.get(sql, [req.params.id, req.user.id], (err, macro) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!macro) {
      return res.status(404).json({ error: 'Macro not found' });
    }
    macro.macro_data = JSON.parse(macro.macro_data);
    res.json(macro);
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { name, macro_data } = req.body;

  if (!name || !macro_data) {
    return res.status(400).json({ error: 'Name and macro data are required' });
  }

  const sql = 'INSERT INTO macros (user_id, name, macro_data) VALUES (?, ?, ?)';
  db.run(sql, [req.user.id, name, JSON.stringify(macro_data)], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({
      id: this.lastID,
      name,
      message: 'Macro saved successfully'
    });
  });
});

router.put('/:id', authenticateToken, (req, res) => {
  const { name, macro_data } = req.body;

  const sql = 'UPDATE macros SET name = ?, macro_data = ? WHERE id = ? AND user_id = ?';
  db.run(sql, [name, JSON.stringify(macro_data), req.params.id, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Macro not found' });
    }
    res.json({ message: 'Macro updated successfully' });
  });
});

router.delete('/:id', authenticateToken, (req, res) => {
  const sql = 'DELETE FROM macros WHERE id = ? AND user_id = ?';
  db.run(sql, [req.params.id, req.user.id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Macro not found' });
    }
    res.json({ message: 'Macro deleted successfully' });
  });
});

module.exports = router;