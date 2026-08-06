// server.js — ponto de entrada do backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const { initSchema } = require('./db');
const { router: authRouter } = require('./routes/auth');
const progressRouter = require('./routes/progress');
const accountRouter = require('./routes/account');
const attachArmGame = require('./game/armgame');

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '400kb' })); // aumentado pra caber a foto de perfil (base64)

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/progress', progressRouter);
app.use('/api/account', accountRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// O jogo "Braço de Ferro" precisa de conexão em tempo real (WebSocket) entre os dois
// jogadores — por isso o servidor HTTP normal é "envelopado" com Socket.io aqui.
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: ALLOWED_ORIGIN }
});
attachArmGame(io);

initSchema()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Não foi possível conectar ao banco de dados:', err.message);
    process.exit(1);
  });
