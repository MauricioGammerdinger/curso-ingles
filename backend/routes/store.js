// store.js — venda de "Patinhas" (moeda do app) via Stripe Checkout.
//
// COMO ATIVAR DE VERDADE (quando você tiver sua conta Stripe):
//   1. Cria conta em https://dashboard.stripe.com (precisa de CPF/CNPJ + dados bancários)
//   2. Pega sua Secret Key em Developers > API keys
//   3. No Render, adiciona a variável de ambiente STRIPE_SECRET_KEY com essa chave
//   4. Cria um Webhook em Developers > Webhooks, apontando pra:
//        https://SEU-BACKEND.onrender.com/api/store/webhook
//      escutando o evento "checkout.session.completed"
//   5. Pega o "Signing secret" do webhook e coloca em STRIPE_WEBHOOK_SECRET no Render
// Sem essas variáveis configuradas, a loja mostra uma mensagem de "ainda não disponível"
// em vez de dar erro — o app inteiro continua funcionando normal.
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('./auth');

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://mauriciogammerdinger.github.io/curso-ingles';
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// os pacotes ficam definidos NO SERVIDOR (nunca confia no preço que vem do navegador —
// senão qualquer pessoa poderia abrir o console e comprar 10.000 Patinhas por R$0,01).
const PACKS = {
  pack_p: { amountCents: 490,  patinhas: 100, label: '100 Patinhas' },
  pack_m: { amountCents: 990,  patinhas: 300, label: '300 Patinhas' },
  pack_g: { amountCents: 1990, patinhas: 800, label: '800 Patinhas' }
};

router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Pagamentos ainda não estão configurados. Volte mais tarde!' });
    }
    const pack = PACKS[req.body && req.body.packId];
    if (!pack) return res.status(400).json({ error: 'Pacote inválido.' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'brl',
          product_data: { name: '🐾 ' + pack.label + ' — Gatolíngua' },
          unit_amount: pack.amountCents
        },
        quantity: 1
      }],
      metadata: { userId: String(req.userId), patinhas: String(pack.patinhas) },
      success_url: FRONTEND_URL + '/?compra=sucesso',
      cancel_url: FRONTEND_URL + '/?compra=cancelada'
    });
    res.json({ url: session.url });
  } catch (e) { next(e); }
});

// Stripe chama essa função automaticamente quando o pagamento é CONFIRMADO — é aqui (não
// na tela de sucesso) que a gente credita as Patinhas de verdade, porque a tela de
// sucesso pode ser fechada, atualizada ou nunca carregar, mas o webhook sempre chega.
// PRECISA do corpo "crú" (sem JSON parseado) pra verificar a assinatura — por isso é
// registrado separadamente no server.js, ANTES do express.json() global.
async function webhookHandler(req, res) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(503).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Assinatura do webhook inválida: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = parseInt(session.metadata.userId, 10);
    const patinhas = parseInt(session.metadata.patinhas, 10);
    if (userId && patinhas) {
      await pool.query(`
        INSERT INTO progress (user_id, state_json)
        VALUES ($1, jsonb_build_object('patinhas', $2::int))
        ON CONFLICT (user_id) DO UPDATE
        SET state_json = jsonb_set(
          progress.state_json, '{patinhas}',
          to_jsonb(COALESCE((progress.state_json->>'patinhas')::int, 0) + $2::int)
        )
      `, [userId, patinhas]);
    }
  }
  res.json({ received: true });
}

module.exports = { router, webhookHandler };
