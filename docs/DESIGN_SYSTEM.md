# Sistema de diseño — tio-jose-maria

> Colores, tipografía, espaciado y componentes, con sus valores exactos. Si existe un prototipo aprobado, va en
> `docs/prototipo/` como solo lectura: «referencia de diseño, no código».
> Intención visual («Rural Luxury», «Sophisticated Rustic»): `DESIGN.md`. Visión y mapa original: `SITE.md`.
> Valores de aquí: `src/index.css` (`@theme` de Tailwind 4), `src/main.jsx`, `src/components/panel/ui.jsx` (16-oct-2026).
> Prototipo aprobado en `docs/prototipo/`: no existe. Logo: `Archivos de Marca/`.

- Colores (tokens): definidos en `@theme` de `src/index.css`; `src/constants/colors.js` está marcado DEPRECATED (solo compatibilidad).
  | Token | Valor | Uso |
  |---|---|---|
  | `--color-primary` / `rural-600` | `#556B2F` | marca (Heritage Olive): CTA, activo, enlaces |
  | `--color-primary-dark` | `#3b4a20` | hover del primario |
  | `--color-secondary` | `#8C8468` | Warm Earth: subtítulos, acentos suaves |
  | `--color-accent` | `#D6CEB8` | Antique Sand: hover, bordes claros |
  | `--color-surface` / `rural-50` | `#FCFBF9` | fondo (Rustic Cream) |
  | `--color-surface-warm` | `#f5f2ea` | fondo cálido de secciones |
  | `--color-text-primary` / `--color-tinta` | `#2C3319` | texto (Forest Black) |
  | `--color-tinta-soft` | `#5C5444` | texto secundario editorial |
  | `--color-terracota` / `-soft` | `#B0593F` / `#E8C8B8` | CTA editorial cálido |
  | `--color-dorado` | `#A88A4A` | acento sutil |
  | `--color-papel` | `#F8F4EA` | crema editorial |
  | `--color-footer` / `-muted` | `#111827` / `#1f2937` | pie |
  | escala `rural-50…900` | `#FCFBF9` `#F0EDE6` `#E0D9CC` `#C4B99F` `#8B7D5E` `#6B7B3A` `#556B2F` `#4A5D28` `#3A4A1F` `#2A3615` | |
  Semánticos de contenido (mismo fichero): dificultad de rutas `level-easy/medium/hard/expert` (`#16a34a`, `#d97706`,
  `#ea580c`, `#dc2626` con fondos claros), estaciones `season-*` y tipos de lugar `place-*`.
  Vidrio de la navegación (`DESIGN.md`): `rgba(252, 251, 249, 0.6)` + `backdrop-filter: blur(24px)`, borde `rgba(85,107,47,0.1)`.

- Tipografía: todas autoalojadas con `@fontsource` (sin Google Fonts, decisión 30-jun, `dd84c39`).
  | Token | Familia | Pesos cargados | Uso |
  |---|---|---|---|
  | `--font-serif` | Playfair Display | 400, 400 italic, 600 | titulares H1/H2 |
  | `--font-sans` | Lato | 300, 400, 700 | cuerpo y UI pública |
  | `--font-display` | Fraunces | 400, 400 italic, 600 | titulares con personalidad |
  | `--font-editorial` | Newsreader | 400, 400 italic, 600 | cuerpo editorial largo |
  | `--font-ui` | Manrope | 300–700 | UI cálida |
  Interlineado ≥ 1,6 y tracking suave en mayúsculas (`DESIGN.md`). Escala tipográfica en px: pendiente de confirmar (Tailwind por defecto).

- Componentes base:
  - **Web pública** (`src/components/shared/`): `Button`, `Card`, `Badge`, `Input`, `SectionHeader`, `Skeleton`, `FadeInUp`
    (animación de entrada con framer-motion), `CookieConsent`, `AvisoActualizacion`, `SocialProofCard`, `ConsentMap`.
    Botón primario: fondo oliva, texto blanco, `rounded-full`, hover `translateY(-2px)`; tarjetas `rounded-xl`, hover escala
    1,02 y borde Antique Sand; transiciones 300 ms `cubic-bezier(0.4, 0, 0.2, 1)` (`DESIGN.md`).
  - **Panel de la familia** (`src/components/panel/ui.jsx`), pensado para una persona mayor en el móvil: `Boton`
    (`rounded-2xl`, alto mínimo 52 px; 60 px y `text-lg` en tamaño grande), `Tarjeta`, `Campo` (etiqueta, ayuda, error,
    obligatorio), `claseInput`, `Chip` (tonos), `Aviso` (info/éxito/error con acción), `Cargando`, `Dinero`. Constantes:
    `HORA_ENTRADA` «de 16:00 a 20:00», `HORA_SALIDA` «antes de las 12:00», zona `Europe/Madrid`; fechas en palabras.
    En móvil, listas en tarjetas (`38fb294`, 23-sep).
  - **Admin**: menú lateral sin anglicismos ni jerga (comentario de `AdminDashboard.jsx`).
  - Iconos: `lucide-react`. Gráficas: `recharts`. Mapas: Leaflet con OpenStreetMap.

- Claro / oscuro y contraste:
  - Solo modo claro en la práctica: `index.css` tiene un bloque `prefers-color-scheme: dark` que exige la clase `.dark` en
    `:root`, y ningún código la pone (búsqueda en `src/` e `index.html`, 16-oct).
  - Accesibilidad: enlace «Saltar al contenido» (`.skip-link`). Contraste medido de los pares de color: pendiente de confirmar.
  - Textos de herramienta con su nombre profesional (Reservas, Dinero, Limpiezas…), sin lenguaje poético.
