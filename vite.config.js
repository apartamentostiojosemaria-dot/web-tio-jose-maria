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
                        // Cache Supabase API responses
                        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-api',
                            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
                            networkTimeoutSeconds: 5,
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
                    'charts': ['recharts'],
                    'seo': ['react-helmet-async'],
                },
            },
        },
    },
    server: {
        port: 3000,
        open: '/index.html'
    }
});
