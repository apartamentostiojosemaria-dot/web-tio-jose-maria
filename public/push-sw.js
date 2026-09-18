// Avisos push del panel (Web Push). Lo importa el service worker que genera
// vite-plugin-pwa (vite.config.js → workbox.importScripts). Quien los manda es
// la base, a través de la edge function push-enviar (migración 0041).
self.addEventListener('push', (event) => {
    let datos = { titulo: 'Tío José María', texto: '', url: '/panel' };
    try { datos = { ...datos, ...event.data.json() }; } catch { /* sin cuerpo: aviso genérico */ }
    event.waitUntil(self.registration.showNotification(datos.titulo, {
        body: datos.texto,
        icon: '/assets/pwa-192.png',
        badge: '/assets/pwa-192.png',
        data: { url: datos.url || '/panel' },
        tag: 'tjm-' + (datos.titulo || '').slice(0, 40),
        renotify: true,
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = new URL((event.notification.data && event.notification.data.url) || '/panel', self.location.origin).href;
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
        for (const v of ventanas) {
            if (v.url.startsWith(self.location.origin) && 'focus' in v) { v.navigate(url); return v.focus(); }
        }
        return self.clients.openWindow(url);
    }));
});
