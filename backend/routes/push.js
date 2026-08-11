// push.js — inscrição de notificações push (o "avisa que o app tá esperando").
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth');
const { VAPID_PUBLIC_KEY } = require('../push-sender');

const router = express.Router();

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const sub = req.body && req.body.subscription;
    if (!sub || !sub.endpoint) {
      return res.status(400).json({ error: 'Inscrição de notificação inválida.' });
    }
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, subscription_json)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, subscription_json = excluded.subscription_json`,
      [req.userId, sub.endpoint, JSON.stringify(sub)]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    const endpoint = req.body && req.body.endpoint;
    if (endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, req.userId]);
    } else {
      // sem endpoint especifico: remove todas as inscricoes desse usuario (ex: desligou nas configs)
      await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.userId]);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
