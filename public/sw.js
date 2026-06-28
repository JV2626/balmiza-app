self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Mantemos o service worker ativado para Web Push
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // Ignorar cache e ir direto para a rede
  event.respondWith(fetch(event.request));
});

// Listener para receber a notificação push em background
self.addEventListener('push', event => {
  let data = { title: 'Balmiza', body: 'Nova notificação da central' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Balmiza', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Ao clicar na notificação, foca ou abre a aba do Balmiza
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se houver uma aba aberta, foca nela
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não houver, abre uma nova aba
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
