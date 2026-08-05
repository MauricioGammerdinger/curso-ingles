// auth.js — cadastro, login e middleware que protege as rotas privadas
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET não definido. Configure no arquivo .env (veja .env.example).');
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' }
});

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const MAX_AVATAR_CHARS = 300000; // ~220KB de imagem original (já comprimida/redimensionada no navegador antes de enviar)

function validAvatarOrNull(avatarData) {
  if (avatarData === null || avatarData === undefined || avatarData === '') return null;
  if (typeof avatarData !== 'string' || !avatarData.startsWith('data:image/')) return undefined; // undefined = inválido
  if (avatarData.length > MAX_AVATAR_CHARS) return undefined;
  return avatarData;
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, name, avatarData } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
    }
    const avatar = validAvatarOrNull(avatarData);
    if (avatar === undefined) {
      return res.status(400).json({ error: 'Foto inválida ou grande demais.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const insertUser = await pool.query(
      'INSERT INTO users (email, password_hash, name, avatar_data) VALUES ($1, $2, $3, $4) RETURNING id',
      [normalizedEmail, passwordHash, (name || '').trim().slice(0, 80), avatar]
    );
    const userId = insertUser.rows[0].id;

    await pool.query('INSERT INTO progress (user_id, state_json) VALUES ($1, $2)', [userId, '{}']);

    const token = jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
    res.status(201).json({ token, user: { id: userId, email: normalizedEmail, name: name || '', avatarData: avatar } });
  } catch (e) { next(e); }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'E-mail ou senha inválidos.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name || '', avatarData: user.avatar_data || null } });
  } catch (e) { next(e); }
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
  }
}

module.exports = { router, requireAuth, validAvatarOrNull, MAX_AVATAR_CHARS };
