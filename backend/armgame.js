// armgame.js — lógica de pareamento (fila) e partidas do jogo "Braço de Ferro" em
// tempo real. O servidor é a autoridade: escolhe as perguntas, valida as respostas e
// decide o vencedor. O navegador de cada jogador só mostra o que o servidor manda —
// assim ninguém consegue "trapacear" mexendo no código do site.
const ARM_WORDS = require('./armgame-words');

const rooms = new Map();     // roomId -> room state
let waitingPlayer = null;    // { socket, name } esperando alguém pra lutar, ou null
let roomCounter = 0;

function pickQuestion(){
  const correctIdx = Math.floor(Math.random()*ARM_WORDS.length);
  const [en, correctPt] = ARM_WORDS[correctIdx];
  const wrongOpts = [];
  while(wrongOpts.length < 3){
    const cand = ARM_WORDS[Math.floor(Math.random()*ARM_WORDS.length)][1];
    if(cand !== correctPt && wrongOpts.indexOf(cand)===-1) wrongOpts.push(cand);
  }
  const options = [correctPt, ...wrongOpts];
  for(let i=options.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [options[i],options[j]]=[options[j],options[i]]; }
  return { en, correctPt, options };
}

function publicQuestion(q){
  return { en: q.en, options: q.options }; // nunca manda qual é a certa
}

function attachArmGame(io){
  const nsp = io.of('/armgame');
  const WIN_STREAK = 3; // precisa acertar 3 SEGUIDAS de verdade — se o outro interromper, zera

  function startMatch(playerA, playerB){
    const roomId = 'r' + (++roomCounter);
    const room = { id: roomId, players: [playerA, playerB], streak: 0, streakOwner: null, question: null, roundAnswers: [null,null], roundOver: false, ended: false };
    rooms.set(roomId, room);
    playerA.socket.join(roomId);
    playerB.socket.join(roomId);
    playerA.socket.data.roomId = roomId; playerA.socket.data.playerIndex = 0;
    playerB.socket.data.roomId = roomId; playerB.socket.data.playerIndex = 1;

    room.question = pickQuestion();
    room.roundAnswers = [null,null];
    room.roundOver = false;
    playerA.socket.emit('start', { names: [playerA.name, playerB.name], streak: 0, streakOwner: null, winStreak: WIN_STREAK, youIndex: 0 });
    playerB.socket.emit('start', { names: [playerA.name, playerB.name], streak: 0, streakOwner: null, winStreak: WIN_STREAK, youIndex: 1 });
    nsp.to(roomId).emit('question', publicQuestion(room.question));
  }

  function resolveRound(nsp, roomId, room, winnerIdx){
    room.roundOver = true;
    if(winnerIdx !== null){
      if(room.streakOwner === winnerIdx){ room.streak++; }
      else { room.streakOwner = winnerIdx; room.streak = 1; } // interrompeu a sequência do outro — zera e começa a dele
    }
    // se ninguém acertou (winnerIdx null), a sequência de quem já tava na frente continua igual

    nsp.to(roomId).emit('round-result', { streak: room.streak, streakOwner: room.streakOwner, pusher: winnerIdx, correctPt: room.question.correctPt });

    if(room.streak >= WIN_STREAK){
      const winnerIndex = room.streakOwner;
      room.ended = true;
      setTimeout(()=>{ nsp.to(roomId).emit('gameover', { winnerIndex, names:[room.players[0].name, room.players[1].name] }); }, 900);
      return;
    }
    setTimeout(()=>{
      if(room.ended) return;
      room.question = pickQuestion();
      room.roundAnswers = [null,null];
      room.roundOver = false;
      nsp.to(roomId).emit('question', publicQuestion(room.question));
    }, 1600);
  }

  nsp.on('connection', (socket)=>{

    socket.on('find-match', (playerName, ack)=>{
      const name = (playerName||'Jogador').toString().trim().slice(0,16) || 'Jogador';
      if(waitingPlayer && waitingPlayer.socket.connected && waitingPlayer.socket.id !== socket.id){
        const opponent = waitingPlayer;
        waitingPlayer = null;
        startMatch(opponent, { socket, name });
        if(typeof ack === 'function') ack({ ok:true, matched:true });
      } else {
        waitingPlayer = { socket, name };
        socket.data.waiting = true;
        if(typeof ack === 'function') ack({ ok:true, matched:false });
      }
    });

    socket.on('cancel-search', ()=>{
      if(waitingPlayer && waitingPlayer.socket.id === socket.id){
        waitingPlayer = null;
      }
      socket.data.waiting = false;
    });

    socket.on('answer', (selected)=>{
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if(!room || room.ended || !room.question || room.roundOver) return;
      const pIdx = socket.data.playerIndex;
      if(room.roundAnswers[pIdx]) return; // já respondeu essa pergunta

      const isCorrect = selected === room.question.correctPt;
      room.roundAnswers[pIdx] = { correct: isCorrect, time: Date.now() };

      // feedback PRIVADO só pra quem respondeu agora
      socket.emit('self-answered', { correct: isCorrect, correctPt: room.question.correctPt });

      if(isCorrect){
        // corrida: quem acerta primeiro fecha a rodada NA HORA, o outro nem precisa
        // terminar de responder — perdeu essa rodada por ser mais lento (ou não saber).
        resolveRound(nsp, roomId, room, pIdx);
        return;
      }

      // errou: se o outro jogador já tinha respondido antes (e também errou), a
      // rodada acaba sem ninguém vencer. Se o outro ainda não respondeu, espera ele.
      const otherIdx = 1-pIdx;
      if(room.roundAnswers[otherIdx]){
        resolveRound(nsp, roomId, room, null);
      }
    });

    socket.on('disconnect', ()=>{
      if(waitingPlayer && waitingPlayer.socket.id === socket.id){
        waitingPlayer = null;
      }
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if(!room) return;
      if(!room.ended){
        room.ended = true;
        socket.to(roomId).emit('opponent-left');
      }
      // limpa a sala depois de um tempo (dá margem pro outro jogador ainda ver a mensagem)
      setTimeout(()=>rooms.delete(roomId), 30000);
    });
  });
}

module.exports = attachArmGame;
