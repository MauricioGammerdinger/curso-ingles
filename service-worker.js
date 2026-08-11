// service-worker.js — cache do "app shell" pra funcionar offline e ser instalável no celular.
// Estratégia: network-first pro HTML (pra você sempre pegar a versão mais nova quando tiver
// internet), cache-first pra ícones (que não mudam). O login/progresso continuam precisando
// de internet, pois moram no servidor — só a interface do app funciona sem conexão.
//
// IMPORTANTE: sempre que você trocar ícones ou outros arquivos estáticos do app, aumente o
// número no CACHE_NAME abaixo (v1 -> v2 -> v3...). Isso força os navegadores que já instalaram
// o app a jogarem fora o cache antigo e buscarem os arquivos novos, em vez de continuar
// mostrando pra sempre a versão antiga que ficou guardada.
const CACHE_NAME = 'passaporte-ingles-v13';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nunca cacheia chamadas de API — login e progresso sempre precisam ir direto ao servidor.
  if (req.url.includes('/api/')) return;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

// Recebe a notificação push enviada pelo servidor e exibe pra pessoa — funciona tanto
// no PC quanto no celular (inclusive iPhone, desde que o app tenha sido adicionado à
// tela de início, já que o Safari só permite push pra apps instalados, não pra abas soltas).
self.addEventListener('push', (event) => {
  let data = { title: 'Gatolíngua', body: 'Seu gato tá esperando! 🐈‍⬛' };
  try{ if(event.data) data = event.data.json(); }catch(e){ /* usa o padrão acima */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Gatolíngua', {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
