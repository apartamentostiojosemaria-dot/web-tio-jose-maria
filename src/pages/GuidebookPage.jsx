import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    MapPin, Shield, Phone, Wifi, Home, MessageCircle, FileText, Star,
    AlertTriangle, Loader2, Copy, Check, Smartphone, Mail, ChevronRight,
} from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';

// ============================================================
// La ficha del huésped — /guia/TJM-XXXXXX
// ============================================================
// Una página por reserva, sin usuario ni contraseña: el código de la
// reserva va en el enlace y es la llave (igual que en /precheckin). Le
// llega por el botón de los correos, por el QR que enseña Mari Carmen en
// la puerta, por el WhatsApp de «Recordárselo» y por la pantalla de
// «reserva confirmada» al pagar.
//
// Lo que enseña lo decide la reserva (función tjm_ficha_huesped, migr.
// 0035/0036): viva desde que se confirma hasta 30 días después de la
// salida; cancelada, caducada, a medio pagar o «no se presentó» → solo el
// motivo. Y cambia sola según el momento:
//   antes   → Tu reserva · Antes de venir (policía, llegar, llaves) · En la casa
//   dentro  → Tu reserva · (policía solo si falta) · En la casa · Al irte
//   después → Tu reserva · Al irte (factura, opinión)
//
// Sin código (/guia a secas): cómo abrirla y «he perdido el enlace», que
// manda el enlace al correo de la reserva (función enlace-guia). Nunca se
// enseña nada por escribir un correo: solo recibe el enlace quien ya lo
// tenía en su buzón.
// ============================================================

const MAPS_URL = 'https://maps.app.goo.gl/EPzh8j2HivLfqUeN8';
const GOOGLE_REVIEW_URL = 'https://g.page/r/CTDH4snlte-aEBM/review';
const WHATSAPP = '34676344675';
const TEL_HUMANO = '676 34 46 75';
const EMAIL = 'apartamentostiojosemaria@gmail.com';

const wa = (texto) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const aFecha = (iso) => (iso ? new Date(`${iso}T00:00:00`) : null);
const diaMes = (iso) => { const d = aFecha(iso); return d ? `${d.getDate()} de ${MESES[d.getMonth()]}` : ''; };
const diaLargo = (iso) => { const d = aFecha(iso); return d ? `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}` : ''; };
const euros = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const nombrePila = (n) => (n || '').trim().split(/\s+/)[0] || '';

/** Texto del manual → párrafos y listas («- algo» se convierte en viñeta). */
const Parrafos = ({ texto }) => {
    if (!texto) return null;
    const lineas = String(texto).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const salida = [];
    let lista = [];
    const vuelca = () => { if (lista.length) { salida.push(<ul key={`l${salida.length}`} className="list-disc pl-5 space-y-1">{lista.map((t, i) => <li key={i}>{t}</li>)}</ul>); lista = []; } };
    lineas.forEach((l) => {
        if (/^[-•·]\s*/.test(l)) lista.push(l.replace(/^[-•·]\s*/, ''));
        else { vuelca(); salida.push(<p key={`p${salida.length}`}>{l}</p>); }
    });
    vuelca();
    return <div className="space-y-2 text-[15px] leading-relaxed text-gray-800">{salida}</div>;
};

// ============================================================

const GuidebookPage = () => {
    const { code } = useParams();
    const codigo = (code || '').toUpperCase();
    const [ficha, setFicha] = useState(null);
    const [cargando, setCargando] = useState(!!codigo);
    const [fallo, setFallo] = useState(null);

    useEffect(() => {
        if (!codigo) return;
        let cortado = false;
        (async () => {
            const { data, error } = await supabase.rpc('tjm_ficha_huesped', { p_booking_code: codigo });
            if (cortado) return;
            if (error) setFallo('No hemos podido abrir tu guía. Prueba otra vez en un momento.');
            else setFicha(data);
            setCargando(false);
        })();
        return () => { cortado = true; };
    }, [codigo]);

    const titulo = ficha?.ventana === 'abierta'
        ? `Tu guía de la casa — ${ficha.reserva.apartamento}`
        : 'Tu guía de la casa — Tío José María';

    return (
        <div className="min-h-screen bg-[#FCFBF9] text-text-primary">
            <PageHead title={titulo} description="Tu reserva, cómo llegar y todo lo de la casa." path={codigo ? `/guia/${codigo}` : '/guia'} noindex />

            {!codigo ? <SinCodigo /> : cargando ? (
                <div className="flex flex-col items-center justify-center py-32 text-gray-500">
                    <Loader2 size={28} className="animate-spin mb-3" aria-hidden="true" />
                    <p>Abriendo tu guía…</p>
                </div>
            ) : fallo ? (
                <Cerrada titulo={fallo} />
            ) : ficha?.ventana !== 'abierta' ? (
                <Cerrada {...textoVentana(ficha?.ventana, codigo)} />
            ) : (
                <Ficha ficha={ficha} />
            )}
        </div>
    );
};

export default GuidebookPage;

// ---------------------------------------------------------------- cabecera

const Cabecera = ({ sub, titulo, linea }) => (
    <header className="bg-gradient-to-br from-rural-700 to-rural-800 text-white px-5 pt-8 pb-7">
        <div className="max-w-xl mx-auto">
            <p className="text-[11px] tracking-[3px] uppercase opacity-85">{sub || 'Apartamentos Rurales Tío José María'}</p>
            <h1 className="font-serif text-3xl font-bold mt-1 leading-tight">{titulo}</h1>
            {linea && <p className="mt-2 text-[15px] opacity-95">{linea}</p>}
        </div>
    </header>
);

const Pie = () => (
    <footer className="max-w-xl mx-auto px-5 py-8 text-center text-sm text-gray-500 leading-relaxed">
        <p>Para lo que necesitéis: <a className="text-rural-700 underline font-semibold" href={`https://wa.me/${WHATSAPP}`}>WhatsApp</a> · <a className="text-rural-700 underline" href={`tel:+${WHATSAPP}`}>{TEL_HUMANO}</a> · <a className="text-rural-700 underline" href={`mailto:${EMAIL}`}>correo</a></p>
        <p className="mt-1">Calle Baja 1, 23486 Hinojares (Jaén) · A/JA/00060 · <Link to="/privacidad" className="underline">Privacidad</Link></p>
    </footer>
);

// ---------------------------------------------------------------- la ficha

const Ficha = ({ ficha }) => {
    const { reserva: r, policia, cancelacion, factura, casa, momento } = ficha;
    const nombre = nombrePila(r.nombre);
    const antes = momento === 'antes';
    const dentro = momento === 'dentro';
    const despues = momento === 'despues';
    const hayZona = !!casa?.zona;

    return (
        <>
            <Cabecera
                titulo={nombre ? `Hola ${nombre}` : 'Hola'}
                linea={`${r.apartamento} · del ${diaMes(r.entrada)} al ${diaMes(r.salida)} · ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`}
            />

            <main className="max-w-xl mx-auto px-4 pb-4 -mt-3 space-y-3">

                {/* ---------- 1. Tu reserva ---------- */}
                <Bloque titulo="Tu reserva">
                    <Fila k="Código" v={<span className="font-mono font-bold text-rural-700">{r.codigo}</span>} />
                    <Fila k="Apartamento" v={<b>{r.apartamento}</b>} />
                    <Fila k="Entrada" v={`${diaLargo(r.entrada)}, desde las 16:00`} />
                    <Fila k="Salida" v={`${diaLargo(r.salida)}, antes de las 12:00`} />
                    <Fila k={r.es_canal ? 'Pagado' : 'Total'} v={r.es_canal ? `por ${nombreCanal(r.canal)}` : r.pagado ? `${euros(r.total)} · pagado` : `${euros(r.total)} · quedan ${euros(r.pendiente)} por pagar`} />
                    {antes && !r.es_canal && (
                        <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                            {cancelacion.gratis
                                ? <><b>Cancelación gratis hasta el {diaMes(cancelacion.gratis_hasta)}.</b> Después no se devuelve el importe, pero se puede cambiar de fechas una vez, sin coste, dentro de los 12 meses siguientes.</>
                                : <>Ya no se puede cancelar gratis (menos de 7 días). Si al final no podéis venir, se puede cambiar de fechas una vez, sin coste, dentro de los 12 meses siguientes.</>}
                            {' '}<Link to="/condiciones" className="underline">Condiciones</Link>.
                        </p>
                    )}
                </Bloque>

                {/* ---------- 2. Antes de venir ---------- */}
                {(antes || (dentro && !policia.completo)) && (
                    <Bloque titulo="Antes de venir">
                        <Policia policia={policia} codigo={r.codigo} />
                        {antes && (
                            <>
                                <div className="mt-4">
                                    <p className="text-[15px] leading-relaxed"><b>Cómo llegar:</b> Calle Baja 1, Hinojares. {casa?.aparcar || 'Se aparca gratis justo enfrente.'}</p>
                                    <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className={btnSec}><MapPin size={18} aria-hidden="true" /> Abrir en Google Maps</a>
                                </div>
                                <div className="mt-4">
                                    <p className="text-[15px] leading-relaxed"><b>Llaves:</b> {casa?.entrar || 'Os las damos en mano al llegar.'}</p>
                                    <a href={wa(`Hola, soy ${r.nombre} (${r.codigo}). Llegamos el ${diaMes(r.entrada)} sobre las `)} target="_blank" rel="noopener noreferrer" className={btnSec}><MessageCircle size={18} aria-hidden="true" /> Avisar de la hora por WhatsApp</a>
                                </div>
                            </>
                        )}
                    </Bloque>
                )}

                {/* ---------- 3. En la casa ---------- */}
                {!despues && (
                    <Bloque titulo="En la casa" nota="Lo que os contamos al daros las llaves, por escrito.">
                        {casa?.bienvenida && <p className="text-[15px] leading-relaxed text-gray-800 mb-3">{casa.bienvenida}</p>}
                        <ul className="space-y-3">
                            {casa?.wifi_red
                                ? <Item icono={Wifi} titulo="WiFi"><p>Red <b>{casa.wifi_red}</b>{casa.wifi_clave && <> · clave <Copiable texto={casa.wifi_clave} /></>}</p></Item>
                                : <Item icono={Wifi} titulo="WiFi"><p>El nombre de la red y la clave os los damos con las llaves.</p></Item>}
                            {casa?.aparatos && <Item icono={Home} titulo="Calefacción, cocina, toallas"><Parrafos texto={casa.aparatos} /></Item>}
                            {casa?.normas && <Item icono={Shield} titulo="Normas de la casa"><Parrafos texto={casa.normas} /></Item>}
                            {casa?.urgencias && <Item icono={Phone} titulo="Si pasa algo"><Parrafos texto={casa.urgencias} /></Item>}
                        </ul>
                        <p className="mt-4 text-sm text-gray-600 leading-relaxed">Si os falta algo o algo no funciona, decídnoslo: estamos aquí al lado.</p>
                    </Bloque>
                )}

                {/* ---------- 4. Por la zona (solo cuando exista) ---------- */}
                {hayZona && !despues && (
                    <Bloque titulo="Por la zona"><Parrafos texto={casa.zona} /></Bloque>
                )}

                {/* ---------- 5. Al irte ---------- */}
                {(dentro || despues) && (
                    <Bloque titulo="Al irte">
                        {!despues && casa?.salir && <Parrafos texto={casa.salir} />}
                        <div className={despues ? '' : 'mt-4'}>
                            <p className="text-[15px] leading-relaxed"><b>Factura.</b>{' '}
                                {factura.hay
                                    ? <>Ya está hecha (nº {factura.numero}){factura.mandada_el ? `, y os la mandamos al correo el ${diaMes(String(factura.mandada_el).slice(0, 10))}` : ''}. Si no la encontráis, pedídnosla y os la reenviamos.</>
                                    : r.es_canal
                                        ? <>Si la necesitáis, pedídnosla y os la hacemos.</>
                                        : <>Si la necesitáis con vuestros datos, pedídnosla aquí y os la mandamos al correo.</>}
                            </p>
                            <a href={wa(`Hola, soy ${r.nombre} (${r.codigo}). ${factura.hay ? 'Me podéis reenviar la factura, por favor.' : 'Necesito la factura de la estancia, por favor. Datos:'}`)} target="_blank" rel="noopener noreferrer" className={btnSec}><FileText size={18} aria-hidden="true" /> {factura.hay ? 'Pedir que me la reenvíen' : 'Pedir la factura'}</a>
                        </div>
                        {despues && (
                            <div className="mt-5 pt-5 border-t border-gray-100">
                                <p className="text-[15px] leading-relaxed">Gracias por venir. Si tenéis un momento, vuestra opinión en Google es lo que más nos ayuda.</p>
                                <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" className={btnPri}><Star size={18} aria-hidden="true" /> Dejar una opinión en Google</a>
                            </div>
                        )}
                    </Bloque>
                )}

                {/* ---------- Guardar en el móvil ---------- */}
                {!despues && (
                    <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 leading-relaxed flex gap-3">
                        <Smartphone size={20} className="shrink-0 mt-0.5 text-rural-700" aria-hidden="true" />
                        <p><b>Para tenerla a mano:</b> en el menú del navegador, «Añadir a pantalla de inicio». Se queda como un icono en el móvil. Y si la pierdes, vuelve al botón del correo de confirmación.</p>
                    </div>
                )}
            </main>
            <Pie />
        </>
    );
};

const nombreCanal = (c) => ({ booking: 'Booking', airbnb: 'Airbnb', holidu: 'Holidu', escapada: 'Escapada Rural', casasrurales: 'CasasRurales.net' })[String(c || '').toLowerCase()] || c;

// ---------------------------------------------------------------- policía

const Policia = ({ policia, codigo }) => {
    const enlace = `/precheckin?code=${codigo}`;
    if (!policia.abierta) {
        return (
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-[15px] leading-relaxed">
                <p><b>Datos para la policía.</b> Por ley tenemos que comunicar los datos de cada persona que se aloja. El formulario se abre el <b>{diaMes(policia.abre_el)}</b>; os lo recordaremos por correo.</p>
            </div>
        );
    }
    if (policia.completo) {
        return (
            <div className="rounded-xl bg-rural-50 border border-rural-200 px-4 py-3 text-[15px] leading-relaxed flex gap-2">
                <Check size={20} className="shrink-0 text-rural-700 mt-0.5" aria-hidden="true" />
                <p><b>Datos para la policía: ya los tenemos</b> ({policia.rellenas} de {policia.total}). Al llegar solo os damos las llaves.</p>
            </div>
        );
    }
    const faltan = policia.total - policia.rellenas;
    return (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[15px] leading-relaxed text-red-900">
            <p className="flex gap-2"><AlertTriangle size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span><b>Datos para la policía: {policia.rellenas === 0 ? `faltan ${policia.total === 1 ? 'los tuyos' : `los de las ${policia.total} personas`}` : `faltan ${faltan} de ${policia.total}`}.</b> Por ley tenemos que comunicarlos antes de que entréis. Cada uno rellena los suyos desde su móvil; no hay que mandar foto de ningún documento.</span></p>
            <Link to={enlace} className={btnPri}><Shield size={18} aria-hidden="true" /> Rellenar mis datos <ChevronRight size={18} aria-hidden="true" /></Link>
        </div>
    );
};

// ---------------------------------------------------------------- sin código / cerrada

const textoVentana = (ventana, codigo) => ({
    cancelada:      { titulo: 'Esta reserva está cancelada.', texto: 'Si creéis que es un error, escribidnos.' },
    sin_confirmar:  { titulo: 'Esta reserva todavía no está confirmada.', texto: 'Si acabáis de pagar, esperad un minuto y volved a abrir el enlace. Si no, terminad el pago primero.' },
    cerrada:        { titulo: 'Esta estancia ya terminó.', texto: 'Gracias por venir. Para lo que necesitéis (una factura, volver), escribidnos.' },
    no_encontrada:  { titulo: 'No encontramos esa reserva.', texto: `Revisad el enlace del correo de confirmación${codigo ? ` (código ${codigo})` : ''} o escribidnos.` },
}[ventana] || { titulo: 'No encontramos esa reserva.', texto: 'Revisad el enlace del correo o escribidnos.' });

const Cerrada = ({ titulo, texto }) => (
    <>
        <Cabecera titulo="Tu guía de la casa" />
        <main className="max-w-xl mx-auto px-4 -mt-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
                <AlertTriangle size={30} className="mx-auto text-amber-500 mb-3" aria-hidden="true" />
                <h2 className="font-serif text-xl font-bold">{titulo}</h2>
                {texto && <p className="mt-2 text-gray-700 leading-relaxed">{texto}</p>}
                <a href={`https://wa.me/${WHATSAPP}`} className={btnPri}><MessageCircle size={18} aria-hidden="true" /> Escribirnos por WhatsApp</a>
            </div>
        </main>
        <Pie />
    </>
);

const SinCodigo = () => {
    const [email, setEmail] = useState('');
    const [estado, setEstado] = useState(null);   // null | 'mandando' | 'hecho' | 'error'
    const enviar = async (e) => {
        e.preventDefault();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setEstado('error'); return; }
        setEstado('mandando');
        try {
            const { error } = await supabase.functions.invoke('enlace-guia', { body: { email: email.trim() } });
            setEstado(error ? 'error' : 'hecho');
        } catch { setEstado('error'); }
    };
    return (
        <>
            <Cabecera titulo="Tu guía de la casa" linea="Tu reserva, cómo llegar y todo lo de la casa, en una sola página." />
            <main className="max-w-xl mx-auto px-4 -mt-3 space-y-3">
                <Bloque titulo="Cómo se abre">
                    <p className="text-[15px] leading-relaxed">Desde el botón <b>«Tu guía de la casa»</b> del correo de confirmación. No hay que escribir ningún código: el enlace ya lleva el tuyo.</p>
                    <p className="mt-2 text-[15px] leading-relaxed">Si vinisteis por Booking, Airbnb u Holidu, os la enseñamos al llegar con un código QR.</p>
                </Bloque>
                <Bloque titulo="He perdido el enlace">
                    {estado === 'hecho' ? (
                        <p className="text-[15px] leading-relaxed flex gap-2"><Check size={20} className="text-rural-700 shrink-0" aria-hidden="true" /> Si hay una reserva con ese correo, ya tienes el enlace en tu buzón. Mira también en «promociones» o «spam».</p>
                    ) : (
                        <form onSubmit={enviar} className="space-y-3">
                            <p className="text-[15px] leading-relaxed">Escribe el correo con el que reservaste y te lo volvemos a mandar.</p>
                            <label className="block">
                                <span className="sr-only">Correo</span>
                                <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com"
                                    className="w-full min-h-[52px] rounded-xl border-2 border-gray-200 px-4 text-[16px] focus:border-rural-600 focus:outline-none" />
                            </label>
                            {estado === 'error' && <p className="text-sm text-red-700">Revisa el correo y prueba otra vez. Si sigue sin llegar, escríbenos por WhatsApp.</p>}
                            <button type="submit" disabled={estado === 'mandando'} className={`${btnPri} w-full`}>
                                {estado === 'mandando' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />} Mandarme el enlace
                            </button>
                        </form>
                    )}
                    <p className="mt-4 text-sm text-gray-600">¿No tenéis correo apuntado (Booking, Airbnb)? Escribidnos por <a className="underline text-rural-700 font-semibold" href={`https://wa.me/${WHATSAPP}`}>WhatsApp</a> y os lo mandamos.</p>
                </Bloque>
            </main>
            <Pie />
        </>
    );
};

// ---------------------------------------------------------------- piezas

const btnPri = 'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rural-700 px-5 py-3 text-[15px] font-bold text-white hover:bg-rural-800 min-h-[48px]';
const btnSec = 'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-rural-700 px-5 py-3 text-[15px] font-bold text-rural-700 hover:bg-rural-50 min-h-[48px]';

const Bloque = ({ titulo, nota, children }) => (
    <section className="bg-white rounded-2xl border border-gray-100 px-4 py-4 shadow-sm">
        <h2 className="text-[11px] tracking-[2px] uppercase text-rural-700 font-bold">{titulo}</h2>
        {nota && <p className="text-xs text-gray-500 mt-0.5">{nota}</p>}
        <div className="mt-2">{children}</div>
    </section>
);

const Fila = ({ k, v }) => (
    <div className="flex justify-between gap-4 py-1 text-[15px]">
        <span className="text-gray-500 shrink-0">{k}</span>
        <span className="text-right">{v}</span>
    </div>
);

const Item = ({ icono: Icono, titulo, children }) => (
    <li className="flex gap-3">
        <span className="w-9 h-9 rounded-xl bg-rural-50 text-rural-700 flex items-center justify-center shrink-0" aria-hidden="true"><Icono size={18} /></span>
        <div className="min-w-0 flex-1">
            <p className="font-bold text-[15px] mb-0.5">{titulo}</p>
            <div className="text-[15px] leading-relaxed text-gray-800">{children}</div>
        </div>
    </li>
);

const Copiable = ({ texto }) => {
    const [ok, setOk] = useState(false);
    const copiar = async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* sin permiso: queda escrito */ } };
    return (
        <button type="button" onClick={copiar} className="inline-flex items-center gap-1 font-mono font-bold text-rural-700 underline decoration-dotted">
            {texto} {ok ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
    );
};
