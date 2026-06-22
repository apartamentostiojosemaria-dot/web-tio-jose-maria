#!/usr/bin/env node
// Genera iconos PWA cuadrados (192 y 512) a partir del logo horizontal.
// Centra el logo sobre fondo color marca, con padding para que no quede
// pegado a los bordes. Iconos maskable necesitan un "safe area" del 80%.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const ASSETS = join(PUBLIC, 'assets');

const BRAND_BG = { r: 252, g: 251, b: 249, alpha: 1 }; // surface warm cream
const SOURCE_LOGO = join(ASSETS, 'logo.jpg');

async function makeIcon(size, outPath) {
    // El logo horizontal se inscribe en el 70% del ancho; el resto es padding.
    const inner = Math.round(size * 0.7);
    const resized = await sharp(SOURCE_LOGO)
        .resize({ width: inner, height: inner, fit: 'inside', withoutEnlargement: false })
        .toBuffer();

    await sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: BRAND_BG,
        },
    })
        .composite([{ input: resized, gravity: 'center' }])
        .png({ compressionLevel: 9 })
        .toFile(outPath);

    console.log(`[pwa-icons] ${outPath} (${size}x${size})`);
}

async function main() {
    await makeIcon(192, join(ASSETS, 'pwa-192.png'));
    await makeIcon(512, join(ASSETS, 'pwa-512.png'));
    // favicon clásico (32px) y .ico fallback para crawlers/extensiones legacy
    // que piden /favicon.ico aunque haya <link rel="icon"> en el HTML.
    await makeIcon(32, join(ASSETS, 'favicon-32.png'));
    await makeIcon(32, join(PUBLIC, 'favicon.ico'));
}

main().catch(err => {
    console.error('[pwa-icons] error:', err);
    process.exit(1);
});
