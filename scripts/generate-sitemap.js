#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://tiojosemaria.com';
const OUTPUT = join(__dirname, '..', 'public', 'sitemap.xml');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nmtukksbzbnuzqsksdmw.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_c9yYvracSgXQm_VIV6UXUw_UZDOnX00';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const today = new Date().toISOString().slice(0, 10);

function escapeXml(value) {
    if (!value) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod = today, priority = '0.7', changefreq = 'monthly', images = [] }) {
    const imageBlock = images
        .filter(img => img && img.url)
        .map(img => {
            const caption = img.caption ? `\n      <image:caption>${escapeXml(img.caption)}</image:caption>` : '';
            const title = img.title ? `\n      <image:title>${escapeXml(img.title)}</image:title>` : '';
            return `    <image:image>\n      <image:loc>${escapeXml(img.url)}</image:loc>${caption}${title}\n    </image:image>`;
        })
        .join('\n');
    const imageSection = imageBlock ? `\n${imageBlock}` : '';
    // loc va siempre escapado: un slug/valor con "&" u otro caracter especial
    // no debe poder romper el XML (sitemap invalido = GSC lo descarta entero).
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${imageSection}\n  </url>`;
}

function isoDate(value) {
    if (!value) return today;
    return new Date(value).toISOString().slice(0, 10);
}

// Normaliza un slug de Supabase a como debe aparecer en la URL canonica:
// sin espacios sobrantes ni barras — así la URL nunca lleva trailing slash
// (coherente con los canonical que genera PageHead.jsx) ni queda vacía/rota
// por un valor sucio en la BD.
function normalizeSlug(slug) {
    if (!slug) return '';
    return String(slug).trim().replace(/^\/+|\/+$/g, '');
}

async function fetchTable(table, columns = 'slug, updated_at') {
    const { data, error } = await supabase.from(table).select(columns);
    if (error) {
        console.warn(`[sitemap] ${table}: ${error.message}`);
        return [];
    }
    return data || [];
}

async function main() {
    const urls = [
        urlEntry({ loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' }),
        urlEntry({ loc: `${SITE_URL}/hinojares`, priority: '0.9', changefreq: 'weekly' }),
        urlEntry({ loc: `${SITE_URL}/rutas`, priority: '0.9', changefreq: 'weekly' }),
        urlEntry({ loc: `${SITE_URL}/eventos`, priority: '0.9', changefreq: 'weekly' }),
        // /guia-cazorla ocultado del sitemap mientras lead magnet esta inactivo
        urlEntry({ loc: `${SITE_URL}/blog`, priority: '0.9', changefreq: 'weekly' }),
        urlEntry({ loc: `${SITE_URL}/reservar`, priority: '0.9', changefreq: 'monthly' }),
        urlEntry({ loc: `${SITE_URL}/aviso-legal`, priority: '0.2', changefreq: 'yearly' }),
        urlEntry({ loc: `${SITE_URL}/privacidad`, priority: '0.3', changefreq: 'yearly' }),
        urlEntry({ loc: `${SITE_URL}/condiciones`, priority: '0.4', changefreq: 'yearly' }),
    ];

    const apartments = await fetchTable('apartments', 'slug, name, updated_at, images, short_description');
    for (const a of apartments) {
        const slug = normalizeSlug(a.slug);
        if (!slug) continue;
        const images = (a.images || []).slice(0, 6).map((url, i) => ({
            url,
            title: `Apartamento ${a.name || slug}`,
            caption: i === 0 && a.short_description
                ? a.short_description
                : `Apartamento ${a.name || slug} en Casa Rural Tío José María, Hinojares (foto ${i + 1})`,
        }));
        urls.push(urlEntry({
            loc: `${SITE_URL}/apartamento/${slug}`,
            lastmod: isoDate(a.updated_at),
            priority: '0.8',
            images,
        }));
    }

    const posts = await fetchTable('blog_posts', 'slug, title, updated_at, published, featured_image_url, excerpt');
    for (const p of posts) {
        const slug = normalizeSlug(p.slug);
        if (!slug || p.published === false) continue;
        const images = p.featured_image_url
            ? [{
                url: p.featured_image_url,
                title: p.title || slug,
                caption: p.excerpt || p.title || '',
            }]
            : [];
        urls.push(urlEntry({
            loc: `${SITE_URL}/blog/${slug}`,
            lastmod: isoDate(p.updated_at),
            priority: '0.7',
            images,
        }));
    }

    const routes = await fetchTable('routes', 'slug, title, updated_at, image_url');
    // /rutas no tiene URL por ruta individual aun; cuando se anada se completa aqui.
    void routes;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset\n  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n  xmlns:image="http://www.google.com/schemas/sitemaps-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;

    writeFileSync(OUTPUT, xml, 'utf8');
    const totalImages = urls.reduce((acc, u) => acc + (u.match(/<image:image>/g) || []).length, 0);
    console.log(`[sitemap] ${urls.length} URLs (+${totalImages} imagenes) -> ${OUTPUT}`);
}

main().catch(err => {
    console.error('[sitemap] error:', err);
    process.exit(1);
});
