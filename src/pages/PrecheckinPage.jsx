import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Check, Shield, Trash2, Eraser, Save,
    UserPlus, Pencil, AlertCircle, Users,
} from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';
import {
    IDIOMAS, LOCALES, NOMBRES_IDIOMA, idiomaInicial, traductor,
} from './precheckin/textos';

// Idioma de la pantalla: es · en · de · fr. Los textos viven en
// `precheckin/textos.js`; aquí sólo se elige cuál se pinta. `tx` y no `t`
// porque en todo el fichero `t` es el viajero.
const IdiomaCtx = createContext({ lang: 'es', tx: traductor('es') });
const useIdioma = () => useContext(IdiomaCtx);

// «2026-09-15» → «15 de septiembre de 2026» (o «15 September 2026»…). El
// huésped no lee fechas ISO.
const fechaLegible = (iso, lang = 'es') => {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(LOCALES[lang] || 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** ['Jesús', 'María'] → «Jesús y María» · ['Ana'] → «Ana» */
const listaNombres = (ns, tx) => {
    const l = (ns || []).filter(Boolean);
    if (l.length <= 1) return l[0] || tx('una_persona');
    return `${l.slice(0, -1).join(', ')} ${tx('y')} ${l[l.length - 1]}`;
};

// /precheckin?code=TJM-XXXXXX
// ============================
// Formulario público del registro documental de viajeros (RD 933/2021).
// Lo rellena el huésped desde SU móvil, normalmente de pie y con prisa, así
// que manda el móvil: un viajero por pantalla, teclado adecuado en cada
// campo, lo escrito se guarda solo en el propio móvil y se puede dejar a
// medias y volver.
//
// Qué exige la norma y por qué está aquí cada cosa:
//   · Art. 4 RD 933/2021: hay que registrar a TODOS los que se alojan. Los
//     mayores de 14 años firman el parte; los datos de los menores de 14 los
//     da la persona adulta que los acompaña.
//   · Anexo I: nombre, dos apellidos, sexo, tipo y número de documento,
//     número de soporte, nacionalidad, fecha de nacimiento, domicilio
//     completo, teléfonos, correo, número de viajeros y, si alguno es menor
//     de edad, su relación de parentesco.
//   · Art. 5.3: los datos se conservan tres años.
//
// Escáner de la banda del pasaporte (MRZ): NO se incluye. Leerla de verdad
// necesita OCR en el navegador (tesseract.js ~10 MB de wasm) y con la cámara
// de un móvil normal falla más de lo que acierta; media banda mal leída da
// un documento equivocado en un parte policial. Se descarta a propósito.

// ---------------------------------------------------------------------------
// Países (ISO 3166-1: alfa-2 → alfa-3). El nombre, en el idioma de la
// pantalla, lo pone el propio navegador (Intl.DisplayNames), así que la lista
// no se queda vieja ni hay que traducirla. El código que se guarda es siempre
// el alfa-3.
// ---------------------------------------------------------------------------
const ISO_PAISES = 'AD:AND,AE:ARE,AF:AFG,AG:ATG,AI:AIA,AL:ALB,AM:ARM,AO:AGO,AR:ARG,AS:ASM,AT:AUT,AU:AUS,AW:ABW,AX:ALA,AZ:AZE,BA:BIH,BB:BRB,BD:BGD,BE:BEL,BF:BFA,BG:BGR,BH:BHR,BI:BDI,BJ:BEN,BL:BLM,BM:BMU,BN:BRN,BO:BOL,BQ:BES,BR:BRA,BS:BHS,BT:BTN,BW:BWA,BY:BLR,BZ:BLZ,CA:CAN,CC:CCK,CD:COD,CF:CAF,CG:COG,CH:CHE,CI:CIV,CK:COK,CL:CHL,CM:CMR,CN:CHN,CO:COL,CR:CRI,CU:CUB,CV:CPV,CW:CUW,CX:CXR,CY:CYP,CZ:CZE,DE:DEU,DJ:DJI,DK:DNK,DM:DMA,DO:DOM,DZ:DZA,EC:ECU,EE:EST,EG:EGY,EH:ESH,ER:ERI,ES:ESP,ET:ETH,FI:FIN,FJ:FJI,FK:FLK,FM:FSM,FO:FRO,FR:FRA,GA:GAB,GB:GBR,GD:GRD,GE:GEO,GF:GUF,GG:GGY,GH:GHA,GI:GIB,GL:GRL,GM:GMB,GN:GIN,GP:GLP,GQ:GNQ,GR:GRC,GT:GTM,GU:GUM,GW:GNB,GY:GUY,HK:HKG,HN:HND,HR:HRV,HT:HTI,HU:HUN,ID:IDN,IE:IRL,IL:ISR,IM:IMN,IN:IND,IO:IOT,IQ:IRQ,IR:IRN,IS:ISL,IT:ITA,JE:JEY,JM:JAM,JO:JOR,JP:JPN,KE:KEN,KG:KGZ,KH:KHM,KI:KIR,KM:COM,KN:KNA,KP:PRK,KR:KOR,KW:KWT,KY:CYM,KZ:KAZ,LA:LAO,LB:LBN,LC:LCA,LI:LIE,LK:LKA,LR:LBR,LS:LSO,LT:LTU,LU:LUX,LV:LVA,LY:LBY,MA:MAR,MC:MCO,MD:MDA,ME:MNE,MF:MAF,MG:MDG,MH:MHL,MK:MKD,ML:MLI,MM:MMR,MN:MNG,MO:MAC,MP:MNP,MQ:MTQ,MR:MRT,MS:MSR,MT:MLT,MU:MUS,MV:MDV,MW:MWI,MX:MEX,MY:MYS,MZ:MOZ,NA:NAM,NC:NCL,NE:NER,NF:NFK,NG:NGA,NI:NIC,NL:NLD,NO:NOR,NP:NPL,NR:NRU,NU:NIU,NZ:NZL,OM:OMN,PA:PAN,PE:PER,PF:PYF,PG:PNG,PH:PHL,PK:PAK,PL:POL,PM:SPM,PN:PCN,PR:PRI,PS:PSE,PT:PRT,PW:PLW,PY:PRY,QA:QAT,RE:REU,RO:ROU,RS:SRB,RU:RUS,RW:RWA,SA:SAU,SB:SLB,SC:SYC,SD:SDN,SE:SWE,SG:SGP,SH:SHN,SI:SVN,SJ:SJM,SK:SVK,SL:SLE,SM:SMR,SN:SEN,SO:SOM,SR:SUR,SS:SSD,ST:STP,SV:SLV,SX:SXM,SY:SYR,SZ:SWZ,TC:TCA,TD:TCD,TG:TGO,TH:THA,TJ:TJK,TK:TKL,TL:TLS,TM:TKM,TN:TUN,TO:TON,TR:TUR,TT:TTO,TV:TUV,TW:TWN,TZ:TZA,UA:UKR,UG:UGA,US:USA,UY:URY,UZ:UZB,VA:VAT,VC:VCT,VE:VEN,VG:VGB,VI:VIR,VN:VNM,VU:VUT,WF:WLF,WS:WSM,XK:XKK,YE:YEM,YT:MYT,ZA:ZAF,ZM:ZMB,ZW:ZWE';

/** Los que más salen, arriba del todo para no hacer scroll. */
const PAISES_FRECUENTES = ['ESP', 'FRA', 'GBR', 'DEU', 'PRT', 'NLD', 'BEL', 'ITA'];

function construirPaises(lang = 'es') {
    let nombreDe = (iso2, iso3) => iso3;
    try {
        const dn = new Intl.DisplayNames([lang], { type: 'region' });
        nombreDe = (iso2, iso3) => dn.of(iso2) || iso3;
    } catch { /* navegador viejo: se queda el código */ }

    const todos = ISO_PAISES.split(',').map((par) => {
        const [iso2, iso3] = par.split(':');
        return { code: iso3, name: nombreDe(iso2, iso3) };
    });
    const frecuentes = PAISES_FRECUENTES
        .map((c) => todos.find((p) => p.code === c))
        .filter(Boolean);
    const resto = todos
        .filter((p) => !PAISES_FRECUENTES.includes(p.code))
        .sort((a, b) => a.name.localeCompare(b.name, lang));
    return { frecuentes, resto };
}

// Códigos del tipo de documento. El nombre que ve el huésped está en
// `textos.js` como `doc_<código>`.
const DOC_TYPES = ['D', 'P', 'N', 'E', 'C', 'X'];

// El catálogo entero, redactado desde el punto de vista del ADULTO, que es
// quien contesta. La base ya lo admite (el CHECK trae los quince códigos más
// el heredado 'PA', que se sigue usando para padre/madre porque la edge
// function ya lo traduce a 'PM' al mandar el parte).
//
// Falta uno que era el más frecuente y no estaba: hermano/a.
//
// Aquí sólo los códigos, en el orden en que salen; el texto («Su padre o su
// madre»…) está en `textos.js` como `par_<código>`.
const PARENTESCOS = [
    'PA', 'AB', 'HR', 'TI', 'TU', 'SB', 'NI', 'HJ', 'BA', 'BN', 'CY', 'CD', 'SG', 'YN', 'OT',
];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const hoyISO = () => new Date().toISOString().slice(0, 10);

function edadEn(nacimiento, referencia) {
    if (!nacimiento) return null;
    const n = new Date(`${nacimiento}T00:00:00`);
    const r = new Date(`${(referencia || hoyISO())}T00:00:00`);
    if (Number.isNaN(n.getTime()) || Number.isNaN(r.getTime())) return null;
    let e = r.getFullYear() - n.getFullYear();
    const m = r.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && r.getDate() < n.getDate())) e -= 1;
    return Math.max(e, 0);
}

const emptyTraveler = (isTitular = false) => ({
    is_titular: isTitular,
    apellido_primero: '',
    apellido_segundo: '',
    nombre: '',
    sexo: '',
    tipo_documento: 'D',
    numero_documento: '',
    soporte_documento: '',
    nacionalidad: 'ESP',
    fecha_nacimiento: '',
    direccion_via: '',
    direccion_municipio: '',
    // Código INE del municipio (solo España). Lo pone la lista al elegir; si
    // el huésped no elige, la base lo deduce del nombre + CP. Al Ministerio
    // hay que mandarle el código, no el nombre (rechazo del 19-sep-2026).
    direccion_municipio_ine: '',
    direccion_cp: '',
    direccion_pais: 'ESP',
    telefono_fijo: '',
    telefono_movil: '',
    email: '',
    // `parentesco` sólo se rellena en los ADULTOS, y dice qué son ellos del
    // menor al que acompañan. En la ficha del menor va siempre vacío.
    parentesco: '',
    // A qué menor acompaña este adulto. Es apaño de esta pantalla para saber
    // de quién habla el parentesco; no se manda a ninguna parte.
    acompana_a: null,
    firma_base64: '',
});

const claveBorrador = (code) => `tjm-precheckin-${code}`;

// Cuando el huésped abre el enlace antes de tiempo se le dice el día exacto
// en que se abre (la llegada menos siete días), no un «no encontramos» que
// parece que su reserva no existe.
//
// Devuelve la clave del texto y la fecha, no la frase: la frase se monta al
// pintar, para que cambie si el huésped cambia de idioma.
const seAbreEl = (checkIn) => {
    const sinFecha = { clave: 'abre_sin_fecha' };
    if (!checkIn) return sinFecha;
    // En UTC a propósito: restando en hora local, el paso a ISO se come un día
    // (en Madrid, el 16 a las 00:00 es el 15 a las 22:00Z).
    const d = new Date(`${checkIn}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return sinFecha;
    d.setUTCDate(d.getUTCDate() - 7);
    return { clave: 'abre_con_fecha', fecha: d.toISOString().slice(0, 10) };
};

/**
 * Qué le falta a este viajero para poder seguir.
 * Devuelve CLAVES de `textos.js` (`err_*`), no frases: se traducen al pintar.
 */
function pegasDe(t, fechaEntrada) {
    const p = {};
    if (!t.nombre.trim()) p.nombre = 'err_nombre';
    if (!t.apellido_primero.trim()) p.apellido_primero = 'err_apellido1';
    if (!t.sexo) p.sexo = 'err_sexo';
    if (!t.fecha_nacimiento) p.fecha_nacimiento = 'err_fecha';
    else if (t.fecha_nacimiento > hoyISO()) p.fecha_nacimiento = 'err_fecha_futura';
    if (!t.nacionalidad) p.nacionalidad = 'err_pais';
    if (!t.direccion_via.trim()) p.direccion_via = 'err_calle';
    if (!t.direccion_municipio.trim()) p.direccion_municipio = 'err_municipio';
    if (!t.direccion_pais) p.direccion_pais = 'err_pais';

    const edad = edadEn(t.fecha_nacimiento, fechaEntrada);
    // El documento sólo se le pide a los mayores de edad: un niño puede no
    // tener ninguno todavía y sus datos los da quien lo acompaña.
    if ((edad === null || edad >= 18) && !t.numero_documento.trim()) {
        p.numero_documento = 'err_documento';
    }
    // Con DNI o NIE, el Ministerio exige tambien el segundo apellido y el
    // numero de soporte: sin ellos rechaza el parte entero.
    const documentoEspanol = t.numero_documento.trim()
        && (t.tipo_documento === 'D' || t.tipo_documento === 'N');
    if (documentoEspanol && !t.soporte_documento.trim()) {
        p.soporte_documento = 'err_soporte';
    }
    if (documentoEspanol && !t.apellido_segundo.trim()) {
        p.apellido_segundo = 'err_apellido2';
    }
    // Firma: a partir de los CATORCE. No 16 ni 18. Lo dice el art. 4.2 del
    // RD 933/2021; el 16 que circula viene de una norma de 1959 ya superada.
    if (edad !== null && edad >= EDAD_FIRMA && !t.firma_base64) p.firma_base64 = 'err_firma';
    if (t.is_titular && !t.telefono_movil.trim()) p.telefono_movil = 'err_movil';
    return p;
    // El PARENTESCO ya no se pide aquí. Va en el repaso y se guarda en la
    // ficha del ADULTO, no en la del menor (ver `pegasDeLosMenores`).
}

/** Firman los mayores de catorce. */
const EDAD_FIRMA = 14;
/** Documento propio y parentesco: los umbrales de la mayoría de edad. */
const EDAD_MAYORIA = 18;

const esMenor = (t, fechaEntrada) => {
    const e = edadEn(t.fecha_nacimiento, fechaEntrada);
    return e !== null && e < EDAD_MAYORIA;
};

const esAdulto = (t, fechaEntrada) => {
    const e = edadEn(t.fecha_nacimiento, fechaEntrada);
    return e !== null && e >= EDAD_MAYORIA;
};

/**
 * Lo que falta por decir de los menores, MIRADO DESDE EL ADULTO.
 *
 * El Ministerio no pide el parentesco en la ficha del niño: pide que «al
 * menos una de las personas mayores de edad tenga informada su relación de
 * parentesco» con él. Hasta hoy se guardaba al revés y por eso está aquí.
 *
 * Devuelve, por cada menor, con quién va y qué le falta.
 */
function pegasDeLosMenores(travelers, fechaEntrada) {
    const menores = travelers
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => esMenor(t, fechaEntrada));
    if (menores.length === 0) return [];

    const hayAdulto = travelers.some((t) => esAdulto(t, fechaEntrada));

    return menores.map(({ t, i }) => {
        const conQuien = travelers.findIndex(
            (a, j) => j !== i && esAdulto(a, fechaEntrada) && Number(a.acompana_a) === i,
        );
        return {
            idx: i,
            // Sin nombre todavía: «Persona N», que se pone al pintar (idioma).
            nombre: t.nombre || '',
            adultoIdx: conQuien,
            hayAdulto,
            falta: !hayAdulto
                ? 'sin_adulto'
                : conQuien < 0
                    ? 'sin_asignar'
                    : !travelers[conQuien].parentesco
                        ? 'sin_relacion'
                        : null,
        };
    });
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------

/**
 * @param codigo         Cuando se abre DENTRO del panel («Rellenarlo yo») el
 *                       codigo viene por aqui, no por la direccion.
 * @param dentroDelPanel Se pinta encajado en una hoja del panel en vez de a
 *                       pantalla completa: sin cabecera propia, sin barra
 *                       pegada al fondo de la ventana y sin ocupar la altura
 *                       entera. Se usa el MISMO componente a proposito: dos
 *                       formularios distintos acabarian diciendo cosas
 *                       distintas, y este va a un parte policial.
 * @param alTerminar     Aviso para que el panel se refresque al guardar.
 */
const PrecheckinPage = ({ codigo = null, dentroDelPanel = false, alTerminar = null }) => {
    const [params] = useSearchParams();
    const code = String(codigo || params.get('code') || '').toUpperCase();

    // Idioma: `?lang=` manda (lo ponen los enlaces de WhatsApp y correo); si
    // no, el del navegador si es en/de/fr; si no, castellano. Dentro del panel
    // siempre castellano y sin selector: esa es la pantalla de casa.
    const [lang, setLang] = useState(() => (dentroDelPanel ? 'es' : idiomaInicial(params.get('lang'))));
    const tx = useMemo(() => traductor(lang), [lang]);
    const idioma = useMemo(() => ({ lang, tx }), [lang, tx]);

    const cambiarIdioma = (nuevo) => {
        setLang(nuevo);
        // Se apunta en la dirección para que al recargar siga en el mismo
        // idioma. Sin pasar por el router, y conservando su `state`.
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', nuevo);
            window.history.replaceState(window.history.state, '', url);
        } catch { /* da igual: sólo se pierde al recargar */ }
    };

    // <html lang="…"> con el idioma elegido mientras esta pantalla está abierta.
    useEffect(() => {
        if (dentroDelPanel) return undefined;
        const antes = document.documentElement.lang;
        document.documentElement.lang = lang;
        return () => { document.documentElement.lang = antes; };
    }, [lang, dentroDelPanel]);

    const [booking, setBooking] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null); // { clave, fecha? } de textos.js

    const [travelers, setTravelers] = useState([emptyTraveler(true)]);
    const [paso, setPaso] = useState(0);          // 0 = portada · 1..N = viajeros · N+1 = repaso
    const [tocados, setTocados] = useState({});   // campos que ya se han intentado
    const [accept, setAccept] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState(null); // clave de textos.js
    const [hecho, setHecho] = useState(false);
    const [huboBorrador, setHuboBorrador] = useState(false);
    // Fichas que YA están en la base (otro móvil las mandó antes): cuántas y
    // los nombres de pila. Con dos móviles, el segundo solo rellena lo que falta.
    const [yaHay, setYaHay] = useState({ rellenas: 0, nombres: [] });
    const [guardadoAviso, setGuardadoAviso] = useState(false);
    const [pagador, setPagador] = useState({ quien: '', nombre: '' });

    const paises = useMemo(() => construirPaises(lang), [lang]);
    const arriba = useRef(null);

    // ------------------------------------------------------------- cargar
    useEffect(() => {
        if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) {
            setErrorCarga({ clave: 'err_enlace' });
            setCargando(false);
            return;
        }
        (async () => {
            const data = await leerReserva(code);

            // `ventana` la dice la base: abierta / pronto / pasada / cancelada /
            // sin_confirmar.
            // Fuera de la ventana llega la fila sin ningún dato personal, solo
            // para poder decir la verdad en vez de «no encontramos esa reserva».
            const ventana = data?.ventana || (data ? 'abierta' : null);

            if (!data) {
                setErrorCarga({ clave: 'err_no_encontrada' });
            } else if (ventana === 'cancelada' || data.status === 'cancelled') {
                setErrorCarga({ clave: 'err_cancelada' });
            } else if (ventana === 'sin_confirmar' || !['confirmed', 'completed'].includes(data.status)) {
                setErrorCarga({ clave: 'err_sin_confirmar' });
            } else if (ventana === 'pasada') {
                setErrorCarga({ clave: 'err_pasada' });
            } else if (ventana === 'pronto'
                || (data.check_in && new Date(data.check_in) - new Date() > 7 * 86400000)) {
                setErrorCarga(seAbreEl(data.check_in));
            } else {
                setBooking(data);
                const guardado = leerBorrador(code);
                const plazas = Math.max(Number(data.pax_count) || 1, 1);
                const rellenas = Math.max(Number(data.rellenas) || 0, 0);
                setYaHay({ rellenas, nombres: Array.isArray(data.nombres_ya) ? data.nombres_ya : [] });
                if (!guardado?.travelers?.length && rellenas > 0) {
                    // Otro móvil ya mandó fichas (migración 0038): aquí solo se
                    // piden las que faltan, sin prellenar al titular (ya está).
                    // Si están todas, una vacía por si viene alguien más.
                    const faltan = Math.max(plazas - rellenas, 0);
                    setTravelers(Array.from({ length: Math.max(faltan, 1) }, () => emptyTraveler(false)));
                } else if (guardado?.travelers?.length) {
                    // Un borrador guardado con menos personas que plazas (por
                    // ejemplo, de antes de que el formulario abriera con una
                    // ficha por persona) se completa hasta las plazas: lo
                    // escrito se conserva, y las que faltan aparecen vacías.
                    const faltan = Math.max(plazas - guardado.travelers.length, 0);
                    setTravelers([
                        ...guardado.travelers,
                        ...Array.from({ length: faltan }, () => emptyTraveler(false)),
                    ]);
                    setHuboBorrador(true);
                } else {
                    // Una ficha por persona de la reserva desde el principio:
                    // si son dos, la cabecera dice «1 de 2» y el paso siguiente
                    // es la segunda persona. Antes salía «1 de 1» y la segunda
                    // había que añadirla al final, y eso se entendía como que
                    // la reserva era de uno (visto por Jesús el 17-sep-2026).
                    const partes = (data.guest_name || '').trim().split(/\s+/);
                    setTravelers([
                        {
                            ...emptyTraveler(true),
                            nombre: partes[0] || '',
                            apellido_primero: partes[1] || '',
                            apellido_segundo: partes.slice(2).join(' ') || '',
                            email: data.guest_email || '',
                            telefono_movil: data.guest_phone || '',
                        },
                        ...Array.from({ length: plazas - 1 }, () => emptyTraveler(false)),
                    ]);
                }
            }
            setCargando(false);
        })();
    }, [code]);

    // ------------------------------------------------- guardar en el móvil
    useEffect(() => {
        if (!booking || hecho) return;
        try {
            localStorage.setItem(claveBorrador(code), JSON.stringify({
                guardado: new Date().toISOString(), travelers,
            }));
        } catch { /* modo privado o sin sitio: se sigue igual */ }
    }, [travelers, booking, code, hecho]);

    useEffect(() => { arriba.current?.scrollIntoView({ block: 'start' }); }, [paso]);

    // ---------------------------------------------------------- acciones
    const total = travelers.length;
    const maximo = Math.max(booking?.pax_count || 1, 1);
    const fechaEntrada = booking?.check_in || hoyISO();

    const cambiar = useCallback((idx, campo, valor) => {
        setTravelers((prev) => prev.map((t, i) => (i === idx ? { ...t, [campo]: valor } : t)));
    }, []);

    const anadir = () => {
        setTravelers((prev) => [...prev, emptyTraveler(false)]);
        setPaso(travelers.length + 1);
    };

    const quitar = (idx) => {
        if (idx === 0) return;
        setTravelers((prev) => prev.filter((_, i) => i !== idx));
        setPaso((p) => Math.min(p, travelers.length - 1));
    };

    const marcarTocados = (idx) => {
        setTocados((prev) => ({ ...prev, [idx]: true }));
    };

    const siguiente = () => {
        const idx = paso - 1;
        const pegas = pegasDe(travelers[idx], fechaEntrada);
        marcarTocados(idx);
        if (Object.keys(pegas).length > 0) return;
        setPaso(paso + 1);
    };

    const guardarYSalir = () => {
        setGuardadoAviso(true);
        setTimeout(() => setGuardadoAviso(false), 5000);
    };

    // ------------------------------------------------------- quién ha pagado
    // Sólo se pregunta cuando de verdad no lo sabemos. Si la reserva vino de
    // Booking o Airbnb paga la plataforma, y si ya se pagó con tarjeta por la
    // web el nombre lo devuelve la pasarela: en los dos casos, ni una
    // pregunta de más.
    const canalDeFuera = ['booking', 'airbnb', 'escapada', 'casasrurales', 'holidu']
        .includes(String(booking?.channel || '').toLowerCase());
    const pagadoPorLaWeb = booking?.payment_status === 'paid'
        && ['web', ''].includes(String(booking?.channel || '').toLowerCase());
    const preguntarPagador = !!booking && !canalDeFuera && !pagadoPorLaWeb;

    const guardarPagador = async () => {
        if (!preguntarPagador || !pagador.quien) return;
        const titular = pagador.quien === 'yo'
            ? [travelers[0]?.nombre, travelers[0]?.apellido_primero, travelers[0]?.apellido_segundo]
                .filter(Boolean).join(' ').trim()
            : pagador.nombre.trim();
        if (!titular) return;
        const { error } = await supabase.rpc('tjm_guardar_pagador', {
            p_booking_code: code,
            p_titular_pago: titular,
        });
        // Si la función todavía no existe, no se le monta un drama al huésped:
        // sus datos están guardados, que es lo que le importa. Queda apuntado
        // en la consola y en el informe para que se remate.
        if (error) {
            // eslint-disable-next-line no-console
            console.warn('No se ha podido guardar quién pagó:', error.message);
        }
    };

    // ------------------------------------------------------- ¿puede mandarse?
    const menoresPendientes = pegasDeLosMenores(travelers, fechaEntrada)
        .filter((m) => m.falta).length;
    const pagadorPendiente = preguntarPagador
        && (!pagador.quien || (pagador.quien === 'otra' && !pagador.nombre.trim()));
    const incompletos = travelers.filter((t) => Object.keys(pegasDe(t, fechaEntrada)).length > 0).length;
    const sePuedeEnviar = incompletos === 0 && menoresPendientes === 0 && !pagadorPendiente;

    const enviar = async () => {
        if (!accept || !sePuedeEnviar) return;
        setEnviando(true);
        setErrorEnvio(null);
        try {
            const { error } = await supabase.rpc('submit_traveler_records', {
                p_booking_code: code,
                p_travelers: travelers.map(({ acompana_a, ...t }) => ({
                    ...t,
                    apellido_segundo: t.apellido_segundo || null,
                    soporte_documento: t.soporte_documento || null,
                    telefono_fijo: t.telefono_fijo || null,
                    telefono_movil: t.telefono_movil || null,
                    email: t.email || null,
                    // El parentesco va SOLO en la ficha del adulto que
                    // acompaña a un menor. En la del menor, siempre vacío.
                    parentesco: (acompana_a === null || acompana_a === undefined)
                        ? null
                        : (t.parentesco || null),
                    // Y de qué menor habla ese parentesco. Es el contrato de
                    // la migración 0011: el índice (empezando en 0) de la
                    // persona del array a la que se refiere.
                    parentesco_menor_indice: (acompana_a === null || acompana_a === undefined)
                        ? null
                        : Number(acompana_a),
                    firma_base64: t.firma_base64 || null,
                })),
            });
            if (error) throw error;
            await guardarPagador();
            try { localStorage.removeItem(claveBorrador(code)); } catch { /* da igual */ }
            setHecho(true);
            alTerminar?.();
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('precheckin_too_early')) setErrorEnvio('env_pronto');
            else if (msg.includes('booking_status_invalid')) setErrorEnvio('env_sin_confirmar');
            else if (msg.includes('booking_already_past')) setErrorEnvio('env_pasada');
            else setErrorEnvio('env_fallo');
        } finally {
            setEnviando(false);
        }
    };

    // ----------------------------------------------------------- pintado
    return (
        <IdiomaCtx.Provider value={idioma}>
        <div className={dentroDelPanel ? 'bg-[#FCFBF9] rounded-2xl' : 'min-h-screen bg-[#FCFBF9]'}>
            {!dentroDelPanel && (
                <PageHead
                    title={tx('meta_titulo')}
                    description={tx('meta_descripcion')}
                    path="/precheckin"
                    noindex
                />
            )}

            <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
                    {dentroDelPanel ? <span /> : (
                    <Link to="/" className="inline-flex items-center gap-1.5 text-rural-700 font-bold text-sm min-h-[44px]">
                        <ChevronLeft size={18} aria-hidden="true" /> {tx('inicio')}
                    </Link>
                    )}
                    {booking && !hecho && paso > 0 && (
                        <span className="text-sm font-semibold text-gray-600">
                            {paso <= total ? tx('persona_de', { n: paso, total }) : tx('ultimo_paso')}
                        </span>
                    )}
                </div>
                {booking && !hecho && (
                    <div className="max-w-xl mx-auto mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                            className="h-full bg-rural-600 transition-all duration-300"
                            style={{ width: `${Math.round((paso / (total + 1)) * 100)}%` }}
                        />
                    </div>
                )}
            </nav>

            <main className={dentroDelPanel ? 'px-1 pb-4 pt-4' : 'px-4 pb-28 pt-6'}>
                <div className="max-w-xl mx-auto" ref={arriba}>
                    {!dentroDelPanel && <SelectorIdioma lang={lang} onCambiar={cambiarIdioma} />}
                    {cargando ? (
                        <p className="text-center text-gray-500 py-20">{tx('cargando')}</p>
                    ) : errorCarga ? (
                        <Caja>
                            <h1 className="font-serif text-2xl font-bold text-text-primary mb-2">{tx('un_momento')}</h1>
                            <p className="text-base text-gray-700">
                                {tx(errorCarga.clave, { fecha: fechaLegible(errorCarga.fecha, lang) })}
                            </p>
                        </Caja>
                    ) : hecho ? (
                        <Terminado booking={booking} cuantos={total} />
                    ) : paso === 0 ? (
                        <Portada
                            booking={booking}
                            huboBorrador={huboBorrador}
                            yaHay={yaHay}
                            onEmpezar={() => setPaso(1)}
                        />
                    ) : paso <= total ? (
                        <PasoViajero
                            key={paso}
                            idx={paso - 1}
                            traveler={travelers[paso - 1]}
                            total={total}
                            fechaEntrada={fechaEntrada}
                            paises={paises}
                            mostrarPegas={!!tocados[paso - 1]}
                            cambiar={cambiar}
                            quitar={quitar}
                        />
                    ) : (
                        <Repaso
                            travelers={travelers}
                            fechaEntrada={fechaEntrada}
                            maximo={maximo}
                            onEditar={(i) => setPaso(i + 1)}
                            onAnadir={anadir}
                            onQuitar={quitar}
                            accept={accept}
                            setAccept={setAccept}
                            error={errorEnvio}
                            cambiar={cambiar}
                            preguntarPagador={preguntarPagador}
                            pagador={pagador}
                            setPagador={setPagador}
                        />
                    )}
                </div>
            </main>

            {/* Barra de abajo: siempre a mano, nunca escondida */}
            {booking && !hecho && !errorCarga && paso > 0 && (
                <div className={`${dentroDelPanel ? 'sticky bottom-0' : 'fixed bottom-0 inset-x-0'} z-40 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3`}>
                    <div className="max-w-xl mx-auto flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setPaso(paso - 1)}
                            className="min-h-[52px] px-4 rounded-2xl font-bold text-rural-700 bg-white border-2 border-rural-200 hover:bg-rural-50"
                        >
                            <ChevronLeft size={20} aria-hidden="true" />
                            <span className="sr-only">{tx('atras')}</span>
                        </button>

                        {paso <= total ? (
                            <>
                                <button
                                    type="button"
                                    onClick={guardarYSalir}
                                    className="min-h-[52px] px-4 rounded-2xl font-bold text-rural-700 bg-rural-50 hover:bg-rural-100 inline-flex items-center gap-2"
                                >
                                    <Save size={18} aria-hidden="true" />
                                    <span className="hidden sm:inline">{tx('guardar')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={siguiente}
                                    className="flex-1 min-h-[52px] px-5 rounded-2xl font-bold text-white bg-rural-600 hover:bg-rural-700 inline-flex items-center justify-center gap-2"
                                >
                                    {paso === total ? tx('repasar') : tx('siguiente')}
                                    <ChevronRight size={20} aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={enviar}
                                disabled={!accept || enviando || !sePuedeEnviar}
                                className="flex-1 min-h-[52px] px-5 rounded-2xl font-bold text-white bg-rural-600 hover:bg-rural-700 disabled:opacity-45 inline-flex items-center justify-center gap-2"
                            >
                                <Check size={20} aria-hidden="true" />
                                {enviando ? tx('guardando') : tx('enviar')}
                            </button>
                        )}
                    </div>
                    {guardadoAviso && (
                        <p className="max-w-xl mx-auto mt-2 text-sm text-rural-700 font-semibold text-center">
                            {tx('guardado_aviso')}
                        </p>
                    )}
                </div>
            )}
        </div>
        </IdiomaCtx.Provider>
    );
};

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/** ES · EN · DE · FR arriba del todo, con botones que se aciertan con el dedo. */
const SelectorIdioma = ({ lang, onCambiar }) => {
    const { tx } = useIdioma();
    return (
        <div role="group" aria-label={tx('idioma')} className="-mt-2 mb-4 flex justify-end gap-1.5">
            {IDIOMAS.map((l) => (
                <button
                    key={l}
                    type="button"
                    lang={l}
                    onClick={() => onCambiar(l)}
                    aria-pressed={lang === l}
                    aria-label={NOMBRES_IDIOMA[l]}
                    className={`min-h-[44px] min-w-[44px] px-2 rounded-xl border-2 font-bold text-sm ${
                        lang === l
                            ? 'bg-rural-600 border-rural-600 text-white'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-rural-50'
                    }`}
                >
                    {l.toUpperCase()}
                </button>
            ))}
        </div>
    );
};

const Caja = ({ children, className = '' }) => (
    <div className={`bg-white rounded-3xl border border-gray-200 shadow-sm p-6 ${className}`}>{children}</div>
);

const Portada = ({ booking, huboBorrador, yaHay, onEmpezar }) => {
    const { lang, tx } = useIdioma();
    const plazas = booking?.pax_count || 1;
    const vars = { nombres: listaNombres(yaHay?.nombres, tx), rellenas: yaHay?.rellenas, total: plazas };
    return (
    <>
        <h1 className="font-serif text-3xl font-bold text-text-primary leading-tight">
            {tx('portada_titulo')}
        </h1>
        <p className="text-base text-gray-700 mt-3 leading-relaxed">
            {tx('portada_intro')}
        </p>

        <Caja className="mt-5">
            <p className="text-sm uppercase tracking-widest font-bold text-gray-500">{tx('tu_reserva')}</p>
            <p className="font-serif text-xl font-bold text-text-primary mt-1">
                {booking?.apartments?.name || booking?.apartment_name}
            </p>
            <p className="text-base text-gray-700">
                {tx('fechas_reserva', {
                    entrada: fechaLegible(booking?.check_in, lang),
                    salida: fechaLegible(booking?.check_out, lang),
                    personas: tx(plazas === 1 ? 'personas_1' : 'personas_n', { n: plazas }),
                })}
            </p>
            <p className="font-mono text-sm text-rural-700 font-bold mt-1">{booking?.booking_code}</p>
        </Caja>

        {huboBorrador && (
            <p className="mt-4 text-base text-rural-800 bg-rural-50 border border-rural-200 rounded-2xl px-4 py-3">
                {tx('ya_empezado')}
            </p>
        )}
        {!huboBorrador && yaHay?.rellenas > 0 && (
            <p className="mt-4 text-base text-rural-800 bg-rural-50 border border-rural-200 rounded-2xl px-4 py-3">
                {yaHay.rellenas >= plazas
                    ? tx('ya_hay_todas', vars)
                    : plazas - yaHay.rellenas === 1
                        ? tx('ya_hay_falta_1', vars)
                        : tx('ya_hay_faltan', { ...vars, faltan: plazas - yaHay.rellenas })}
            </p>
        )}

        <ul className="mt-5 space-y-2 text-base text-gray-700">
            <li className="flex gap-2"><Shield size={18} className="mt-1 shrink-0 text-rural-600" aria-hidden="true" />
                {tx('portada_privacidad')}</li>
            <li className="flex gap-2"><Save size={18} className="mt-1 shrink-0 text-rural-600" aria-hidden="true" />
                {tx('portada_medias')}</li>
            {plazas > 1 && (
                <li className="flex gap-2"><Users size={18} className="mt-1 shrink-0 text-rural-600" aria-hidden="true" />
                    {tx('portada_varios')}</li>
            )}
        </ul>

        <button
            type="button"
            onClick={onEmpezar}
            className="w-full mt-7 min-h-[56px] rounded-2xl font-bold text-white bg-rural-600 hover:bg-rural-700 text-lg inline-flex items-center justify-center gap-2"
        >
            {tx('empezar')} <ChevronRight size={22} aria-hidden="true" />
        </button>
    </>
    );
};

const PasoViajero = ({ idx, traveler: t, total, fechaEntrada, paises, mostrarPegas, cambiar, quitar }) => {
    const { tx } = useIdioma();
    // pegasDe da claves; aquí se vuelven frases en el idioma de la pantalla.
    const pegas = Object.fromEntries(
        Object.entries(mostrarPegas ? pegasDe(t, fechaEntrada) : {}).map(([k, v]) => [k, tx(v)]),
    );
    const edad = edadEn(t.fecha_nacimiento, fechaEntrada);
    const esMenorDe14 = edad !== null && edad < 14;
    const esMenorDeEdad = edad !== null && edad < 18;

    return (
        <div>
            <div className="flex items-start justify-between gap-3">
                <h1 className="font-serif text-2xl font-bold text-text-primary leading-tight">
                    {idx === 0 ? tx('tus_datos') : tx('persona_de', { n: idx + 1, total })}
                </h1>
                {idx > 0 && (
                    <button
                        type="button"
                        onClick={() => quitar(idx)}
                        className="min-h-[44px] px-3 rounded-xl text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5 text-sm font-bold"
                    >
                        <Trash2 size={16} aria-hidden="true" /> {tx('quitar')}
                    </button>
                )}
            </div>
            <p className="text-base text-gray-600 mt-1">
                {idx === 0 && t.is_titular
                    ? tx('sub_titular')
                    : idx === 0
                        ? tx('sub_segundo_movil')
                        : tx('sub_acompanante')}
            </p>
            {idx > 0 && (
                <p className="text-sm text-gray-600 mt-2 leading-snug">
                    {tx('quitar_ayuda')}
                </p>
            )}

            <Caja className="mt-5">
                <Campo etiqueta={tx('nombre')} id={`n${idx}`} error={pegas.nombre}>
                    <input id={`n${idx}`} className={cInput} type="text" autoComplete="given-name"
                        autoCapitalize="words" value={t.nombre}
                        onChange={(e) => cambiar(idx, 'nombre', e.target.value)} />
                </Campo>
                <Campo etiqueta={tx('apellido1')} id={`a1${idx}`} error={pegas.apellido_primero}>
                    <input id={`a1${idx}`} className={cInput} type="text" autoComplete="family-name"
                        autoCapitalize="words" value={t.apellido_primero}
                        onChange={(e) => cambiar(idx, 'apellido_primero', e.target.value)} />
                </Campo>
                <Campo etiqueta={tx('apellido2')} ayuda={tx('apellido2_ayuda')}
                    id={`a2${idx}`} error={pegas.apellido_segundo}>
                    <input id={`a2${idx}`} className={cInput} type="text" autoCapitalize="words"
                        value={t.apellido_segundo}
                        onChange={(e) => cambiar(idx, 'apellido_segundo', e.target.value)} />
                </Campo>

                <Campo etiqueta={tx('sexo')} error={pegas.sexo}>
                    <div className="flex gap-2">
                        {['H', 'M', 'X'].map((v) => (
                            <button key={v} type="button" onClick={() => cambiar(idx, 'sexo', v)}
                                aria-pressed={t.sexo === v}
                                className={`flex-1 min-h-[52px] px-2 rounded-2xl border-2 font-bold text-sm ${
                                    t.sexo === v
                                        ? 'bg-rural-600 border-rural-600 text-white'
                                        : 'bg-white border-gray-200 text-gray-700'
                                }`}>
                                {tx(`sexo_${v}`)}
                            </button>
                        ))}
                    </div>
                </Campo>

                <Campo etiqueta={tx('fecha_nac')} id={`fn${idx}`} error={pegas.fecha_nacimiento}>
                    <input id={`fn${idx}`} className={cInput} type="date" max={hoyISO()}
                        autoComplete="bday" value={t.fecha_nacimiento}
                        onChange={(e) => cambiar(idx, 'fecha_nacimiento', e.target.value)} />
                </Campo>
            </Caja>

            <Caja className="mt-4">
                <Campo etiqueta={tx('tipo_doc')} id={`td${idx}`}>
                    <select id={`td${idx}`} className={cInput} value={t.tipo_documento}
                        onChange={(e) => cambiar(idx, 'tipo_documento', e.target.value)}>
                        {DOC_TYPES.map((c) => <option key={c} value={c}>{tx(`doc_${c}`)}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta={tx('num_doc')} id={`nd${idx}`} error={pegas.numero_documento}>
                    <input id={`nd${idx}`} className={`${cInput} font-mono tracking-wide`} type="text"
                        inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                        maxLength={20} value={t.numero_documento}
                        onChange={(e) => cambiar(idx, 'numero_documento', e.target.value.toUpperCase().replace(/\s/g, ''))} />
                </Campo>
                <Campo
                    etiqueta={tx('soporte')}
                    ayuda={tx('soporte_ayuda')}
                    id={`sd${idx}`}
                    error={pegas.soporte_documento}
                >
                    <input id={`sd${idx}`} className={`${cInput} font-mono tracking-wide`} type="text"
                        autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={20}
                        value={t.soporte_documento}
                        onChange={(e) => cambiar(idx, 'soporte_documento', e.target.value.toUpperCase().replace(/\s/g, ''))} />
                </Campo>
                <Campo etiqueta={tx('nacionalidad')} id={`na${idx}`} error={pegas.nacionalidad}>
                    <SelectPais id={`na${idx}`} paises={paises} value={t.nacionalidad}
                        onChange={(v) => cambiar(idx, 'nacionalidad', v)} />
                </Campo>
            </Caja>

            <Caja className="mt-4">
                <p className="font-bold text-lg text-text-primary mb-3">{tx('donde_vives')}</p>
                <Campo etiqueta={tx('calle')} id={`dv${idx}`} error={pegas.direccion_via}>
                    <input id={`dv${idx}`} className={cInput} type="text" autoComplete="street-address"
                        maxLength={200} value={t.direccion_via}
                        onChange={(e) => cambiar(idx, 'direccion_via', e.target.value)} />
                </Campo>
                <Campo etiqueta={tx('municipio')} id={`dm${idx}`} error={pegas.direccion_municipio}
                    ayuda={t.direccion_pais === 'ESP' ? tx('municipio_ayuda') : undefined}>
                    <CampoMunicipio id={`dm${idx}`} valor={t.direccion_municipio} cp={t.direccion_cp}
                        esEspana={t.direccion_pais === 'ESP'} elegido={!!t.direccion_municipio_ine}
                        onEscribir={(v) => { cambiar(idx, 'direccion_municipio', v); cambiar(idx, 'direccion_municipio_ine', ''); }}
                        onElegir={(m) => { cambiar(idx, 'direccion_municipio', m.nombre); cambiar(idx, 'direccion_municipio_ine', m.codigo); }} />
                </Campo>
                <Campo etiqueta={tx('cp')} id={`dc${idx}`}>
                    <input id={`dc${idx}`} className={cInput} type="text" inputMode="numeric"
                        autoComplete="postal-code" maxLength={10} value={t.direccion_cp}
                        onChange={(e) => cambiar(idx, 'direccion_cp', e.target.value)} />
                </Campo>
                <Campo etiqueta={tx('pais')} id={`dp${idx}`} error={pegas.direccion_pais}>
                    <SelectPais id={`dp${idx}`} paises={paises} value={t.direccion_pais}
                        onChange={(v) => cambiar(idx, 'direccion_pais', v)} />
                </Campo>
            </Caja>

            {!esMenorDe14 && (
                <Caja className="mt-4">
                    <p className="font-bold text-lg text-text-primary mb-3">{tx('localizarte')}</p>
                    <Campo etiqueta={tx('movil')} id={`tm${idx}`} error={pegas.telefono_movil}>
                        <input id={`tm${idx}`} className={cInput} type="tel" inputMode="tel"
                            autoComplete="tel" value={t.telefono_movil}
                            onChange={(e) => cambiar(idx, 'telefono_movil', e.target.value)} />
                    </Campo>
                    <Campo etiqueta={tx('email')} id={`em${idx}`}>
                        <input id={`em${idx}`} className={cInput} type="email" inputMode="email"
                            autoComplete="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                            value={t.email}
                            onChange={(e) => cambiar(idx, 'email', e.target.value)} />
                    </Campo>
                </Caja>
            )}

            {esMenorDeEdad && (
                <p className="mt-4 text-base text-gray-600 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    {tx('aviso_menor')}
                </p>
            )}

            {esMenorDe14 ? (
                <p className="mt-4 text-base text-gray-600 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    {tx('aviso_menor14')}
                </p>
            ) : (
                <Caja className="mt-4">
                    <Campo
                        etiqueta={tx('firma')}
                        ayuda={tx('firma_ayuda')}
                        error={pegas.firma_base64}
                    >
                        <Firma valor={t.firma_base64} onChange={(v) => cambiar(idx, 'firma_base64', v)} />
                    </Campo>
                </Caja>
            )}
        </div>
    );
};

const Repaso = ({
    travelers, fechaEntrada, maximo, onEditar, onAnadir, onQuitar,
    accept, setAccept, error, cambiar, preguntarPagador, pagador, setPagador,
}) => {
    const incompletos = travelers
        .map((t, i) => ({ i, pegas: pegasDe(t, fechaEntrada) }))
        .filter((x) => Object.keys(x.pegas).length > 0);
    const menores = pegasDeLosMenores(travelers, fechaEntrada);
    const { tx } = useIdioma();

    return (
        <div>
            <h1 className="font-serif text-2xl font-bold text-text-primary">{tx('repaso_titulo')}</h1>
            <p className="text-base text-gray-600 mt-1">
                {tx('repaso_sub')}
            </p>

            <ul className="mt-5 space-y-3">
                {travelers.map((t, i) => {
                    const edad = edadEn(t.fecha_nacimiento, fechaEntrada);
                    const mal = Object.keys(pegasDe(t, fechaEntrada)).length > 0;
                    return (
                        <li key={i}>
                            <div className={`bg-white rounded-2xl border p-4 flex items-start gap-3 ${mal ? 'border-amber-300' : 'border-gray-200'}`}>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-base text-text-primary break-words">
                                        {[t.nombre, t.apellido_primero, t.apellido_segundo].filter(Boolean).join(' ') || tx('sin_nombre')}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {i === 0 ? tx('quien_reserva') : tx('acompanante')}
                                        {edad !== null ? ` · ${tx('anos', { n: edad })}` : ''}
                                        {t.numero_documento ? ` · ${t.numero_documento}` : ''}
                                    </p>
                                    {mal && (
                                        <p className="text-sm font-semibold text-amber-800 mt-1 flex items-center gap-1.5">
                                            <AlertCircle size={15} aria-hidden="true" /> {tx('faltan_cosas')}
                                        </p>
                                    )}
                                </div>
                                <button type="button" onClick={() => onEditar(i)}
                                    className="min-h-[44px] px-3 rounded-xl text-rural-700 bg-rural-50 font-bold text-sm inline-flex items-center gap-1.5">
                                    <Pencil size={15} aria-hidden="true" /> {tx('cambiar')}
                                </button>
                                {i > 0 && (
                                    <button type="button" onClick={() => onQuitar(i)}
                                        aria-label={tx('quitar_a', { nombre: t.nombre || tx('esta_persona') })}
                                        className="min-h-[44px] px-2 rounded-xl text-red-700 hover:bg-red-50">
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            {travelers.length < maximo && (
                <button type="button" onClick={onAnadir}
                    className="w-full mt-4 min-h-[52px] rounded-2xl border-2 border-dashed border-rural-300 text-rural-700 font-bold inline-flex items-center justify-center gap-2">
                    <UserPlus size={19} aria-hidden="true" /> {tx('anadir')}
                </button>
            )}
            {travelers.length >= maximo && (
                <p className="mt-4 text-sm text-gray-500">
                    {tx('reserva_para', { personas: tx(maximo === 1 ? 'personas_1' : 'personas_n', { n: maximo }) })}
                </p>
            )}

            {incompletos.length > 0 && (
                <p className="mt-5 text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    {tx(incompletos.length === 1 ? 'incompletos_1' : 'incompletos_n', { n: incompletos.length })}
                </p>
            )}

            {menores.length > 0 && (
                <BloqueMenores
                    menores={menores}
                    travelers={travelers}
                    fechaEntrada={fechaEntrada}
                    cambiar={cambiar}
                />
            )}

            {preguntarPagador && (
                <BloquePagador pagador={pagador} setPagador={setPagador} travelers={travelers} />
            )}

            <label className="mt-5 flex items-start gap-3 bg-white rounded-2xl border border-gray-200 p-4">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
                    className="mt-1 h-6 w-6 accent-rural-600 shrink-0" />
                <span className="text-base text-gray-700 leading-relaxed">
                    {tx('acepto_antes')}
                    <Link to="/privacidad" target="_blank" className="underline text-rural-700 font-semibold">
                        {tx('acepto_enlace')}
                    </Link>{tx('acepto_despues')}
                </span>
            </label>

            {error && (
                <p className="mt-4 text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    {tx(error)}
                </p>
            )}
        </div>
    );
};

/**
 * Los menores: con quién vienen y qué es esa persona de ellos.
 *
 * La pregunta se le hace al ADULTO y la respuesta se guarda en la ficha del
 * ADULTO. Es lo que exige el Ministerio y lo contrario de lo que se hacía
 * antes, que la guardaba en la ficha del niño.
 */
const BloqueMenores = ({ menores, travelers, fechaEntrada, cambiar }) => {
    const adultos = travelers
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => esAdulto(t, fechaEntrada));

    const asignar = (menorIdx, adultoIdx) => {
        // Un adulto acompaña a un menor: si ya acompañaba a otro, se queda
        // con el último. Y al menor anterior se le suelta.
        travelers.forEach((t, j) => {
            if (Number(t.acompana_a) === menorIdx && j !== adultoIdx) {
                cambiar(j, 'acompana_a', null);
                cambiar(j, 'parentesco', '');
            }
        });
        cambiar(adultoIdx, 'acompana_a', menorIdx);
    };
    const { tx } = useIdioma();
    const nombreDe = (i) => travelers[i]?.nombre || tx('persona_n', { n: i + 1 });

    return (
        <div className="mt-5">
            <Caja>
                <p className="font-bold text-lg text-text-primary">{tx('menores_titulo')}</p>
                <p className="text-sm text-gray-600 mt-1 leading-snug">
                    {tx('menores_sub')}
                </p>

                {menores.map((m) => (
                    <div key={m.idx} className="mt-5 pt-4 border-t border-gray-100 first:border-0 first:pt-0 first:mt-4">
                        <p className="font-bold text-base text-text-primary mb-2">
                            {m.nombre || nombreDe(m.idx)}
                        </p>

                        {!m.hayAdulto ? (
                            <p className="text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                                {tx('menor_sin_adulto')}
                            </p>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600 mb-2">{tx('con_quien')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {adultos.map(({ t, i }) => {
                                        const elegido = Number(t.acompana_a) === m.idx;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => asignar(m.idx, i)}
                                                aria-pressed={elegido}
                                                className={`min-h-[48px] px-4 rounded-2xl border-2 font-bold text-base ${
                                                    elegido
                                                        ? 'bg-rural-600 border-rural-600 text-white'
                                                        : 'bg-white border-gray-200 text-gray-700'
                                                }`}
                                            >
                                                {elegido ? '✓ ' : ''}{nombreDe(i)}
                                            </button>
                                        );
                                    })}
                                </div>

                                {m.adultoIdx >= 0 && (
                                    <div className="mt-4">
                                        <label
                                            htmlFor={`rel${m.idx}`}
                                            className="block text-base font-bold text-text-primary mb-1"
                                        >
                                            {tx('rel_etiqueta', {
                                                adulto: travelers[m.adultoIdx].nombre || tx('esa_persona'),
                                                menor: m.nombre || nombreDe(m.idx),
                                            })}
                                        </label>
                                        <select
                                            id={`rel${m.idx}`}
                                            className={cInput}
                                            value={travelers[m.adultoIdx].parentesco || ''}
                                            onChange={(e) => cambiar(m.adultoIdx, 'parentesco', e.target.value)}
                                        >
                                            <option value="">{tx('elige_opcion')}</option>
                                            {PARENTESCOS.map((c) => (
                                                <option key={c} value={c}>{tx(`par_${c}`)}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {m.falta && (
                                    <p className="mt-3 text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                                        <AlertCircle size={15} aria-hidden="true" />
                                        {m.falta === 'sin_asignar'
                                            ? tx('falta_asignar')
                                            : tx('falta_relacion')}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                ))}
            </Caja>
        </div>
    );
};

/**
 * Quién ha pagado.
 *
 * El anexo I pide el TITULAR DEL MEDIO DE PAGO, y hasta ahora se daba por
 * hecho que era quien reserva. Con una transferencia de otra persona, eso es
 * afirmar algo falso en un registro policial.
 *
 * Sólo sale cuando de verdad no lo sabemos: si la reserva vino de Booking o
 * de Airbnb, o si ya se pagó con tarjeta por la web, no se pregunta nada.
 */
const BloquePagador = ({ pagador, setPagador, travelers }) => {
    const quienReserva = [travelers[0]?.nombre, travelers[0]?.apellido_primero]
        .filter(Boolean).join(' ').trim();
    const { tx } = useIdioma();

    return (
        <div className="mt-5">
            <Caja>
                <p className="font-bold text-lg text-text-primary">{tx('pagador_titulo')}</p>
                <p className="text-sm text-gray-600 mt-1 leading-snug">
                    {tx('pagador_sub')}
                </p>

                <div className="mt-4 space-y-2">
                    <button
                        type="button"
                        onClick={() => setPagador({ quien: 'yo', nombre: quienReserva })}
                        aria-pressed={pagador.quien === 'yo'}
                        className={`w-full text-left min-h-[52px] px-4 py-3 rounded-2xl border-2 font-bold text-base ${
                            pagador.quien === 'yo'
                                ? 'bg-rural-600 border-rural-600 text-white'
                                : 'bg-white border-gray-200 text-gray-700'
                        }`}
                    >
                        {pagador.quien === 'yo' ? '✓ ' : ''}{tx('pagado_yo')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setPagador({ quien: 'otra', nombre: pagador.quien === 'otra' ? pagador.nombre : '' })}
                        aria-pressed={pagador.quien === 'otra'}
                        className={`w-full text-left min-h-[52px] px-4 py-3 rounded-2xl border-2 font-bold text-base ${
                            pagador.quien === 'otra'
                                ? 'bg-rural-600 border-rural-600 text-white'
                                : 'bg-white border-gray-200 text-gray-700'
                        }`}
                    >
                        {pagador.quien === 'otra' ? '✓ ' : ''}{tx('pagado_otra')}
                    </button>
                </div>

                {pagador.quien === 'otra' && (
                    <div className="mt-4">
                        <label htmlFor="pagador-nombre" className="block text-base font-bold text-text-primary mb-1">
                            {tx('como_se_llama')}
                        </label>
                        <input
                            id="pagador-nombre"
                            className={cInput}
                            type="text"
                            autoCapitalize="words"
                            value={pagador.nombre}
                            onChange={(e) => setPagador({ quien: 'otra', nombre: e.target.value })}
                        />
                    </div>
                )}
            </Caja>
        </div>
    );
};

const Terminado = ({ booking, cuantos }) => {
    const { tx } = useIdioma();
    return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-rural-600 flex items-center justify-center text-white">
            <Check size={30} aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">{tx('listo')}</h1>
        <p className="text-base text-gray-700 leading-relaxed">
            {tx('terminado_antes', { personas: tx(cuantos === 1 ? 'personas_1' : 'personas_n', { n: cuantos }) })}
            <strong className="font-mono">{booking?.booking_code}</strong>{tx('terminado_despues')}
        </p>
        <p className="text-sm text-gray-500 mt-4">
            {tx('terminado_error')}
        </p>
        <Link to="/" className="inline-block mt-6 px-6 py-3.5 rounded-2xl font-bold text-white bg-rural-600">
            {tx('volver')}
        </Link>
    </div>
    );
};

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

const cInput =
    'w-full min-h-[52px] px-4 py-3 text-base bg-white border-2 border-gray-200 rounded-2xl '
    + 'text-text-primary outline-none focus:border-rural-600 focus:ring-4 focus:ring-rural-600/15 transition-colors';

const Campo = ({ etiqueta, ayuda, error, id, children }) => (
    <div className="mb-5 last:mb-0">
        <label htmlFor={id} className="block text-base font-bold text-text-primary mb-1">{etiqueta}</label>
        {ayuda && <p className="text-sm text-gray-600 mb-2 leading-snug">{ayuda}</p>}
        {children}
        {error && (
            <p role="alert" className="mt-1.5 text-sm font-semibold text-red-700 flex items-center gap-1.5">
                <AlertCircle size={15} aria-hidden="true" /> {error}
            </p>
        )}
    </div>
);

// El municipio español se elige de la relación del INE (tjm_municipios_buscar,
// migración 0042): así la ficha lleva el código que exige el Ministerio y no
// hay que adivinarlo después. Fuera de España es un texto libre.
const CampoMunicipio = ({ id, valor, cp, esEspana, elegido, onEscribir, onElegir }) => {
    const [opciones, setOpciones] = useState([]);
    const [abierto, setAbierto] = useState(false);
    const ultimaBusqueda = useRef(0);

    useEffect(() => {
        if (!esEspana || elegido || !abierto || valor.trim().length < 2) { setOpciones([]); return; }
        const marca = ++ultimaBusqueda.current;
        const timer = setTimeout(async () => {
            const { data } = await supabase.rpc('tjm_municipios_buscar', { p_q: valor, p_cp: cp || null });
            if (marca === ultimaBusqueda.current) setOpciones(data || []);
        }, 250);
        return () => clearTimeout(timer);
    }, [valor, cp, esEspana, elegido, abierto]);

    return (
        <div className="relative">
            <input id={id} className={cInput} type="text" autoComplete="address-level2"
                value={valor}
                onChange={(e) => { setAbierto(true); onEscribir(e.target.value); }}
                onFocus={() => setAbierto(true)}
                onBlur={() => setTimeout(() => setAbierto(false), 150)}
                aria-autocomplete={esEspana ? 'list' : undefined}
                aria-expanded={esEspana && abierto && opciones.length > 0} />
            {esEspana && elegido && (
                <Check size={18} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-rural-600" />
            )}
            {esEspana && abierto && opciones.length > 0 && (
                <ul role="listbox" className="absolute z-20 left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-2xl shadow-lg overflow-hidden">
                    {opciones.map((m) => (
                        <li key={m.codigo} role="option" aria-selected="false">
                            <button type="button"
                                className="w-full text-left px-4 py-3 text-base hover:bg-rural-100 focus:bg-rural-100 outline-none"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { onElegir(m); setAbierto(false); setOpciones([]); }}>
                                <span className="font-semibold text-text-primary">{m.nombre}</span>
                                <span className="text-gray-500"> · {m.provincia}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const SelectPais = ({ id, paises, value, onChange }) => {
    const { tx } = useIdioma();
    return (
        <select id={id} className={cInput} value={value} onChange={(e) => onChange(e.target.value)}>
            <optgroup label={tx('paises_frecuentes')}>
                {paises.frecuentes.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </optgroup>
            <optgroup label={tx('paises_todos')}>
                {paises.resto.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </optgroup>
        </select>
    );
};

// ---------------------------------------------------------------------------
// Firma con el dedo
// ---------------------------------------------------------------------------

const Firma = ({ valor, onChange }) => {
    const lienzo = useRef(null);
    const pintando = useRef(false);
    const [tieneTrazo, setTieneTrazo] = useState(!!valor);
    const { tx } = useIdioma();

    const preparar = useCallback(() => {
        const c = lienzo.current;
        if (!c) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const ancho = c.clientWidth;
        const alto = c.clientHeight;
        if (!ancho || !alto) return;
        c.width = Math.round(ancho * dpr);
        c.height = Math.round(alto * dpr);
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ancho, alto);
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#2C3319';
        // Si ya había firma guardada, se vuelve a dibujar.
        if (valor) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, ancho, alto);
            img.src = valor;
        }
    }, [valor]);

    useEffect(() => {
        preparar();
        const alRedimensionar = () => preparar();
        window.addEventListener('resize', alRedimensionar);
        return () => window.removeEventListener('resize', alRedimensionar);
        // Sólo al montar: si se rehiciera con cada trazo, se borraría lo pintado.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const punto = (e) => {
        const c = lienzo.current;
        const r = c.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const empezar = (e) => {
        e.preventDefault();
        const c = lienzo.current;
        c.setPointerCapture?.(e.pointerId);
        pintando.current = true;
        const ctx = c.getContext('2d');
        const p = punto(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        // Un toque seco también deja marca.
        ctx.lineTo(p.x + 0.1, p.y + 0.1);
        ctx.stroke();
        setTieneTrazo(true);
    };

    const mover = (e) => {
        if (!pintando.current) return;
        e.preventDefault();
        const ctx = lienzo.current.getContext('2d');
        const p = punto(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };

    const soltar = (e) => {
        if (!pintando.current) return;
        pintando.current = false;
        lienzo.current.releasePointerCapture?.(e.pointerId);
        onChange(lienzo.current.toDataURL('image/png'));
    };

    const borrar = () => {
        const c = lienzo.current;
        const ctx = c.getContext('2d');
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.restore();
        setTieneTrazo(false);
        onChange('');
    };

    return (
        <div>
            <canvas
                ref={lienzo}
                className="w-full h-[170px] rounded-2xl border-2 border-dashed border-gray-300 bg-white touch-none cursor-crosshair"
                onPointerDown={empezar}
                onPointerMove={mover}
                onPointerUp={soltar}
                onPointerLeave={soltar}
                onPointerCancel={soltar}
                aria-label={tx('firma_aria')}
                role="img"
            />
            <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                    {tieneTrazo ? tx('firma_recogida') : tx('firma_aqui')}
                </span>
                <button type="button" onClick={borrar}
                    className="min-h-[44px] px-3 rounded-xl text-rural-700 bg-rural-50 font-bold text-sm inline-flex items-center gap-1.5">
                    <Eraser size={15} aria-hidden="true" /> {tx('borrar')}
                </button>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------

/**
 * Trae la reserva a partir del código del enlace.
 *
 * Primero por la función `tjm_precheckin_reserva`, que es la vía buena: sólo
 * devuelve lo que el formulario necesita y funciona SIN sesión, que es como
 * llega el huésped. Mientras esa función no exista, se prueba a leer la tabla
 * — y eso sólo sale bien si quien mira ya ha entrado en el panel (el caso de
 * «Rellenarlo yo»). Un huésped desde su móvil, sin sesión, no puede leer
 * `guest_bookings`: lo tapa la seguridad por filas.
 */
async function leerReserva(code) {
    const CAMPOS = 'booking_code, guest_name, guest_email, guest_phone, pax_count, '
        + 'check_in, check_out, status, channel, payment_status';

    const porFuncion = await supabase.rpc('tjm_precheckin_reserva', { p_booking_code: code });
    if (!porFuncion.error && porFuncion.data) {
        const fila = Array.isArray(porFuncion.data) ? porFuncion.data[0] : porFuncion.data;
        if (fila) return fila;
    }

    const { data } = await supabase
        .from('guest_bookings')
        .select(`${CAMPOS}, apartments(name)`)
        .eq('booking_code', code)
        .maybeSingle();
    return data || null;
}

function leerBorrador(code) {
    try {
        const crudo = localStorage.getItem(claveBorrador(code));
        return crudo ? JSON.parse(crudo) : null;
    } catch {
        return null;
    }
}

export default PrecheckinPage;
