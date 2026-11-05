// Avisos push del panel (Web Push). Lo importa el service worker que genera
// vite-plugin-pwa (vite.config.js → workbox.importScripts). Quien los manda es
// la base, a través de la edge function push-enviar (migración 0041).
self.addEventListener('push', (event) => {
    let datos = { titulo: 'Tío José María', texto: '', url: '/panel' };
    try { datos = { ...datos, ...event.data.json() }; } catch { /* sin cuerpo: aviso genérico */ }
    event.waitUntil(self.registration.showNotification(datos.titulo, {
        body: datos.texto,
        lang: 'es',
        icon: '/assets/pwa-192.png',
        badge: '/assets/pwa-192.png',
        data: { url: datos.url || '/panel' },
        tag: 'tjm-' + (datos.url || datos.titulo || '').slice(0, 60),
        renotify: true,
    }));
});

// Al pulsar el aviso se abre la pantalla que dice el aviso (5-nov-2026: antes, con la aplicación
// ya abierta, `navigate` podía fallar en silencio y solo se enseñaba la app tal como estaba).
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = new URL((event.notification.data && event.notification.data.url) || '/panel', self.location.origin).href;
    event.waitUntil((async () => {
        const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const propia = ventanas.find((v) => v.url.startsWith(self.location.origin));
        if (propia) {
            try {
                const nueva = await propia.navigate(url);   // solo funciona si la ventana es nuestra (controlada)
                if (nueva) return nueva.focus();
            } catch { /* ventana no controlada: se abre una nueva abajo */ }
        }
        return self.clients.openWindow(url);
    })());
});
