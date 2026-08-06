// progress.js — carrega e salva o "state" do app (XP, streak, badges, vocab, etc.)
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

const MAX_STATE_BYTES = 200 * 1024; // 200 KB é bem mais que suficiente pro state deste app

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT state_json, updated_at FROM progress WHERE user_id = $1',
      [req.userId]
    );
    const row = result.rows[0];
    if (!row) return res.json({ state: {}, updatedAt: null });
    res.json({ state: row.state_json, updatedAt: row.updated_at });
  } catch (e) { next(e); }
});

router.put('/', requireAuth, async (req, res, next) => {
  try {
    const { state } = req.body || {};
    if (typeof state !== 'object' || state === null) {
      return res.status(400).json({ error: 'Campo "state" precisa ser um objeto.' });
    }
    const json = JSON.stringify(state);
    if (Buffer.byteLength(json, 'utf8') > MAX_STATE_BYTES) {
      return res.status(413).json({ error: 'Dados de progresso grandes demais.' });
    }

    await pool.query(
      `INSERT INTO progress (user_id, state_json, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      [req.userId, json]
    );

    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
