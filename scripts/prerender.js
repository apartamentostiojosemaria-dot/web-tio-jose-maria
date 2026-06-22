#!/usr/bin/env node
// Prerender de rutas críticas tras el build de Vite.
// Resuelve el problema de que la SPA sirva un shell vacío a crawlers que no ejecutan JS
// (Common Crawl, índices simples, algunos bots de IA).
//
// Genera dist/<ruta>/index.html con el HTML completo tras montar React + fetch a Supabase.
// nginx con `try_files $uri $uri/ /index.html` sirve automáticamente el HTML prerendered
// cuando la URL coincide con la subcarpeta, y cae al index SPA cuando no.
//
// Si la variable PRERENDER=skip está definida, el script no hace nada (útil para builds rápidos).

import Prerenderer from '@prerenderer/prerenderer';
import PuppeteerRenderer from '@prerenderer/renderer-puppeteer';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');

const ROUTES = [
    '/',
    '/hinojares',
    '/rutas',
    '/eventos',
    '/blog',
    '/reservar',
    // /reservar/confirmada NO se prerendiza (es post-pago, requiere query string ?code=)
    '/aviso-legal',
    '/privacidad',
    '/apartamento/albahaca',
    '/apartamento/tomillo',
    '/apartamento/lavanda',
    '/apartamento/romero',
];

if (process.env.PRERENDER === 'skip') {
    console.log('[prerender] PRERENDER=skip → omitiendo');
    process.exit(0);
}

const prerenderer = new Prerenderer({
    staticDir: DIST,
    indexPath: join(DIST, 'index.html'),
    renderer: new PuppeteerRenderer({
        // Espera tras navegar para que React monte y termine los fetch a Supabase
        renderAfterTime: 5000,
        headless: true,
        // Args necesarios para correr puppeteer en contenedor Alpine/Docker
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        // Si PUPPETEER_EXECUTABLE_PATH está definido (caso Docker Alpine con chromium del sistema)
        // se usa, si no puppeteer descarga el suyo.
        ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        }),
        maxConcurrentRoutes: 2,
    }),
});

async function main() {
    const t0 = Date.now();
    console.log(`[prerender] Iniciando para ${ROUTES.length} rutas...`);
    await prerenderer.initialize();

    let rendered;
    try {
        rendered = await prerenderer.renderRoutes(ROUTES);
    } finally {
        await prerenderer.destroy();
    }

    let totalBytes = 0;
    for (const r of rendered) {
        // Para "/" sobreescribimos el index.html raíz; para el resto creamos subcarpeta.
        const targetDir = r.route === '/' ? DIST : join(DIST, r.route);
        mkdirSync(targetDir, { recursive: true });
        writeFileSync(join(targetDir, 'index.html'), r.html, 'utf8');
        totalBytes += r.html.length;
        console.log(`[prerender] ${r.route.padEnd(40)} → ${(r.html.length / 1024).toFixed(1)} KB`);
    }

    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[prerender] Completado en ${dt}s · ${rendered.length} rutas · ${(totalBytes / 1024).toFixed(1)} KB total`);
}

main().catch((e) => {
    console.error('[prerender] FAILED:', e);
    process.exit(1);
});
