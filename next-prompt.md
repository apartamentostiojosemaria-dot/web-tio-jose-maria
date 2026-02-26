---
page: index
---
Genera una aplicación React moderna, PREMIUM, INTERACTIVA y CINEMÁTICA basada en `index.html`.

**PROGRAMMATIC VIDEO (REMOTION):**
- Integra un componente `<VideoPresentation />` que simule una presentación cinematográfica de Remotion.
- Usa los textos: "Tío José María - Tu refugio histórico en Cazorla", "Casona del S.XIX restaurada con alma", "Siente el calor de la chimenea".
- El video debe tener transiciones suaves y tipografía *Playfair Display* superpuesta.

**ANIMATION & EFFECTS:**
- **Hover Interactions:** Botones con "elevación" y brillo. Cards con borde luminoso `#D6CEB8` y escala 1.02x.
- **Parallax Backgrounds:** Efectos `SimpleParallax` en imágenes clave.
- **Scroll Reveals:** Animaciones "Fade In Up" para todo el contenido.

**COMPONENT STRUCTURE:**
- `<Navigation />`: Menú flotante "Liquid Glass" (blur, rounded-2xl). Logo: `assets/logo.jpg`.
- `<HeroSection />`: Título cinematográfico, CTA clara.
- `<VideoPresentation />`: El video de marca integrado tras la intro.
- `<ServicesGrid />`: Los 4 apartamentos con estilo premium.
- `<Footer />`: Contacto respetando la info original.

**SEO & ACCESSIBILITY (REQUIRED):**
- **Semantic Structure:** Usa H1 para el título principal, H2 para secciones de apartamentos y servicios, y H3 para detalles.
- **Alt Attributes:** Todas las imágenes (incluyendo el logo y fotos de apartamentos) deben tener atributos `alt` descriptivos (ej. "Fachada histórica de Casa Rural Tío José María en Cazorla").
- **Meta Tags:** Genera etiquetas `<title>` y `<meta name="description">` optimizadas (ej. "Casa Rural Tío José María | Apartamentos con Encanto en Hinojares, Cazorla").

**SECURITY & QUALITY (REQUIRED):**
- **Safe React:** Evita el uso de `dangerouslySetInnerHTML`. Sanitiza cualquier entrada si es necesaria.
- **Component Security:** Asegura que los enlaces externos tengan `rel="noopener noreferrer"`.
- **Validation:** Todo el contenido debe ser componentes funcionales limpios, sin vulnerabilidades XSS.

**FINAL CHECK:** 
- Asegura que NO haya código HTML legacy. Todo debe ser componentes funcionales de React/Tailwind.
- Colores corporativos: Oliva (#556B2F) y Crema (#FCFBF9) dominantes.
