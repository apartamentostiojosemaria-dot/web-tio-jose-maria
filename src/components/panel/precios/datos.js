// Todo lo que la pantalla de Precios lee y escribe en la base.
//
// Dos normas que no se saltan:
//
// 1. Se escribe por función de la base (RPC) cuando existe. Si todavía no
//    está creada, se cae al método directo sobre la tabla. Así esta pantalla
//    funciona antes y después de que aterricen las funciones nuevas.
// 2. Después de CADA guardado se vuelve a leer de la base y se comprueba que
//    el valor nuevo está de verdad. Un permiso puede rechazar la escritura
//    sin dar error (devuelve 0 filas y se queda tan ancho): si no comprobamos,
//    la pantalla diría "Guardado" y la web seguiría cobrando lo de antes.

import { supabase } from '../../../lib/supabase';

// ───────────────────────── ayudas ─────────────────────────

// ¿El error es "esa función todavía no existe"?
const faltaLaFuncion = (error) => {
    if (!error) return false;
    const codigo = error.code || '';
    const texto = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    return codigo === 'PGRST202' || codigo === '42883'
        || texto.includes('could not find the function')
        || texto.includes('does not exist');
};

// ¿El error es "no tienes permiso"?
const esPermiso = (error) => {
    if (!error) return false;
    const codigo = error.code || '';
    const texto = `${error.message || ''}`.toLowerCase();
    return codigo === '42501' || codigo === 'PGRST301' || texto.includes('row-level security') || texto.includes('permission denied');
};

const NO_GUARDADO = 'No se ha podido guardar: el sistema no me deja tocar esto. Avisa a Jesús y no lo intentes otra vez.';

function traduce(error) {
    if (esPermiso(error)) return NO_GUARDADO;
    if (faltaLaFuncion(error)) return 'Esta parte todavía no está terminada por dentro. Avisa a Jesús.';
    return 'No se ha podido guardar. Inténtalo otra vez dentro de un momento.';
}

const alFallar = (error) => { throw new Error(traduce(error)); };

// Las funciones de la base NO revientan cuando algo no cuadra: contestan
// { ok: false, error: '...' } y el cliente lo ve como si hubiera ido bien.
// Por eso hay que mirar SIEMPRE el contenido de la respuesta, no solo el error.
const MOTIVOS = {
    no_autorizado: NO_GUARDADO,
    precio_invalido: 'Ese precio no vale. Escribe un número entre 1 y 10.000.',
    fechas_invalidas: 'Esas fechas no cuadran: el primer día tiene que ir antes que el último.',
    apartamento_no_encontrado: 'No encuentro ese apartamento. Vuelve a cargar la pantalla.',
};

/**
 * Llama a una función de la base. Si esa función todavía no existe, hace
 * `respaldo()` (escritura directa sobre la tabla). Devuelve cuando ha ido bien
 * y lanza un aviso en castellano cuando no.
 */
async function porFuncion(nombre, parametros, respaldo) {
    const { data, error } = await supabase.rpc(nombre, parametros);

    if (error && faltaLaFuncion(error) && respaldo) {
        const { error: fallo } = await respaldo();
        if (fallo) alFallar(fallo);
        return null;
    }
    if (error) alFallar(error);
    if (data && data.ok === false) {
        throw new Error(MOTIVOS[data.error] || 'No se ha podido guardar. Avisa a Jesús.');
    }
    return data;
}

const igual = (a, b) => Number(a) === Number(b);

// ───────────────────────── lectura ─────────────────────────

export async function leerApartamentos() {
    const { data, error } = await supabase
        .from('apartments')
        .select('id, name, price_low, price_high, is_active')
        .order('name');
    if (error) throw new Error('No he podido leer los apartamentos.');
    return data || [];
}

export async function leerTemporadas() {
    const { data, error } = await supabase
        .from('high_seasons')
        .select('id, name, start_date, end_date')
        .order('start_date');
    if (error) throw new Error('No he podido leer las temporadas.');
    return data || [];
}

// Precios especiales y mínimos de noches viven los dos en la misma tabla
// interna; aquí se leen por separado para que la pantalla no lo note.
async function leerCondiciones(tipo) {
    const { data, error } = await supabase
        .from('pricing_rules')
        .select('id, name, apartment_id, rule_type, night_price, threshold_days, valid_from, valid_until, active')
        .eq('rule_type', tipo)
        .eq('active', true);
    // Si la columna `night_price` todavía no existe, la consulta falla entera:
    // se reintenta sin ella para que la pantalla siga en pie.
    if (error && (error.code === '42703' || `${error.message}`.includes('night_price'))) {
        const reintento = await supabase
            .from('pricing_rules')
            .select('id, name, apartment_id, rule_type, threshold_days, valid_from, valid_until, active')
            .eq('rule_type', tipo)
            .eq('active', true);
        if (reintento.error) return [];
        return reintento.data || [];
    }
    if (error) return [];
    return data || [];
}

export const leerPreciosEspeciales = () => leerCondiciones('special_price');
export const leerMinimos = () => leerCondiciones('min_nights');

// Solo lo que ha cerrado ella o nosotros a mano. Lo que llega de otras webs
// no se enseña ni se deja borrar: se sincroniza solo y no es suyo.
export async function leerCierres(desde) {
    const { data, error } = await supabase
        .from('blocked_dates')
        .select('id, apartment_id, start_date, end_date, reason, source')
        .in('source', ['cierre', 'manual'])
        .gte('end_date', desde)
        .order('start_date');
    if (error) throw new Error('No he podido leer los días cerrados.');
    return data || [];
}

// Cuántos días están ocupados desde fuera (Airbnb y compañía). Solo el número,
// para que no parezca que faltan días sin explicación.
export async function contarOcupadosPorOtros(desde) {
    const { count, error } = await supabase
        .from('blocked_dates')
        .select('id', { count: 'exact', head: true })
        .not('source', 'in', '("cierre","manual")')
        .gte('end_date', desde);
    if (error) return 0;
    return count || 0;
}

export async function leerExtras() {
    const { data, error } = await supabase
        .from('addons')
        .select('id, name, price_cents, per, active, sort_order')
        .order('sort_order')
        .order('name');
    if (error) throw new Error('No he podido leer los extras.');
    return data || [];
}

export async function leerTodo(hoyStr) {
    const [apartamentos, temporadas, especiales, minimos, cierres, ocupadosFuera, extras] = await Promise.all([
        leerApartamentos(), leerTemporadas(), leerPreciosEspeciales(),
        leerMinimos(), leerCierres(hoyStr), contarOcupadosPorOtros(hoyStr), leerExtras(),
    ]);
    return { apartamentos, temporadas, especiales, minimos, cierres, ocupadosFuera, extras };
}

// ───────────────── 1. lo que cuesta cada apartamento ─────────────────

export async function guardarPrecios(id, normal, alta) {
    await porFuncion(
        'set_apartment_prices',
        { p_apartment_id: id, p_price_low: normal, p_price_high: alta },
        () => supabase.from('apartments').update({ price_low: normal, price_high: alta }).eq('id', id),
    );

    const apartamentos = await leerApartamentos();
    const guardado = apartamentos.find((a) => a.id === id);
    if (!guardado || !igual(guardado.price_low, normal) || !igual(guardado.price_high, alta)) {
        throw new Error(NO_GUARDADO);
    }
    return { apartamentos, guardado };
}

// ───────────────────── 2. temporadas altas ─────────────────────

export async function anadirTemporada({ nombre, desde, hasta }) {
    const { error } = await supabase.from('high_seasons')
        .insert({ name: nombre, start_date: desde, end_date: hasta });
    if (error) alFallar(error);

    const temporadas = await leerTemporadas();
    const existe = temporadas.some((t) => t.name === nombre && t.start_date === desde && t.end_date === hasta);
    if (!existe) throw new Error(NO_GUARDADO);
    return temporadas;
}

export async function quitarTemporada(id) {
    const { error } = await supabase.from('high_seasons').delete().eq('id', id);
    if (error) alFallar(error);

    const temporadas = await leerTemporadas();
    if (temporadas.some((t) => t.id === id)) throw new Error(NO_GUARDADO);
    return temporadas;
}

// ───────────── 3. precio especial para unas fechas ─────────────

export async function ponerPrecioEspecial({ apartamentoId, desde, hasta, precio, nombre }) {
    await porFuncion(
        'set_special_price',
        {
            p_apartment_id: apartamentoId,   // null = todos los apartamentos
            p_from: desde,
            p_to: hasta,
            p_night_price: precio,
            p_name: nombre,
        },
        () => supabase.from('pricing_rules').insert({
            apartment_id: apartamentoId,
            name: nombre,
            rule_type: 'special_price',
            night_price: precio,
            valid_from: desde,
            valid_until: hasta,
            active: true,
            priority: 100,
        }),
    );

    const especiales = await leerPreciosEspeciales();
    const existe = especiales.some((e) => e.valid_from === desde && e.valid_until === hasta
        && (e.apartment_id ?? null) === (apartamentoId ?? null));
    if (!existe) throw new Error(NO_GUARDADO);
    return especiales;
}

export async function quitarPrecioEspecial(id) {
    await porFuncion(
        'delete_pricing_rule', { p_rule_id: id },
        () => supabase.from('pricing_rules').delete().eq('id', id),
    );

    const especiales = await leerPreciosEspeciales();
    if (especiales.some((e) => e.id === id)) throw new Error(NO_GUARDADO);
    return especiales;
}

// ───────────────────── 4. mínimo de noches ─────────────────────

// `temporada` va con sus fechas cuando el mínimo es solo de esa temporada;
// sin ella, el mínimo vale para todo el año.
export async function guardarMinimo({ id, nochesMinimas, nombre, desde = null, hasta = null }) {
    const fila = {
        apartment_id: null,
        name: nombre,
        rule_type: 'min_nights',
        threshold_days: nochesMinimas,
        valid_from: desde,
        valid_until: hasta,
        active: true,
    };

    await porFuncion(
        'set_min_nights',
        { p_nights: nochesMinimas, p_from: desde, p_to: hasta, p_name: nombre, p_rule_id: id ?? null },
        () => (id
            ? supabase.from('pricing_rules').update(fila).eq('id', id)
            : supabase.from('pricing_rules').insert(fila)),
    );

    const minimos = await leerMinimos();
    const existe = minimos.some((m) => Number(m.threshold_days) === Number(nochesMinimas)
        && (m.valid_from ?? null) === (desde ?? null) && (m.valid_until ?? null) === (hasta ?? null));
    if (!existe) throw new Error(NO_GUARDADO);
    return minimos;
}

export async function quitarMinimo(id) {
    await porFuncion(
        'delete_pricing_rule', { p_rule_id: id },
        () => supabase.from('pricing_rules').delete().eq('id', id),
    );

    const minimos = await leerMinimos();
    if (minimos.some((m) => m.id === id)) throw new Error(NO_GUARDADO);
    return minimos;
}

// ─────────────────── 5. no alquilar estos días ───────────────────

export async function cerrarDias({ apartamentoIds, desde, hasta, motivo, hoyStr }) {
    await porFuncion(
        'close_sales',
        { p_apartment_ids: apartamentoIds, p_from: desde, p_to: hasta, p_reason: motivo || null },
        () => supabase.from('blocked_dates').insert(
            apartamentoIds.map((apartmentId) => ({
                apartment_id: apartmentId,
                start_date: desde,
                end_date: hasta,
                reason: motivo || null,
                source: 'cierre',
            })),
        ),
    );

    const cierres = await leerCierres(hoyStr);
    const guardados = cierres.filter((c) => c.start_date === desde && c.end_date === hasta
        && apartamentoIds.includes(c.apartment_id));
    if (guardados.length !== apartamentoIds.length) throw new Error(NO_GUARDADO);
    return cierres;
}

export async function quitarCierre(id, hoyStr) {
    const { error } = await supabase.from('blocked_dates')
        .delete().eq('id', id).in('source', ['cierre', 'manual']);
    if (error) alFallar(error);

    const cierres = await leerCierres(hoyStr);
    if (cierres.some((c) => c.id === id)) throw new Error(NO_GUARDADO);
    return cierres;
}

// ───────────────────────── 6. extras ─────────────────────────

export async function guardarExtra({ id, nombre, precioCentimos, activo }) {
    const cambios = {};
    if (nombre !== undefined) cambios.name = nombre;
    if (precioCentimos !== undefined) cambios.price_cents = precioCentimos;
    if (activo !== undefined) cambios.active = activo;

    const { error } = await supabase.from('addons').update(cambios).eq('id', id);
    if (error) alFallar(error);

    const extras = await leerExtras();
    const guardado = extras.find((e) => e.id === id);
    if (!guardado) throw new Error(NO_GUARDADO);
    if (cambios.name !== undefined && guardado.name !== cambios.name) throw new Error(NO_GUARDADO);
    if (cambios.price_cents !== undefined && Number(guardado.price_cents) !== Number(cambios.price_cents)) throw new Error(NO_GUARDADO);
    if (cambios.active !== undefined && guardado.active !== cambios.active) throw new Error(NO_GUARDADO);
    return { extras, guardado };
}
