# 🛂 Meu Passaporte de Inglês

App de estudo de inglês (vocabulário, gramática e conversação) com trilha estilo Duolingo,
XP, streak, conquistas e conta de usuário pra salvar o progresso na nuvem. Instalável no
celular como PWA, sem passar por loja de app.

## Estrutura do projeto

```
.
├── index.html          # o app inteiro (frontend) — HTML/CSS/JS puro, sem build step
├── manifest.json        # configuração do PWA (instalação no celular)
├── service-worker.js    # cache pra funcionar offline
├── icons/                # ícones do app
└── backend/              # API (Node.js + Express + SQLite): login e progresso do usuário
    ├── server.js, auth.js, progress.js, db.js
    ├── package.json
    ├── .env.example
    └── README.md         # passo a passo de setup local e deploy do backend
```

## Rodando local

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env      # edite o JWT_SECRET (veja instruções no backend/README.md)
npm start                  # sobe em http://localhost:3001

# 2. Frontend
# Em outra aba de terminal, na raiz do projeto:
npx serve .                # ou simplesmente abra o index.html no navegador
```

O `index.html` já vem configurado pra falar com `http://localhost:3001/api` por padrão.

## Deploy (público, sempre online)

Veja o passo a passo completo em [`backend/README.md`](backend/README.md) — cobre deploy
do backend (Render, com banco persistente) e do frontend (GitHub Pages/Netlify/Vercel),
além da configuração de HTTPS necessária pro app instalar como PWA no celular.

## Stack

- **Frontend:** HTML/CSS/JS puro (sem framework, sem build step) + Service Worker (PWA)
- **Backend:** Node.js, Express, SQLite (`better-sqlite3`), JWT (`jsonwebtoken`), `bcryptjs`
- **Licença:** MIT — veja [`LICENSE`](LICENSE)

## Contribuindo / copiando este projeto

Fique à vontade pra clonar (`git clone`), dar fork, ou copiar qualquer parte pro seu
próprio projeto — é MIT, sem restrição. Se fizer melhorias, um Pull Request é bem-vindo,
mas não é obrigatório.
