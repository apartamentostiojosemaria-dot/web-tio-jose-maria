// Helper para servir imagenes de Supabase Storage redimensionadas y comprimidas
// en lugar del original (que puede pesar 1-3 MB y tarda en cargar en movil).
//
// Supabase Storage soporta transformaciones via la URL `/render/image/public/`
// con query params width/height/quality/resize. La cuota gratuita es 100
// originales unicos/mes, sobrada para los ~80 archivos de la web.
//
// Si la URL no es de Supabase (Unsplash u otro CDN), devuelve la original.

const SUPABASE_PUBLIC = '/storage/v1/object/public/';
const SUPABASE_RENDER = '/storage/v1/render/image/public/';

export function transformImage(url, { width, height, quality = 80, resize = 'cover' } = {}) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes(SUPABASE_PUBLIC)) return url;

    const base = url.replace(SUPABASE_PUBLIC, SUPABASE_RENDER);
    const params = new URLSearchParams();
    if (width) params.set('width', String(width));
    if (height) params.set('height', String(height));
    if (quality) params.set('quality', String(quality));
    if (resize) params.set('resize', resize);
    return `${base}?${params.toString()}`;
}

// Helpers semanticos para casos comunes
export const thumb = (url) => transformImage(url, { width: 400 });
export const card = (url) => transformImage(url, { width: 800 });
export const hero = (url) => transformImage(url, { width: 1600, quality: 85 });
export const gallery = (url) => transformImage(url, { width: 1200 });
