// routes/datasets.js
// CRUD for uploaded datasets.
//
// GET    /api/datasets         — list user's datasets
// POST   /api/datasets         — save dataset metadata after upload
// GET    /api/datasets/:id     — get single dataset details
// DELETE /api/datasets/:id     — delete dataset

import express from 'express';
import pool from '../db/pool.js';
import { authMiddleware, requirePlan } from '../middleware/auth.js';

const router = express.Router();

// All dataset routes require authentication
router.use(authMiddleware);

// Plan row limits
const PLAN_LIMITS = {
  free:       5000,
  pro:        100000,
  enterprise: 9999999
};

// ─── LIST DATASETS ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, original_filename, file_type, row_count, col_count,
              file_size, created_at
       FROM datasets WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ datasets: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch datasets.' });
  }
});

// ─── SAVE DATASET METADATA ───────────────────────────────────
router.post('/', async (req, res) => {
  const { name, originalFilename, fileType, rowCount, colCount, fileSize, columnsJson } = req.body;

  // Enforce plan row limits
  const limit = PLAN_LIMITS[req.user.plan] || PLAN_LIMITS.free;
  if (rowCount > limit) {
    return res.status(403).json({
      error: `Your ${req.user.plan} plan supports up to ${limit.toLocaleString()} rows. This file has ${rowCount.toLocaleString()} rows.`,
      upgrade_required: true
    });
  }

  try {
    const ins = await pool.query(
      `INSERT INTO datasets (user_id, name, original_filename, file_type, row_count, col_count, file_size, columns_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, originalFilename, fileType, rowCount, colCount, fileSize, columnsJson]
    );
    const result = await pool.query('SELECT id, name, created_at FROM datasets WHERE id = ?', [ins.rows.insertId]);
    res.status(201).json({ dataset: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save dataset.' });
  }
});

// ─── GET SINGLE DATASET ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM datasets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dataset not found.' });
    res.json({ dataset: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dataset.' });
  }
});

// ─── DELETE DATASET ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM datasets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.rows.affectedRows === 0) return res.status(404).json({ error: 'Dataset not found.' });
    res.json({ message: 'Dataset deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dataset.' });
  }
});

// ─── SAVE CHART CONFIG ───────────────────────────────────────
router.post('/:id/configs', async (req, res) => {
  const { name, configJson, thumbnail } = req.body;
  try {
    const ins2 = await pool.query(
      `INSERT INTO chart_configs (user_id, dataset_id, name, config_json, thumbnail)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, req.params.id, name, configJson, thumbnail]
    );
    const result = await pool.query('SELECT id, name, created_at FROM chart_configs WHERE id = ?', [ins2.rows.insertId]);
    res.status(201).json({ config: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save config.' });
  }
});

// ─── GET CHART CONFIGS FOR DATASET ───────────────────────────
router.get('/:id/configs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, config_json, thumbnail, created_at FROM chart_configs WHERE dataset_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ configs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch configs.' });
  }
});

export default router;