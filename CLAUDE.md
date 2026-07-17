# Apartamentos Tio Jose Maria

## What
Web de apartamentos rurales en Hinojares (Sierra de Cazorla). SPA con zona publica (reservas, rutas, info del pueblo), panel admin y area de clientes autenticados via Supabase.

## Stack
- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 (JSX, no TypeScript)
- **Backend/Auth**: Supabase (auth, DB, RLS) — config via env vars `VITE_SUPABASE_*`
- **Maps**: Leaflet + react-leaflet + CartoDB tiles
- **UI**: framer-motion, lucide-react, recharts, clsx + tailwind-merge
- **PWA**: vite-plugin-pwa con service worker (offline maps + API cache)
- **Deploy**: EasyPanel — Docker multi-stage (build Vite + prerender puppeteer → nginx). Los GitHub Actions del repo son SOLO renders Remotion (hero/reels), no deploy. `public/404.html` es legacy de GitHub Pages (ya no aplica).

## Structure
```
src/
  pages/          → Paginas de ruta (Home, Hinojares, Map, Events, Privacy)
  components/
    home/         → Secciones de la landing (Hero, Intro, Reviews, Footer...)
    admin/        → Panel admin (apartamentos, temporadas, disponibilidad, QR, analytics)
    client/       → Area cliente (login, welcome package, reviews)
    booking/      → Widget de reservas
    maps/         → Mapa interactivo y detalle de rutas
    shared/       → Componentes reutilizables (FadeInUp, Skeleton, CookieConsent)
    seo/          → JSON-LD structured data
  constants/      → Colores del brand y URLs externas
  hooks/          → useDatabase (queries Supabase)
  lib/supabase.js → Cliente Supabase singleton
  utils/          → Logger, validacion de archivos, sync service
public/assets/    → Imagenes, iconos PWA, robots.txt, sitemap.xml
```

## Rules
- Todo en castellano (UI, rutas, contenido). Rutas: `/apartamento/:slug`, `/rutas`, `/hinojares`, `/clientes`, `/admin`
- Auth via Supabase: admin ve AdminDashboard, cliente ve ClientArea, sin sesion redirige
- Variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` obligatorias
- No TypeScript — el proyecto es JSX puro
- Paleta de colores definida en `src/constants/colors.js` y clases Tailwind `rural-*`

## Conventions
- Componentes: PascalCase, un archivo `.jsx` por componente
- Imports: React explicitamente, named exports para constantes, default export para componentes
- Estilos: Tailwind utility-first, `clsx`/`tailwind-merge` para condicionales
- Animaciones: framer-motion `<FadeInUp>` wrapper
- Puerto dev: 3000 (`vite --port 3000`)
