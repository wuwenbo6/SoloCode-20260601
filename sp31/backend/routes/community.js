const express = require('express');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const { sort = 'newest', search, game, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];

  if (search) {
    whereClause += ' AND (cc.name LIKE ? OR cc.game_name LIKE ? OR cc.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (game) {
    whereClause += ' AND cc.game_name LIKE ?';
    params.push(`%${game}%`);
  }

  let orderClause = 'ORDER BY cc.created_at DESC';
  if (sort === 'popular') orderClause = 'ORDER BY cc.download_count DESC';
  if (sort === 'rating') orderClause = 'ORDER BY cc.avg_rating DESC NULLS LAST';

  const countSql = `SELECT COUNT(*) as total FROM community_configs cc ${whereClause}`;
  db.get(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    const sql = `
      SELECT cc.id, cc.name, cc.game_name, cc.description, cc.download_count, 
             cc.avg_rating, cc.rating_count, cc.created_at, cc.updated_at,
             u.username as author
      FROM community_configs cc
      JOIN users u ON cc.user_id = u.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    db.all(sql, [...params, parseInt(limit), offset], (err, configs) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({
        configs,
        total: countResult.total,
        page: parseInt(page),
        totalPages: Math.ceil(countResult.total / limit)
      });
    });
  });
});

router.get('/:id', (req, res) => {
  const sql = `
    SELECT cc.*, u.username as author
    FROM community_configs cc
    JOIN users u ON cc.user_id = u.id
    WHERE cc.id = ?
  `;

  db.get(sql, [req.params.id], (err, config) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!config) return res.status(404).json({ error: 'Config not found' });
    config.config_data = JSON.parse(config.config_data);
    res.json(config);
  });
});

router.post('/', authenticateToken, (req, res) => {
  const { name, game_name, description, config_data } = req.body;

  if (!name || !config_data) {
    return res.status(400).json({ error: 'Name and config data are required' });
  }

  const sql = 'INSERT INTO community_configs (user_id, name, game_name, description, config_data) VALUES (?, ?, ?, ?, ?)';
  db.run(sql, [req.user.id, name, game_name || '', description || '', JSON.stringify(config_data)], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.status(201).json({
      id: this.lastID,
      name,
      message: 'Config shared to community successfully'
    });
  });
});

router.post('/:id/download', (req, res) => {
  const sql = 'UPDATE community_configs SET download_count = download_count + 1 WHERE id = ?';
  db.run(sql, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ message: 'Download counted' });
  });
});

router.post('/:id/rate', authenticateToken, (req, res) => {
  const { rating } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const upsertSql = `
    INSERT INTO community_ratings (config_id, user_id, rating)
    VALUES (?, ?, ?)
    ON CONFLICT(config_id, user_id) DO UPDATE SET rating = excluded.rating
  `;

  db.run(upsertSql, [req.params.id, req.user.id, rating], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });

    const avgSql = `
      UPDATE community_configs 
      SET avg_rating = (SELECT AVG(rating) FROM community_ratings WHERE config_id = ?),
          rating_count = (SELECT COUNT(*) FROM community_ratings WHERE config_id = ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(avgSql, [req.params.id, req.params.id, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Rating submitted successfully', rating });
    });
  });
});

router.get('/user/mine', authenticateToken, (req, res) => {
  const sql = `
    SELECT id, name, game_name, description, download_count, avg_rating, rating_count, created_at
    FROM community_configs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.all(sql, [req.user.id], (err, configs) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(configs);
  });
});

router.delete('/:id', authenticateToken, (req, res) => {
  const sql = 'DELETE FROM community_configs WHERE id = ? AND user_id = ?';
  db.run(sql, [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Config not found or not authorized' });
    res.json({ message: 'Community config deleted successfully' });
  });
});

module.exports = router;