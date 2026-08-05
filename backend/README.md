# Backend — Meu Passaporte de Inglês

API em Node.js/Express que dá conta de: cadastro/login (JWT) e salvar/carregar o progresso
do app (XP, streak, badges, vocabulário conhecido, etc.) por usuário, num banco SQLite (arquivo local).

## Estrutura

```
backend/
  server.js      -> ponto de entrada, monta o Express
  auth.js         -> POST /api/auth/register, POST /api/auth/login, middleware requireAuth
  progress.js     -> GET/PUT /api/progress (protegidas por login)
  db.js           -> conexão SQLite + criação das tabelas
  .env.example    -> modelo de variáveis de ambiente
```

## 1. Rodando local (no seu notebook, pra desenvolver)

Primeiro você precisa de um banco Postgres — mesmo pra rodar local, é mais simples usar
um gratuito na nuvem (Neon) do que instalar Postgres na sua máquina:

1. Crie uma conta grátis em [neon.tech](https://neon.tech) (não pede cartão de crédito).
2. Crie um projeto novo — em segundos ele já te dá uma **connection string** parecida com:
   ```
   postgresql://usuario:senha@ep-xxxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Copie essa URL.

Depois:

```bash
cd backend
npm install
cp .env.example .env
```

Edite o `.env`:
- `DATABASE_URL` → cole a connection string do Neon
- `JWT_SECRET` → troque por um valor aleatório. Pra gerar um:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Depois:

```bash
npm start
```

Deve aparecer `Servidor rodando em http://localhost:3001` (na primeira vez ele cria as
tabelas automaticamente no banco).

Teste rápido:

```bash
curl http://localhost:3001/api/health
# {"ok":true}
```

O frontend (`index.html`) já está configurado com:

```js
const API_BASE = 'http://localhost:3001/api';
```

Então, com o backend rodando, é só abrir o `index.html` no navegador (ou servir com
`npx serve .` na pasta do frontend) que ele já conversa com a API local.

## 2. Por que não simplesmente deixar o notebook ligado como servidor público?

Dá pra rodar localmente, mas expor isso ao público direto do seu note tem 3 problemas
práticos: (1) sua operadora de internet residencial normalmente não te dá um IP público
fixo nem libera portas de entrada por padrão; (2) o serviço cai toda vez que você desliga,
dorme ou fecha a tampa do notebook; (3) expor sua rede doméstica direto pra internet é um
risco de segurança desnecessário. Pra "sempre online e público", o caminho mais simples é
um host gerenciado.

## 3. Deploy público (recomendado: Render, plano Free)

**Importante sobre o plano Free do Render:** ele não oferece disco persistente e o
serviço "dorme" depois de um tempo sem uso, acordando do zero na próxima visita — se o
banco fosse um arquivo local (SQLite), os dados sumiriam a cada vez que isso acontecesse.
Por isso o banco de dados mora separado, no Neon (grátis, sem cartão) — ele não é afetado
pelo "dormir" do Render, porque é uma conta/serviço totalmente diferente.

1. Se ainda não criou, crie sua conta e seu banco no [neon.tech](https://neon.tech) (seção 1)
   e copie a `DATABASE_URL`.
2. Suba a pasta `backend/` num repositório Git (GitHub, por exemplo). **Não** commite o
   arquivo `.env` — já deixei um `.gitignore` sugerido no final desta página.
3. Crie uma conta em [render.com](https://render.com) → **New Web Service** → conecte o repositório.
4. Configurações do serviço:
   - **Root Directory:** `backend` (se o repositório tiver o frontend na raiz e o backend numa subpasta)
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
   - **Instance Type:** Free
   - **Environment variables:** adicione `DATABASE_URL` (a do Neon), `JWT_SECRET` (um valor
     aleatório gerado como no passo 1) e `ALLOWED_ORIGIN` (a URL onde seu frontend vai
     ficar, ex: `https://seuusuario.github.io`).
5. Alternativas de hospedagem do backend equivalentes ao Render: **Railway** e **Fly.io**.
   Alternativas ao Neon pro banco: **Supabase** (Postgres) ou **Turso** (SQLite hospedado).

**Sobre o "dormir" por inatividade:** no plano Free, se o site ficar uns 15 minutos sem
receber visitas, o servidor desliga sozinho. Na próxima pessoa que abrir o app, o Render
acorda o servidor de novo — isso leva de 30 a 50 segundos na primeira requisição (a tela
de login pode demorar esse tempinho pra responder). Depois disso ele volta ao normal até
dormir de novo. É uma limitação chata mas sem solução gratuita — só melhora pagando um
plano pago do Render (a partir de uns US$7/mês) que mantém o serviço sempre ligado.

Depois do deploy, troque no `index.html`:

```js
const API_BASE = 'https://seu-servico.onrender.com/api';
```

## 4. Onde hospedar o frontend (`index.html`)

Como é um arquivo estático só, dá pra usar **GitHub Pages**, **Netlify** ou **Vercel**
(todos com plano grátis) — é literalmente arrastar a pasta ou conectar o repositório.

## 5. Segurança — o que já está implementado

- Senhas nunca ficam em texto puro: são hasheadas com `bcryptjs` antes de salvar.
- Login usa mensagem genérica ("e-mail ou senha incorretos") pra não revelar se um e-mail
  existe na base.
- `express-rate-limit` limita tentativas de registro/login (20 a cada 15 min por IP) —
  importante porque o cadastro é público, então vai atrair bots eventualmente.
- Tokens JWT expiram em 30 dias; depois disso a pessoa precisa logar de novo.
- CORS restrito ao domínio do frontend em produção (configure `ALLOWED_ORIGIN`).

## 7. App no celular sem loja (PWA)

O frontend já é um **PWA** (Progressive Web App): tem `manifest.json`, `service-worker.js`
e ícones prontos na pasta raiz do projeto. Isso significa que dá pra "instalar" o app na
tela inicial do celular sem passar pela Play Store/App Store — ele abre em tela cheia, com
ícone próprio, como um app nativo qualquer.

**Pra isso funcionar, o frontend precisa estar publicado com HTTPS** (GitHub Pages, Netlify
e Vercel já dão isso de graça — ver seção 4). Service worker e instalação de PWA não
funcionam em HTTP puro (só em `localhost`, pra desenvolvimento).

⚠️ **Atenção ao IP do backend**: depois de publicar o backend (seção 3), você vai ter uma URL
`https://...`. Troque isso no `index.html`:

```js
const API_BASE = 'https://seu-servico.onrender.com/api'; // era http://localhost:3001/api
```

Se você publicar o frontend em HTTPS mas deixar o `API_BASE` apontando pra
`http://localhost:3001`, o celular vai bloquear a chamada (navegador não deixa uma página
HTTPS chamar um servidor HTTP — "mixed content"). As duas partes (frontend e backend)
precisam estar em HTTPS.

**Como a pessoa instala no celular:**
- **Android (Chrome):** ao abrir o site, geralmente aparece um banner "Adicionar à tela
  inicial" sozinho. Se não aparecer, menu (⋮) → "Adicionar à tela inicial" / "Instalar app".
- **iPhone (Safari):** toque no ícone de compartilhar (□ com seta pra cima) → "Adicionar à
  Tela de Início". *Isso só funciona no Safari — no Chrome do iPhone essa opção não existe,
  é uma limitação da Apple.*

Depois de instalado, o app abre com o próprio ícone, sem barra de endereço do navegador —
visualmente indistinguível de um app baixado de loja. Login/progresso continuam precisando
de internet (ficam no servidor); só a interface do app funciona offline graças ao service
worker.

## 8. O que considerar depois (não bloqueia o lançamento, mas vale planejar)

- **Verificação de e-mail**: hoje qualquer e-mail é aceito sem confirmação. Se quiser
  reduzir contas falsas, dá pra adicionar depois com um serviço de envio de e-mail
  (Resend, SendGrid).
- **Reset de senha**: ainda não existe endpoint pra "esqueci minha senha" — quem perder a
  senha perde o acesso à conta. Fácil de adicionar depois seguindo o mesmo padrão de token.
- **LGPD**: como é um cadastro público brasileiro, considere adicionar uma política de
  privacidade simples e um jeito de a pessoa pedir exclusão dos dados (`DELETE /api/account`,
  não implementado ainda).
- **Backup do banco**: SQLite é um arquivo só — vale configurar um backup periódico
  (mesmo que seja copiar o arquivo pra outro lugar de tempos em tempos) assim que tiver
  usuários de verdade.

## .gitignore sugerido

```
node_modules/
.env
server.log
```
