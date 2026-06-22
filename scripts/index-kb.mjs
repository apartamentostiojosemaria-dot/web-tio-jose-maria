#!/usr/bin/env node
// Indexer del knowledge base del bot IA.
// =====================================
// Recorre fuentes (Supabase + constantes hardcoded de HinojaresPage),
// genera embeddings con AWS Bedrock Titan v2 (eu-central-1, vector 1024),
// y hace upsert idempotente en kb_chunks (dedup por sha256 del content).
//
// Variables de entorno requeridas:
//   VITE_SUPABASE_URL              o SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY      (servicio, NO el anon)
//   AWS_BEDROCK_ACCESS_KEY_ID
//   AWS_BEDROCK_SECRET_ACCESS_KEY
//   AWS_BEDROCK_SESSION_TOKEN      (opcional)
//
// Uso:
//   node scripts/index-kb.mjs                 -> indexa todo (incremental)
//   node scripts/index-kb.mjs --source faq    -> solo una fuente
//   node scripts/index-kb.mjs --reindex       -> borra y re-embebe todo
//
// Idempotencia: content_hash sha256(content). Si el hash existe ya para esa
// (source_type, source_id), no se reembebe. Cambios en content provocan un
// nuevo embedding (queda el viejo hasta limpieza manual).

import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac } from 'node:crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AWS_KEY = process.env.AWS_BEDROCK_ACCESS_KEY_ID;
const AWS_SECRET = process.env.AWS_BEDROCK_SECRET_ACCESS_KEY;
const AWS_SESSION = process.env.AWS_BEDROCK_SESSION_TOKEN;
const REGION = 'eu-central-1';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[index-kb] FALTAN VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!AWS_KEY || !AWS_SECRET) {
    console.error('[index-kb] FALTAN AWS_BEDROCK_ACCESS_KEY_ID / SECRET');
    process.exit(1);
}

const args = process.argv.slice(2);
const onlySource = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;
const reindex = args.includes('--reindex');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// ============================================================
// Bedrock SigV4 — embed Titan v2:0 (1024 dims)
// ============================================================
async function bedrockEmbed(text) {
    const host = `bedrock-runtime.${REGION}.amazonaws.com`;
    const path = `/model/${encodeURIComponent('amazon.titan-embed-text-v2:0')}/invoke`;
    const url = `https://${host}${path}`;
    const payload = JSON.stringify({ inputText: text, dimensions: 1024, normalize: true });

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256(payload);

    const headers = {
        host,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
    };
    if (AWS_SESSION) headers['x-amz-security-token'] = AWS_SESSION;

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames.map(h => `${h}:${headers[h]}\n`).join('');
    const signedHeaders = signedHeaderNames.join(';');

    const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateStamp}/${REGION}/bedrock/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256(canonicalRequest),
    ].join('\n');

    const kDate = createHmac('sha256', `AWS4${AWS_SECRET}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(REGION).digest();
    const kService = createHmac('sha256', kRegion).update('bedrock').digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${AWS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, Authorization: authHeader },
        body: payload,
    });
    if (!res.ok) throw new Error(`Bedrock embed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { embedding: data.embedding, tokens: data.inputTextTokenCount };
}

// ============================================================
// Upsert con dedup por content_hash
// ============================================================
async function upsertChunk({ sourceType, sourceId, title, content, metadata = {}, language = 'es' }) {
    const trimmed = content.trim();
    if (!trimmed) return { skipped: 'empty' };

    const hash = sha256(trimmed);
    const sourceIdStr = sourceId !== null && sourceId !== undefined ? String(sourceId) : null;

    // ¿Ya existe ese hash para esa fuente?
    if (!reindex) {
        const { data: existing } = await supabase
            .from('kb_chunks')
            .select('id')
            .eq('source_type', sourceType)
            .eq('content_hash', hash)
            .maybeSingle();
        if (existing) return { skipped: 'unchanged', id: existing.id };
    }

    const { embedding, tokens } = await bedrockEmbed(trimmed);

    const { data, error } = await supabase
        .from('kb_chunks')
        .upsert({
            source_type: sourceType,
            source_id: sourceIdStr,
            title,
            content: trimmed,
            content_hash: hash,
            embedding,
            metadata,
            language,
            token_count: tokens,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'source_type,source_id,content_hash', ignoreDuplicates: false })
        .select('id')
        .single();

    if (error) {
        console.error(`[index-kb] upsert error ${sourceType}/${sourceIdStr}: ${error.message}`);
        return { error: error.message };
    }
    return { embedded: true, id: data.id, tokens };
}

// ============================================================
// Fuentes
// ============================================================

// --- FAQs hardcoded (espejo de src/pages/HinojaresPage.jsx) ---
// Mantener sincronizado a mano hasta migrar a Supabase.
const FAQ_ITEMS = [
    { q: '¿Dónde está Hinojares y cómo llegar?', a: 'Hinojares es un pueblo de la provincia de Jaén (Andalucía, España), en la comarca de la Sierra de Cazorla, Segura y Las Villas. Está a unos 120 km de Jaén capital (1 h 30 en coche), 140 km de Granada (1 h 50), 70 km de Úbeda (1 h) y 380 km de Madrid (4 h). El acceso se hace por carretera; no hay tren ni autobús directo desde grandes ciudades. Aeropuertos más cercanos: Granada-Jaén (1 h 50) y Almería (2 h 10).' },
    { q: '¿Cuál es la mejor época para visitar Hinojares y la Sierra de Cazorla?', a: 'Primavera (abril-junio) y otoño (septiembre-noviembre) son las mejores épocas: temperaturas agradables (15-25 °C), paisajes en plena explosión (almendros en flor en primavera, ocres del olivar en otoño) y menos afluencia. El verano es cálido pero seco (20-32 °C) y permite disfrutar de ríos y piscinas naturales. En invierno (3-10 °C) la sierra ofrece silencio, cielos limpios y planes junto a la chimenea.' },
    { q: '¿Qué se puede hacer en Hinojares y alrededores?', a: 'Senderismo en el Parque Natural de la Sierra de Cazorla (el mayor espacio protegido de España), visita a pueblos blancos cercanos (Cazorla, Quesada, Pozo Alcón), baño en ríos y piscinas naturales en verano, observación de fauna (cabra montés, buitre leonado, ciervo), turismo gastronómico (cordero segureño IGP, AOVE) y patrimonio cultural (Castellones de Ceal, yacimiento ibérico del siglo IV a.C.; Marquesado de Hinojares fundado en 1690 por Carlos II).' },
    { q: '¿Qué historia tiene Hinojares?', a: 'Hinojares tiene más de 2.500 años de historia. Sus orígenes documentados se remontan al siglo IV a.C. con el oppidum ibérico de Castellones de Ceal (a 5 km del pueblo). Los romanos lo llamaron Traxinum; en época árabe pasó a ser Hins-Nojar (por los hinojos silvestres). En 1690 el rey Carlos II creó el Marquesado de Hinojares. Hoy conserva tres barrios históricos: Barrio Bajo (con la iglesia de San Marcos del siglo XVII), Barrio Alto y Cuevas Nuevas (viviendas trogloditas que mantienen 18-22 °C todo el año).' },
    { q: '¿Cuál es la gastronomía típica de Hinojares?', a: 'La cocina de Hinojares es serrana y de raíz: migas con chorizo y panceta, rin-ran (ensalada fría de bacalao, patatas y pimientos), cordero segureño (carne de oveja con IGP), gachamigas (harina y agua, plato centenario), habas con jamón y carne de caza (jabalí, ciervo, perdiz). El aceite de oliva virgen extra de la comarca es uno de los mejores del mundo.' },
    { q: '¿Cuándo son las fiestas de Hinojares?', a: 'San Marcos el 25 de abril (procesión, tortas de San Marcos bendecidas, decoración con flores y trigo), las Fiestas de Agosto (verbenas, juegos tradicionales y actividades familiares a mediados de mes) y las Jornadas del Aceite de Oliva (otoño, con recolección, almazara y degustaciones).' },
    { q: '¿Se admiten mascotas en Apartamentos Tío José María?', a: 'No, en la actualidad los apartamentos no admiten mascotas. Para alternativas pet-friendly en la comarca, escríbenos por WhatsApp y te ayudamos a encontrar opciones.' },
    { q: '¿Cuánto cuestan los apartamentos y cómo se reservan?', a: 'Los precios van desde 60 € por noche en temporada baja. Cada apartamento (Albahaca, Tomillo, Lavanda, Romero) tiene su propia tarifa según capacidad y temporada. La reserva se hace directamente desde tiojosemaria.com sin comisiones de intermediarios. Para consultas concretas o estancias largas, contacta al +34 676 34 46 75 o apartamentostiojosemaria@gmail.com.' },
];

const PRACTICAL_FACTS_TEXT = `Datos prácticos de Hinojares:
- Población: ~343 habitantes (el municipio más pequeño de la provincia de Jaén)
- Altitud: 780 m sobre el nivel del mar
- Comarca: Sierra de Cazorla, Segura y Las Villas (mayor espacio protegido de España)
- Código postal: 23486 (provincia de Jaén, Andalucía)
- Clima: mediterráneo serrano. Inviernos suaves (3-10 °C), veranos cálidos y secos (20-32 °C)
- Mejor época para visitar: abril-junio y septiembre-noviembre.
- Distancias en coche: Cazorla pueblo 50 km (1 h), Úbeda 70 km (1 h), Jaén capital 120 km (1 h 30), Granada 140 km (1 h 50), Almería 175 km (2 h 10), Córdoba 220 km (2 h 40), Madrid 380 km (4 h).
- Aeropuertos más cercanos: Granada-Jaén (1 h 50) y Almería (2 h 10).
- Acceso: solo por carretera. No hay tren ni autobús directo.`;

const HISTORY_TEXT = `Historia de Hinojares (más de 2.500 años):
Origen ibérico (siglo IV a.C.): yacimiento Castellones de Ceal a 5 km del pueblo, oppidum fortificado con ~90 tumbas y cerámica griega, descubierto en 1955. Punto clave en la ruta entre el Guadalquivir y el Sureste peninsular.
Romanos: lo llamaron Traxinum.
Época árabe: Hins-Nojar (por los hinojos silvestres). Aldea dependiente de Pozo Alcón durante siglos.
1690: Carlos II crea el Marquesado de Hinojares, otorgándole estatus de villa.
Hoy conserva tres barrios históricos: Barrio Bajo (el más antiguo, con la iglesia de San Marcos del siglo XVII), Barrio Alto (junto al río, con huertos familiares) y Cuevas Nuevas (viviendas trogloditas del siglo XX que mantienen 18-22 °C todo el año).`;

const TRADITIONS_TEXT = `Fiestas y tradiciones de Hinojares:
- San Marcos (25 de abril): fiesta patronal con procesión de San Marcos y San Blas decorados con flores y haces de trigo. Se reparten tortas de San Marcos bendecidas: dulces redondos con bordes decorados mediante moldes de madera artesanos.
- Jornadas del Aceite de Oliva: programa de inmersión en la cultura del AOVE — recolección de aceituna, comida campera, visita a almazara y cena-degustación con aceite de primera prensada en frío.
- Fiestas de Agosto: verbenas, juegos tradicionales, concursos y actividades familiares durante mediados de agosto.`;

const GASTRONOMY_TEXT = `Gastronomía típica de Hinojares y la Sierra de Cazorla:
- Migas: pan rallado con ajo y aceite, acompañado de chorizo, panceta y pimientos.
- Rin-Ran: ensalada fría de bacalao desalado, patatas, pimientos rojos y cebolla.
- Cordero segureño (IGP): carne tierna criada en los pastos de la sierra, estrella de la comarca.
- Gachamigas: plato artesanal de harina, tradición centenaria de la cocina serrana.
- Habas con jamón: habas frescas de Hinojares guisadas con jamón de la sierra.
- Carne de caza: jabalí, ciervo y perdiz en guisos y estofados tradicionales.
- AOVE: el aceite de oliva virgen extra de la comarca es uno de los mejores del mundo.`;

const HOW_TO_VISIT_TEXT = `Cómo visitar Hinojares paso a paso:
1. Llegar en coche: Hinojares está al sureste de Jaén. Desde la A-44 (Madrid–Granada) tomar la salida hacia Quesada–Pozo Alcón y seguir la A-326 hasta Hinojares. Aparcamiento gratuito en el pueblo.
2. Reservar alojamiento: elegir apartamento (Albahaca, Tomillo, Lavanda o Romero) en tiojosemaria.com según número de personas, sin comisiones.
3. Planificar la estancia: consultar rutas y excursiones en la sección /rutas de la web — desde paseos andando hasta excursiones de día completo a los grandes atractivos de Cazorla.
4. Disfrutar del pueblo y la sierra: recorrer los tres barrios históricos, conocer la historia milenaria, probar la gastronomía local y descubrir el Parque Natural de la Sierra de Cazorla.`;

const APARTMENTS_INFO = `Apartamentos Rurales Tío José María — 4 alojamientos en una casa del siglo XVII en Hinojares:
- Albahaca (2 plazas): apartamento romántico para parejas, primera planta con balcón de forja, vistas al Valle del Guadiana y muros de piedra del siglo XVII. Desde 60 € por noche en temporada baja.
- Tomillo (2 plazas): apartamento con vistas, segunda planta abuhardillada con techos de madera originales y vistas a la sierra. Desde 60 € por noche en temporada baja.
- Lavanda (4 plazas): apartamento familiar, esquina izquierda de la primera planta, dos baños y balcones al Valle del Guadiana. Salón con chimenea, cocina completa, dormitorio de matrimonio y otro doble. Desde 60 € por noche en temporada baja.
- Romero (4 plazas): apartamento familiar, esquina izquierda de la segunda planta, dos baños y vistas al Valle del Guadiana Menor. Salón con chimenea, dos dormitorios independientes. Desde 60 € por noche en temporada baja.

Todos los apartamentos incluyen WiFi gratis, calefacción, ropa de cama, toallas, menaje de cocina, chimenea (Albahaca, Lavanda, Romero) o vistas (Tomillo). No se admiten mascotas. Reserva directa sin comisiones en tiojosemaria.com.

Contacto: +34 676 34 46 75 · apartamentostiojosemaria@gmail.com
Dirección: Calle Baja 1, 23486 Hinojares (Jaén). Registro turístico: VTAR/JA/00044.`;

const CONTACT_INFO = `Contacto Apartamentos Tío José María:
- Teléfono / WhatsApp: +34 676 34 46 75
- Email: apartamentostiojosemaria@gmail.com
- Dirección: Calle Baja 1, 23486 Hinojares (Jaén), Andalucía, España.
- Registro turístico: VTAR/JA/00044 (Junta de Andalucía, Vivienda Turística de Alojamiento Rural).
- Reservas directas (sin comisiones) en tiojosemaria.com
- Cancelaciones, modificaciones, dudas sobre apartamentos o estancia: por WhatsApp o email.
- Para temas médicos, citas oficiales o pagos: no se gestionan por chat, se redirige al canal apropiado.`;

const HARDCODED_CHUNKS = [
    ...FAQ_ITEMS.map((it, i) => ({
        sourceType: 'faq',
        sourceId: `hinojares-faq-${i + 1}`,
        title: it.q,
        content: `Pregunta: ${it.q}\n\nRespuesta: ${it.a}`,
        metadata: { origin: 'HinojaresPage.jsx' },
    })),
    { sourceType: 'hinojares_content', sourceId: 'hinojares-datos-practicos', title: 'Datos prácticos de Hinojares', content: PRACTICAL_FACTS_TEXT, metadata: { origin: 'HinojaresPage.jsx' } },
    { sourceType: 'hinojares_content', sourceId: 'hinojares-historia', title: 'Historia de Hinojares', content: HISTORY_TEXT, metadata: { origin: 'HinojaresPage.jsx' } },
    { sourceType: 'hinojares_content', sourceId: 'hinojares-tradiciones', title: 'Fiestas y tradiciones de Hinojares', content: TRADITIONS_TEXT, metadata: { origin: 'HinojaresPage.jsx' } },
    { sourceType: 'hinojares_content', sourceId: 'hinojares-gastronomia', title: 'Gastronomía típica', content: GASTRONOMY_TEXT, metadata: { origin: 'HinojaresPage.jsx' } },
    { sourceType: 'how_to', sourceId: 'how-to-visit-hinojares', title: 'Cómo visitar Hinojares paso a paso', content: HOW_TO_VISIT_TEXT, metadata: { origin: 'HinojaresPage.jsx' } },
    { sourceType: 'apartment', sourceId: 'apartments-overview', title: 'Apartamentos Tío José María — visión general', content: APARTMENTS_INFO, metadata: { origin: 'static' } },
    { sourceType: 'custom', sourceId: 'contact-info', title: 'Contacto y datos generales', content: CONTACT_INFO, metadata: { origin: 'static' } },
];

// ============================================================
// Fuentes Supabase (se ejecutan solo si las tablas tienen filas)
// ============================================================
async function indexApartments() {
    const { data } = await supabase.from('apartments').select('*').eq('is_active', true);
    if (!data || data.length === 0) return [];
    return data.map(a => ({
        sourceType: 'apartment',
        sourceId: a.slug || String(a.id),
        title: `Apartamento ${a.name}`,
        content: [
            `Apartamento ${a.name} (${a.capacity_people} plazas, ${a.bathrooms} baños).`,
            a.description || a.short_description || '',
            a.bed_config ? `Configuración: ${a.bed_config}.` : '',
            `Tarifa: desde ${a.price_low}€ (temporada baja), ${a.price_high}€ (temporada alta).`,
            Array.isArray(a.amenities) && a.amenities.length ? `Servicios: ${a.amenities.join(', ')}.` : '',
            `URL: https://tiojosemaria.com/apartamento/${a.slug}`,
        ].filter(Boolean).join('\n'),
        metadata: { slug: a.slug, capacity: a.capacity_people, registration: a.registration_number },
    }));
}

async function indexRoutes() {
    const { data } = await supabase.from('routes').select('*');
    if (!data || data.length === 0) return [];
    return data.map(r => ({
        sourceType: 'route',
        sourceId: r.slug || String(r.id),
        title: r.title,
        content: [
            r.title,
            r.description || r.excerpt || '',
            r.distance_km ? `Distancia: ${r.distance_km} km.` : '',
            r.duration ? `Duración: ${r.duration}.` : '',
            r.difficulty ? `Dificultad: ${r.difficulty}.` : '',
            r.elevation_gain ? `Desnivel positivo: ${r.elevation_gain} m.` : '',
            Array.isArray(r.highlights) && r.highlights.length ? `Destacados: ${r.highlights.join(', ')}.` : '',
        ].filter(Boolean).join('\n'),
        metadata: { slug: r.slug, distance_km: r.distance_km, difficulty: r.difficulty },
    }));
}

async function indexLocalEvents() {
    const { data } = await supabase.from('local_events').select('*').eq('active', true);
    if (!data || data.length === 0) return [];
    return data.map(e => ({
        sourceType: 'event',
        sourceId: e.slug || String(e.id),
        title: e.title,
        content: [
            e.title,
            e.description || '',
            e.event_date ? `Fecha: ${e.event_date}.` : '',
            e.season ? `Temporada: ${e.season}.` : '',
            e.location ? `Lugar: ${e.location}.` : '',
            e.organizer ? `Organiza: ${e.organizer}.` : '',
        ].filter(Boolean).join('\n'),
        metadata: { slug: e.slug, season: e.season, category: e.category },
    }));
}

async function indexLocalPlaces() {
    const { data } = await supabase.from('local_places').select('*');
    if (!data || data.length === 0) return [];
    return data.map(p => ({
        sourceType: 'place',
        sourceId: p.slug || String(p.id),
        title: p.name,
        content: [
            `${p.name} (${p.type}).`,
            p.description || p.excerpt || '',
            p.address ? `Dirección: ${p.address}.` : '',
            p.phone ? `Teléfono: ${p.phone}.` : '',
            p.web_url ? `Web: ${p.web_url}.` : '',
        ].filter(Boolean).join('\n'),
        metadata: { slug: p.slug, type: p.type, category: p.category },
    }));
}

async function indexBlogPosts() {
    const { data } = await supabase.from('blog_posts').select('*').eq('published', true);
    if (!data || data.length === 0) return [];
    return data.map(p => ({
        sourceType: 'blog_post',
        sourceId: p.slug,
        title: p.title,
        content: [
            p.title,
            p.excerpt || '',
            p.content || '',
        ].filter(Boolean).join('\n').slice(0, 6000),     // truncamos posts muy largos
        metadata: { slug: p.slug, category: p.category, tags: p.tags },
    }));
}

async function indexHinojaresContentTable() {
    const { data } = await supabase.from('hinojares_content').select('*').eq('active', true);
    if (!data || data.length === 0) return [];
    return data.map(c => ({
        sourceType: 'hinojares_content',
        sourceId: String(c.id),
        title: c.title,
        content: `${c.title}\n${c.content || ''}`,
        metadata: { type: c.type, emoji: c.emoji },
    }));
}

async function indexGuestGuides() {
    const { data } = await supabase.from('guest_guides').select('*');
    if (!data || data.length === 0) return [];
    return data.map(g => ({
        sourceType: 'guide',
        sourceId: String(g.id),
        title: g.title,
        content: [
            g.title,
            g.description || '',
            g.duration ? `Duración: ${g.duration}.` : '',
            g.difficulty ? `Dificultad: ${g.difficulty}.` : '',
            g.location_url ? `Mapa: ${g.location_url}.` : '',
        ].filter(Boolean).join('\n'),
        metadata: { category: g.category },
    }));
}

// ============================================================
// Main
// ============================================================
const SOURCES = {
    faq:               () => Promise.resolve(HARDCODED_CHUNKS.filter(c => c.sourceType === 'faq')),
    hinojares_static:  () => Promise.resolve(HARDCODED_CHUNKS.filter(c => c.sourceType === 'hinojares_content' || c.sourceType === 'how_to')),
    apartments_static: () => Promise.resolve(HARDCODED_CHUNKS.filter(c => c.sourceType === 'apartment' || c.sourceType === 'custom')),
    apartments:        indexApartments,
    routes:            indexRoutes,
    events:            indexLocalEvents,
    places:            indexLocalPlaces,
    blog:              indexBlogPosts,
    hinojares_table:   indexHinojaresContentTable,
    guides:            indexGuestGuides,
};

async function main() {
    const t0 = Date.now();
    console.log(`[index-kb] iniciando${onlySource ? ` (solo ${onlySource})` : ''}${reindex ? ' [REINDEX]' : ''}`);

    if (reindex) {
        console.log('[index-kb] borrando kb_chunks existentes...');
        const { error } = await supabase.from('kb_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            console.error('[index-kb] error borrando:', error.message);
            process.exit(1);
        }
    }

    let totalEmbed = 0, totalSkip = 0, totalErr = 0, totalTokens = 0;

    for (const [name, loader] of Object.entries(SOURCES)) {
        if (onlySource && onlySource !== name) continue;
        const items = await loader();
        if (!items.length) { console.log(`[index-kb] ${name.padEnd(20)} 0 items`); continue; }

        let embed = 0, skip = 0, err = 0, tokens = 0;
        for (const item of items) {
            const r = await upsertChunk(item);
            if (r.embedded) { embed++; tokens += r.tokens || 0; }
            else if (r.skipped) skip++;
            else if (r.error) err++;
        }
        console.log(`[index-kb] ${name.padEnd(20)} ${embed} embed · ${skip} skip · ${err} err · ${tokens} tokens`);
        totalEmbed += embed; totalSkip += skip; totalErr += err; totalTokens += tokens;
    }

    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[index-kb] completado en ${dt}s · ${totalEmbed} embed · ${totalSkip} skip · ${totalErr} err · ${totalTokens} tokens`);
    if (totalErr > 0) process.exit(1);
}

main().catch((e) => {
    console.error('[index-kb] FATAL:', e);
    process.exit(1);
});
