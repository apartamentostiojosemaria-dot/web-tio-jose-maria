import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['assets/logo.jpg', 'assets/pwa-192.png', 'assets/pwa-512.png'],
            manifest: {
                lang: 'es',
                name: 'Tío José María - Apartamentos Rurales',
                short_name: 'Tío José María',
                description: 'Apartamentos rurales con encanto en Hinojares, Sierra de Cazorla',
                theme_color: '#556B2F',
                background_color: '#FCFBF9',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                categories: ['travel', 'lifestyle'],
                icons: [
                    {
                        src: '/assets/pwa-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/assets/pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/assets/pwa-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2}'],
                // Admin panel (recharts, qrcode.react, ~30 manager screens) and the
                // authenticated client area are never visited by an anonymous public
                // visitor — precaching them bloats the SW install for everyone who only
                // ever sees the public site. Their chunks are named with a stable
                // admin-/client- prefix by build.rollupOptions.output below, so they can
                // be excluded here by filename instead of enumerating every component.
                globIgnores: ['**/admin-*.js', '**/client-*.js'],
                runtimeCaching: [
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                        },
                    },
                    {
                        // Cache CartoDB Voyager tiles (maps offline!)
                        urlPattern: /^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'map-tiles',
                            expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                    {
                        // Cache Supabase API responses — SOLO tablas de contenido público
                        // (lo que consultan las páginas públicas en src/hooks/useDatabase.js).
                        // guest_bookings, invoices, profiles, traveler_records, documents,
                        // customers, etc. quedan fuera a propósito: son datos personales de
                        // huéspedes/reservas y NO deben persistir en el Cache Storage de un
                        // dispositivo compartido. hinojares_content se incluye de antemano
                        // por si se usa en un desarrollo paralelo (tabla de contenido público).
                        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(apartments|local_events|local_places|routes|reviews|web_config|blog_posts|hinojares_content|guidebooks|high_seasons)(\?.*)?$/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-api',
                            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                            networkTimeoutSeconds: 5,
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Cache Supabase Storage images (object + render image transform)
                        // Las imágenes webp/srcset generadas por el optimizador caen aquí.
                        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/(?:object|render\/image)\/public\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'supabase-storage-images',
                            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Cache images from Unsplash and other CDNs
                        urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'external-images',
                            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                ],
            },
        }),
    ],
    root: '.',
    build: {
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'motion': ['framer-motion'],
                    'supabase': ['@supabase/supabase-js'],
                    'leaflet': ['leaflet', 'react-leaflet'],
                    // recharts + qrcode.react are only imported from src/components/admin/
                    // (AnalyticsDashboard, AdminHome, QRCodeManager) — named with the
                    // admin- prefix so it's excluded from the PWA precache like the rest
                    // of the admin panel (see workbox.globIgnores above).
                    'admin-charts': ['recharts', 'qrcode.react'],
                    'seo': ['react-helmet-async'],
                },
                // Stable admin-/client- filename prefix for the lazy-loaded panel chunks
                // (AdminDashboard + its ~30 manager screens, ClientArea, ClientLogin...).
                // Does NOT change how code is split — each screen keeps its own chunk,
                // loaded on demand — it only renames the output file so workbox's
                // globIgnores can exclude the whole panel by a stable glob instead of
                // listing every component name (which changes every time one is added).
                chunkFileNames: (chunkInfo) => {
                    // facadeModuleId is unset for some dynamic-entry chunks (e.g. AdminDashboard
                    // itself, which bundles several statically-imported admin subcomponents), so
                    // fall back to scanning every module id the chunk actually contains. A chunk
                    // can only contain admin/client modules if it was reached through an
                    // admin/client dynamic import — public pages never import from those folders.
                    const norm = (p) => (p || '').replace(/\\/g, '/');
                    const ids = [chunkInfo.facadeModuleId, ...(chunkInfo.moduleIds || [])].map(norm);
                    if (ids.some((id) => id.includes('/src/components/admin/'))) return 'assets/admin-[name]-[hash].js';
                    if (ids.some((id) => id.includes('/src/components/client/'))) return 'assets/client-[name]-[hash].js';
                    return 'assets/[name]-[hash].js';
                },
            },
        },
    },
    server: {
        port: 3000,
        open: '/index.html'
    }
});
