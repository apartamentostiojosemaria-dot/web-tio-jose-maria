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
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');
const SITE_URL = 'https://tiojosemaria.com';

// Título estático del template (fallback para rutas no prerenderizadas).
// dedupeHead lo usa para distinguir el <title> del template del que pinta
// Helmet/React por página — ver comentario en dedupeHead.
const TEMPLATE_TITLE = (readFileSync(resolve(__dirname, '..', 'index.html'), 'utf8')
    .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();

const STATIC_ROUTES = [
    '/',
    '/hinojares',
    '/rutas',
    '/eventos',
    '/blog',
    '/reservar',
    // /reservar/confirmada NO se prerendiza (es post-pago, requiere query string ?code=)
    '/aviso-legal',
    '/privacidad',
    '/condiciones',
    '/apartamento/albahaca',
    '/apartamento/tomillo',
    '/apartamento/lavanda',
    '/apartamento/romero',
];

if (process.env.PRERENDER === 'skip') {
    console.log('[prerender] PRERENDER=skip → omitiendo');
    process.exit(0);
}

// --- Artículos de blog -------------------------------------------------
//
// En vez de volver a consultar Supabase aquí (con el riesgo de que la lista
// diverja de la que usa scripts/generate-sitemap.js si algún día cambian
// filtros/columnas por separado), leemos dist/sitemap.xml: ese fichero lo
// genera generate-sitemap.js ANTES de `vite build` en public/sitemap.xml, y
// Vite copia el contenido de public/ a dist/ durante el build. Como
// prerender.js corre DESPUÉS de `vite build` (ver package.json → script
// "build"), dist/sitemap.xml ya existe y es la fuente única de verdad: si
// una URL de blog está en el sitemap, se prerenderiza; si no, no.
function unescapeXml(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

function getBlogRoutesFromSitemap() {
    const sitemapPath = join(DIST, 'sitemap.xml');
    try {
        const xml = readFileSync(sitemapPath, 'utf8');
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => unescapeXml(m[1]).trim());
        const blogRoutes = locs
            .filter((loc) => loc.startsWith(`${SITE_URL}/blog/`))
            .map((loc) => loc.slice(SITE_URL.length).replace(/\/+$/, '')) // sin trailing slash
            .filter((route, i, arr) => route && arr.indexOf(route) === i); // dedupe
        return blogRoutes;
    } catch (e) {
        console.warn(`[prerender] No se pudo leer ${sitemapPath} para sacar los artículos de blog (${e.message}). Se prerenderizan solo las rutas estáticas.`);
        return [];
    }
}

const ROUTES = [...STATIC_ROUTES, ...getBlogRoutesFromSitemap()];

// --- Deduplicación de <head> --------------------------------------------
//
// Por qué hacen falta: react-helmet-async v3, con react@19 instalado aquí,
// usa siempre React19Dispatcher (src/React19Dispatcher.tsx), que renderiza
// <title>/<meta>/<link> como elementos React normales y deja que React 19
// los "hoistee" de forma nativa a <head> — NO muta el <title> ya existente
// (a diferencia de su Dispatcher legacy, que sí hacía document.title = ...
// sobre el nodo existente). Tampoco los marca con data-rh: ese atributo solo
// lo pone el Dispatcher legacy (ver node_modules/react-helmet-async, HELMET_ATTRIBUTE
// solo se usa en updateTags/updateAttributes, no en React19Dispatcher). Así
// que "quedarnos con el que tiene data-rh" no sirve aquí — no existe tal marca.
//
// Verificado en producción (tiojosemaria.com, 2026-07-17): la home ya
// servida tiene 3x <title>, 2x <link rel="canonical"> y 2x <meta
// name="description">: el <title> estático del index.html original, el que
// Helmet hoistea durante ESTE prerender, y (para rutas que no se
// prerenderizaban, como los artículos de blog) los que arrastraba el
// index.html de "/" que nginx servía como fallback.
//
// React siempre AÑADE sus recursos de <head> al final, después de todo lo
// que ya hubiera — nunca sustituye ni reordena nodos existentes. Por tanto
// la ÚLTIMA aparición de cada tag en el documento es siempre la correcta
// (la de Helmet para la ruta que se está prerenderizando) y las anteriores
// son restos que hay que borrar.
function dedupeHead(html) {
    const headMatch = html.match(/<head[^>]*>[\s\S]*?<\/head>/i);
    if (!headMatch) return { html, removed: 0 };
    const original = headMatch[0];
    let head = original;
    let removed = 0;

    const keepLastMatch = (text, regex) => {
        const matches = [...text.matchAll(regex)];
        let result = text;
        for (let i = 0; i < matches.length - 1; i += 1) {
            result = result.replace(matches[i][0], '');
            removed += 1;
        }
        return result;
    };

    // <title>: React 19 PREPENDE sus tags hoistables al inicio del <head>
    // (no los añade al final), así que "quedarse con el último" elegiría el
    // estático del template. Regla robusta por CONTENIDO: si hay varios
    // títulos, se conserva el primero que difiera del título estático del
    // template (el de Helmet/React); si todos son iguales, se deja uno.
    {
        const titles = [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)];
        if (titles.length > 1) {
            const differing = titles.find((t) => t[1].trim() !== TEMPLATE_TITLE);
            const keep = differing || titles[0];
            for (const t of titles) {
                if (t !== keep) {
                    head = head.replace(t[0], '');
                    removed += 1;
                }
            }
        }
    }

    // <link rel="canonical">: nos quedamos solo con el último. No tocamos el
    // resto de <link> (favicons, manifest, preconnect...): esos no los
    // gestiona Helmet en esta app y nunca se duplican.
    head = keepLastMatch(head, /<link[^>]+rel=["']canonical["'][^>]*\/?>/gi);

    // <meta name="..."> / <meta property="..."> gestionados por Helmet
    // (description, robots, og:*, twitter:*): agrupamos por su
    // identificador y nos quedamos solo con la última aparición de cada
    // uno. meta charset/viewport (sin name/property) no entran aquí porque
    // Helmet nunca los toca y no se duplican.
    const metaRegex = /<meta[^>]*>/gi;
    const metas = [...head.matchAll(metaRegex)];
    const keyOf = (tag) => {
        const name = tag.match(/\bname=["']([^"']+)["']/i);
        const property = tag.match(/\bproperty=["']([^"']+)["']/i);
        if (name) return `name:${name[1].toLowerCase()}`;
        if (property) return `property:${property[1].toLowerCase()}`;
        return null;
    };
    const lastIndexByKey = new Map();
    metas.forEach((m, i) => {
        const key = keyOf(m[0]);
        if (key) lastIndexByKey.set(key, i);
    });
    metas.forEach((m, i) => {
        const key = keyOf(m[0]);
        if (key && lastIndexByKey.get(key) !== i) {
            head = head.replace(m[0], '');
            removed += 1;
        }
    });

    if (head === original) return { html, removed: 0 };
    return { html: html.replace(original, head), removed };
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
    console.log(`[prerender] Iniciando para ${ROUTES.length} rutas (${STATIC_ROUTES.length} estáticas + ${ROUTES.length - STATIC_ROUTES.length} artículos de blog)...`);
    await prerenderer.initialize();

    let rendered;
    try {
        rendered = await prerenderer.renderRoutes(ROUTES);
    } finally {
        await prerenderer.destroy();
    }

    let totalBytes = 0;
    for (const r of rendered) {
        const { html, removed } = dedupeHead(r.html);
        // Para "/" sobreescribimos el index.html raíz; para el resto creamos subcarpeta.
        const targetDir = r.route === '/' ? DIST : join(DIST, r.route);
        mkdirSync(targetDir, { recursive: true });
        writeFileSync(join(targetDir, 'index.html'), html, 'utf8');
        totalBytes += html.length;
        const dedupeNote = removed > 0 ? ` (−${removed} tags duplicados)` : '';
        console.log(`[prerender] ${r.route.padEnd(40)} → ${(html.length / 1024).toFixed(1)} KB${dedupeNote}`);
    }

    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[prerender] Completado en ${dt}s · ${rendered.length} rutas · ${(totalBytes / 1024).toFixed(1)} KB total`);
}

main().catch((e) => {
    console.error('[prerender] FAILED:', e);
    process.exit(1);
});
