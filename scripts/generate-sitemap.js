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

function urlEntry(loc, lastmod = today, priority = '0.7', changefreq = 'monthly') {
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function isoDate(value) {
    if (!value) return today;
    return new Date(value).toISOString().slice(0, 10);
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
        urlEntry(`${SITE_URL}/`, today, '1.0', 'weekly'),
        urlEntry(`${SITE_URL}/hinojares`, today, '0.9', 'weekly'),
        urlEntry(`${SITE_URL}/rutas`, today, '0.9', 'weekly'),
        urlEntry(`${SITE_URL}/eventos`, today, '0.9', 'weekly'),
        urlEntry(`${SITE_URL}/blog`, today, '0.9', 'weekly'),
        urlEntry(`${SITE_URL}/privacidad`, today, '0.3', 'yearly'),
    ];

    const apartments = await fetchTable('apartments', 'slug, updated_at');
    for (const a of apartments) {
        if (a.slug) urls.push(urlEntry(`${SITE_URL}/apartamento/${a.slug}`, isoDate(a.updated_at), '0.8'));
    }

    const posts = await fetchTable('blog_posts', 'slug, updated_at, published');
    for (const p of posts) {
        if (p.slug && p.published !== false) urls.push(urlEntry(`${SITE_URL}/blog/${p.slug}`, isoDate(p.updated_at), '0.7'));
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

    writeFileSync(OUTPUT, xml, 'utf8');
    console.log(`[sitemap] ${urls.length} URLs → ${OUTPUT}`);
}

main().catch(err => {
    console.error('[sitemap] error:', err);
    process.exit(1);
});
