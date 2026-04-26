#!/usr/bin/env node
// Genera iconos PWA cuadrados (192 y 512) a partir del logo horizontal.
// Centra el logo sobre fondo color marca, con padding para que no quede
// pegado a los bordes. Iconos maskable necesitan un "safe area" del 80%.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'public', 'assets');

const BRAND_BG = { r: 252, g: 251, b: 249, alpha: 1 }; // surface warm cream
const SOURCE_LOGO = join(ASSETS, 'logo.jpg');

async function makeIcon(size, outName) {
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
        .toFile(join(ASSETS, outName));

    console.log(`[pwa-icons] ${outName} (${size}x${size})`);
}

async function main() {
    await makeIcon(192, 'pwa-192.png');
    await makeIcon(512, 'pwa-512.png');
}

main().catch(err => {
    console.error('[pwa-icons] error:', err);
    process.exit(1);
});
