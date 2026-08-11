// leaderboard.js — ranking público entre todos os usuários cadastrados, por categoria.
// Não exige login (é público por natureza — é um ranking), mas nunca expõe e-mail.
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

// cada categoria mapeia pro campo salvo dentro do state_json (JSONB) de cada usuário
const CATEGORIES = {
  xp:       { field: 'xp',              label: 'Mais XP na trilha',        order: 'DESC', numeric: true },
  streak:   { field: 'streak',          label: 'Maior sequência de dias',  order: 'DESC', numeric: true },
  xword:    { field: 'xwordStreak',     label: 'Sequência nas Cruzadas',   order: 'DESC', numeric: true },
  memory:   { field: 'memoryBestTime',  label: 'Recorde no Jogo da Memória', order: 'ASC',  numeric: true }, // menor tempo = melhor
  hangman:  { field: 'hangmanWins',     label: 'Vitórias na Forca',        order: 'DESC', numeric: true },
  order:    { field: 'orderWins',       label: 'Acertos no Ordene a Frase',order: 'DESC', numeric: true }
};

router.get('/:category', async (req, res, next) => {
  try {
    const cat = CATEGORIES[req.params.category];
    if (!cat) return res.status(400).json({ error: 'Categoria de ranking inválida.' });

    // pega o nome (ou o começo do e-mail, se não tiver nome) + o valor do campo daquela categoria,
    // só de quem realmente tem esse campo preenchido (senão o ranking fica cheio de gente com 0/nulo)
    const sql = `
      SELECT
        COALESCE(NULLIF(TRIM(u.name), ''), split_part(u.email, '@', 1)) AS display_name,
        u.avatar_data,
        (p.state_json->>'${cat.field}')::numeric AS value
      FROM users u
      JOIN progress p ON p.user_id = u.id
      WHERE p.state_json->>'${cat.field}' IS NOT NULL
      ORDER BY value ${cat.order}
      LIMIT 20
    `;
    const result = await pool.query(sql);
    res.json({
      category: req.params.category,
      label: cat.label,
      entries: result.rows.map(r => ({
        name: r.display_name,
        avatarData: r.avatar_data || null,
        value: Number(r.value)
      }))
    });
  } catch (e) { next(e); }
});

module.exports = router;
