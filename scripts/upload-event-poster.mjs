// Sube un cartel de evento al bucket event-posters usando service role.
// Uso: node scripts/upload-event-poster.mjs <ruta-archivo> [nombre-destino]
// El .env del proyecto debe tener VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (o cualquier alias razonable que probemos).

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL;

const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env');
    process.exit(1);
}

const filePath = process.argv[2];
const destName = process.argv[3] || basename(filePath);
if (!filePath) {
    console.error('Uso: node scripts/upload-event-poster.mjs <archivo> [nombre-destino]');
    process.exit(1);
}

const buf = readFileSync(filePath);
const ext = (filePath.split('.').pop() || 'jpg').toLowerCase();
const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await supabase.storage
    .from('event-posters')
    .upload(destName, buf, { contentType, upsert: true });

if (error) {
    console.error('Error subiendo:', error.message);
    process.exit(1);
}

const { data: { publicUrl } } = supabase.storage.from('event-posters').getPublicUrl(destName);
console.log(JSON.stringify({ ok: true, path: data.path, url: publicUrl }));
