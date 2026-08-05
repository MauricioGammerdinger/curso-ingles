// account.js — perfil do usuário: buscar dados atuais e trocar/remover a foto
const express = require('express');
const { pool } = require('./db');
const { requireAuth, validAvatarOrNull } = require('./auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, email, name, avatar_data FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ user: { id: user.id, email: user.email, name: user.name || '', avatarData: user.avatar_data || null } });
  } catch (e) { next(e); }
});

router.put('/avatar', requireAuth, async (req, res, next) => {
  try {
    const { avatarData } = req.body || {};
    const avatar = validAvatarOrNull(avatarData); // null = remover foto, string = nova foto, undefined = inválida
    if (avatar === undefined) {
      return res.status(400).json({ error: 'Foto inválida ou grande demais.' });
    }
    await pool.query('UPDATE users SET avatar_data = $1 WHERE id = $2', [avatar, req.userId]);
    res.json({ ok: true, avatarData: avatar });
  } catch (e) { next(e); }
});

module.exports = router;
