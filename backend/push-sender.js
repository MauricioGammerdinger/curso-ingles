// push-sender.js — configura o web-push com as chaves VAPID e roda o "lembrete diário"
// pra quem instalou notificações e ainda não abriu o app hoje.
//
// IMPORTANTE sobre hospedagem gratuita: o Render free tier "dorme" o servidor depois de
// ~15 min sem requisições. Esse checador só roda enquanto o servidor está DESPERTO — ou
// seja, o lembrete pode atrasar (só dispara quando alguém acessar o site e "acordar" o
// servidor de novo). Pra ter horário garantido, seria preciso um serviço externo (tipo
// cron-job.org) batendo num endpoint aqui de tempos em tempos — dá pra configurar depois
// se quiser precisão de horário.
const webpush = require('web-push');
const { pool } = require('./db');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@gatolingua.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const REMINDER_MESSAGES = [
  '🐈‍⬛ Psst, seu gato tá esperando! Volta pra manter sua sequência viva.',
  '🐈‍⬛ Já treinou seu inglês hoje? Seu gato tá de olho...',
  '🔥 Não deixa sua sequência apagar hoje — só 2 minutinhos já ajudam!'
];

async function checkAndSendReminders() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return; // push não configurado nesse ambiente

  const today = todayStr();
  try {
    // busca inscricoes de gente que ainda nao foi avisada hoje, junto com o "lastActive"
    // salvo no progresso dela (pra saber se ja abriu o app hoje ou nao)
    const result = await pool.query(`
      SELECT ps.id, ps.endpoint, ps.subscription_json, p.state_json->>'lastActive' AS last_active
      FROM push_subscriptions ps
      JOIN progress p ON p.user_id = ps.user_id
      WHERE ps.last_notified_date IS DISTINCT FROM $1
    `, [today]);

    for (const row of result.rows) {
      const alreadyOpenedToday = row.last_active === today;
      if (alreadyOpenedToday) continue; // já abriu hoje, não precisa cutucar

      const msg = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];
      const payload = JSON.stringify({ title: 'Gatolíngua', body: msg, url: '/' });
      try {
        await webpush.sendNotification(row.subscription_json, payload);
      } catch (err) {
        // inscricao invalida/expirada (410 Gone, etc) -> remove pra nao tentar de novo
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
          continue;
        }
        console.error('Falha ao enviar push:', err.message);
        continue;
      }
      await pool.query('UPDATE push_subscriptions SET last_notified_date = $1 WHERE id = $2', [today, row.id]);
    }
  } catch (err) {
    console.error('Erro ao checar lembretes de push:', err.message);
  }
}

// roda a checagem a cada 30 minutos enquanto o servidor estiver de pé (ver aviso acima
// sobre o free tier dormir); também roda uma vez logo na subida do servidor.
function startReminderScheduler() {
  checkAndSendReminders();
  setInterval(checkAndSendReminders, 30 * 60 * 1000);
}

module.exports = { VAPID_PUBLIC_KEY, checkAndSendReminders, startReminderScheduler };
