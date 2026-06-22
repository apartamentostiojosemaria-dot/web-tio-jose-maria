// Helpers para Supabase Image Transformation
// ============================================
// Supabase Storage permite query params para servir imágenes optimizadas:
//   ?width=W&height=H&resize=cover&format=origin|webp&quality=Q
//
// IMPORTANTE: Image Transformations es feature de Supabase Pro. En plan
// Free devuelve 403. Por defecto el helper está DESACTIVADO y devuelve la
// URL original sin tocar. Para activar webp+srcset:
//   1. Upgrade del proyecto Supabase a Pro
//   2. .env: VITE_SUPABASE_IMAGE_TRANSFORM=true
//
// Sólo aplica a URLs del bucket público de Supabase. Otras URLs (WordPress
// histórico, externas) se devuelven sin tocar para no romperlas.

const TRANSFORM_ENABLED = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === 'true';

const SUPABASE_STORAGE_HOST = 'nmtukksbzbnuzqsksdmw.supabase.co';
const PUBLIC_PREFIX = '/storage/v1/object/public/';
const RENDER_PREFIX = '/storage/v1/render/image/public/';

const isSupabaseStorageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.includes(SUPABASE_STORAGE_HOST) && url.includes(PUBLIC_PREFIX);
};

const toRenderUrl = (url) => url.replace(PUBLIC_PREFIX, RENDER_PREFIX);

/**
 * Devuelve una URL transformada (webp + resize) si la imagen está en
 * Supabase Storage. Si no, devuelve la URL original sin modificar.
 *
 * @param {string} url URL original (puede ser Supabase, WP o externa)
 * @param {Object} opts
 * @param {number} [opts.width]   Ancho deseado en px
 * @param {number} [opts.height]  Alto deseado en px
 * @param {'cover'|'contain'|'fill'} [opts.resize='cover']
 * @param {number} [opts.quality=80]
 * @param {'webp'|'origin'} [opts.format='webp']
 * @returns {string}
 */
export const optimizedImage = (url, opts = {}) => {
    if (!TRANSFORM_ENABLED) return url;
    if (!isSupabaseStorageUrl(url)) return url;
    const { width, height, resize = 'cover', quality = 80, format = 'webp' } = opts;
    const params = new URLSearchParams();
    if (width) params.set('width', String(width));
    if (height) params.set('height', String(height));
    if (resize) params.set('resize', resize);
    if (quality) params.set('quality', String(quality));
    if (format) params.set('format', format);
    const q = params.toString();
    return q ? `${toRenderUrl(url)}?${q}` : url;
};

/**
 * Genera un srcSet responsive (1x/2x) para `<img srcSet>` cuando la imagen
 * está en Supabase. Para imágenes no-Supabase devuelve undefined.
 */
export const srcSetFor = (url, width) => {
    if (!TRANSFORM_ENABLED) return undefined;
    if (!isSupabaseStorageUrl(url) || !width) return undefined;
    return [
        `${optimizedImage(url, { width })} 1x`,
        `${optimizedImage(url, { width: width * 2 })} 2x`,
    ].join(', ');
};

/**
 * Atributos completos listos para spread en un `<img {...}>`. Incluye
 * `src`, `srcSet`, `width`, `height` cuando hay datos. Devuelve `{src}` sin
 * más si la URL no es de Supabase.
 */
export const imgAttrs = (url, { width, height, ...rest } = {}) => {
    if (!TRANSFORM_ENABLED || !isSupabaseStorageUrl(url)) {
        // Sin transformer: solo devolvemos src. width/height como atributos
        // mejoran CLS aunque la imagen no esté optimizada.
        return { src: url, ...(width && { width }), ...(height && { height }) };
    }
    return {
        src: optimizedImage(url, { width, height, ...rest }),
        srcSet: srcSetFor(url, width),
        ...(width && { width }),
        ...(height && { height }),
    };
};
