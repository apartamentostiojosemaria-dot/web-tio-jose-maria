// Cómo se escriben fechas y dinero en la pantalla de la madre.
// Todo en castellano llano: "del 2 al 5 de abril de 2026", "65 €".
// Las fechas se manejan SIEMPRE como texto "YYYY-MM-DD" para no pelearse
// con las zonas horarias de Date().

import { hoyISO, formatoEuro } from '../ui';

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// La fecha de hoy y el formato del dinero salen del panel, no se repiten aqui:
// una sola fuente para que no acaben diciendo cosas distintas.
export const hoy = hoyISO;

// "2026-04-02" -> "2 de abril de 2026"
export function fechaLarga(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${y}`;
}

// "2026-04-02","2026-04-05" -> "del 2 al 5 de abril de 2026"
export function rango(desde, hasta) {
    if (!desde) return '';
    if (!hasta || desde === hasta) return `el ${fechaLarga(desde)}`;
    const [ay, am, ad] = desde.split('-').map(Number);
    const [by, bm, bd] = hasta.split('-').map(Number);
    if (ay === by && am === bm) return `del ${ad} al ${bd} de ${MESES[am - 1]} de ${ay}`;
    if (ay === by) return `del ${ad} de ${MESES[am - 1]} al ${bd} de ${MESES[bm - 1]} de ${ay}`;
    return `del ${ad} de ${MESES[am - 1]} de ${ay} al ${bd} de ${MESES[bm - 1]} de ${by}`;
}

// 65 -> "65 €" · 64.5 -> "64,50 €"
export const euros = formatoEuro;

// Céntimos de la base -> euros de pantalla y vuelta.
export const centimosAEuros = (c) => (Number(c) || 0) / 100;
export const eurosACentimos = (e) => Math.round(Number(String(e).replace(',', '.')) * 100);

// Cómo se cobra un extra, dicho en cristiano.
export function comoSeCobra(per) {
    if (per === 'person_night') return 'por persona y noche';
    if (per === 'night') return 'por cada noche';
    return 'por estancia';
}

// "2" -> "2 noches" · "1" -> "1 noche"
export const noches = (n) => `${n} ${Number(n) === 1 ? 'noche' : 'noches'}`;

// Acepta "65", "65,5", "65.5" y devuelve número o null.
export function aNumero(txt) {
    if (txt === '' || txt === null || txt === undefined) return null;
    const v = Number(String(txt).replace(',', '.'));
    return isFinite(v) ? v : null;
}

// ["Albahaca","Tomillo"] -> "Albahaca y Tomillo"
export function listaY(nombres) {
    const l = nombres.filter(Boolean);
    if (l.length === 0) return '';
    if (l.length === 1) return l[0];
    return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}
