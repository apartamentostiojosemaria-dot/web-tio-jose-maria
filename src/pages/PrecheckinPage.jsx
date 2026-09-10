import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Check, Shield, Trash2, Eraser, Save,
    UserPlus, Pencil, AlertCircle,
} from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';

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
// Países (ISO 3166-1: alfa-2 → alfa-3). El nombre en castellano lo pone el
// propio navegador, así que la lista no se queda vieja ni hay que traducirla.
// ---------------------------------------------------------------------------
const ISO_PAISES = 'AD:AND,AE:ARE,AF:AFG,AG:ATG,AI:AIA,AL:ALB,AM:ARM,AO:AGO,AR:ARG,AS:ASM,AT:AUT,AU:AUS,AW:ABW,AX:ALA,AZ:AZE,BA:BIH,BB:BRB,BD:BGD,BE:BEL,BF:BFA,BG:BGR,BH:BHR,BI:BDI,BJ:BEN,BL:BLM,BM:BMU,BN:BRN,BO:BOL,BQ:BES,BR:BRA,BS:BHS,BT:BTN,BW:BWA,BY:BLR,BZ:BLZ,CA:CAN,CC:CCK,CD:COD,CF:CAF,CG:COG,CH:CHE,CI:CIV,CK:COK,CL:CHL,CM:CMR,CN:CHN,CO:COL,CR:CRI,CU:CUB,CV:CPV,CW:CUW,CX:CXR,CY:CYP,CZ:CZE,DE:DEU,DJ:DJI,DK:DNK,DM:DMA,DO:DOM,DZ:DZA,EC:ECU,EE:EST,EG:EGY,EH:ESH,ER:ERI,ES:ESP,ET:ETH,FI:FIN,FJ:FJI,FK:FLK,FM:FSM,FO:FRO,FR:FRA,GA:GAB,GB:GBR,GD:GRD,GE:GEO,GF:GUF,GG:GGY,GH:GHA,GI:GIB,GL:GRL,GM:GMB,GN:GIN,GP:GLP,GQ:GNQ,GR:GRC,GT:GTM,GU:GUM,GW:GNB,GY:GUY,HK:HKG,HN:HND,HR:HRV,HT:HTI,HU:HUN,ID:IDN,IE:IRL,IL:ISR,IM:IMN,IN:IND,IO:IOT,IQ:IRQ,IR:IRN,IS:ISL,IT:ITA,JE:JEY,JM:JAM,JO:JOR,JP:JPN,KE:KEN,KG:KGZ,KH:KHM,KI:KIR,KM:COM,KN:KNA,KP:PRK,KR:KOR,KW:KWT,KY:CYM,KZ:KAZ,LA:LAO,LB:LBN,LC:LCA,LI:LIE,LK:LKA,LR:LBR,LS:LSO,LT:LTU,LU:LUX,LV:LVA,LY:LBY,MA:MAR,MC:MCO,MD:MDA,ME:MNE,MF:MAF,MG:MDG,MH:MHL,MK:MKD,ML:MLI,MM:MMR,MN:MNG,MO:MAC,MP:MNP,MQ:MTQ,MR:MRT,MS:MSR,MT:MLT,MU:MUS,MV:MDV,MW:MWI,MX:MEX,MY:MYS,MZ:MOZ,NA:NAM,NC:NCL,NE:NER,NF:NFK,NG:NGA,NI:NIC,NL:NLD,NO:NOR,NP:NPL,NR:NRU,NU:NIU,NZ:NZL,OM:OMN,PA:PAN,PE:PER,PF:PYF,PG:PNG,PH:PHL,PK:PAK,PL:POL,PM:SPM,PN:PCN,PR:PRI,PS:PSE,PT:PRT,PW:PLW,PY:PRY,QA:QAT,RE:REU,RO:ROU,RS:SRB,RU:RUS,RW:RWA,SA:SAU,SB:SLB,SC:SYC,SD:SDN,SE:SWE,SG:SGP,SH:SHN,SI:SVN,SJ:SJM,SK:SVK,SL:SLE,SM:SMR,SN:SEN,SO:SOM,SR:SUR,SS:SSD,ST:STP,SV:SLV,SX:SXM,SY:SYR,SZ:SWZ,TC:TCA,TD:TCD,TG:TGO,TH:THA,TJ:TJK,TK:TKL,TL:TLS,TM:TKM,TN:TUN,TO:TON,TR:TUR,TT:TTO,TV:TUV,TW:TWN,TZ:TZA,UA:UKR,UG:UGA,US:USA,UY:URY,UZ:UZB,VA:VAT,VC:VCT,VE:VEN,VG:VGB,VI:VIR,VN:VNM,VU:VUT,WF:WLF,WS:WSM,XK:XKK,YE:YEM,YT:MYT,ZA:ZAF,ZM:ZMB,ZW:ZWE';

/** Los que más salen, arriba del todo para no hacer scroll. */
const PAISES_FRECUENTES = ['ESP', 'FRA', 'GBR', 'DEU', 'PRT', 'NLD', 'BEL', 'ITA'];

function construirPaises() {
    let nombreDe = (iso2, iso3) => iso3;
    try {
        const dn = new Intl.DisplayNames(['es'], { type: 'region' });
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
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return { frecuentes, resto };
}

const DOC_TYPES = [
    { code: 'D', name: 'DNI español' },
    { code: 'P', name: 'Pasaporte' },
    { code: 'N', name: 'NIE / tarjeta de residencia' },
    { code: 'E', name: 'Documento de identidad de otro país' },
    { code: 'C', name: 'Permiso de conducir de la UE' },
    { code: 'X', name: 'Otro documento oficial' },
];

// Cuatro opciones, no las quince del Ministerio.
// PENDIENTE: desde la migración `0008` la base YA admite el catálogo entero
// del MIR (hijo/a, nieto/a, hermano/a, sobrino/a…). Lo único que falta es
// ampliar esta lista; el CHECK ya no estorba. Ojo al ampliarla: usar los
// códigos del MIR (HJ, SG, HR, SB, NI…) y dejar 'PA' donde está, que es el
// heredado y la edge function lo traduce a 'PM' al enviar.
const PARENTESCOS = [
    { code: 'PA', name: 'Soy su padre o su madre' },
    { code: 'AB', name: 'Soy su abuelo o su abuela' },
    { code: 'TU', name: 'Soy su tutor o su tutora' },
    { code: 'OT', name: 'Otro' },
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
    direccion_cp: '',
    direccion_pais: 'ESP',
    telefono_fijo: '',
    telefono_movil: '',
    email: '',
    parentesco: '',
    firma_base64: '',
});

const claveBorrador = (code) => `tjm-precheckin-${code}`;

/** Qué le falta a este viajero para poder seguir. */
function pegasDe(t, fechaEntrada) {
    const p = {};
    if (!t.nombre.trim()) p.nombre = 'Pon el nombre';
    if (!t.apellido_primero.trim()) p.apellido_primero = 'Pon el primer apellido';
    if (!t.sexo) p.sexo = 'Elige una opción';
    if (!t.fecha_nacimiento) p.fecha_nacimiento = 'Pon la fecha de nacimiento';
    else if (t.fecha_nacimiento > hoyISO()) p.fecha_nacimiento = 'Esa fecha todavía no ha llegado';
    if (!t.nacionalidad) p.nacionalidad = 'Elige el país';
    if (!t.direccion_via.trim()) p.direccion_via = 'Pon la calle y el número';
    if (!t.direccion_municipio.trim()) p.direccion_municipio = 'Pon el pueblo o la ciudad';
    if (!t.direccion_pais) p.direccion_pais = 'Elige el país';

    const edad = edadEn(t.fecha_nacimiento, fechaEntrada);
    // El documento sólo se le pide a los mayores de edad: un niño puede no
    // tener ninguno todavía y sus datos los da quien lo acompaña.
    if ((edad === null || edad >= 18) && !t.numero_documento.trim()) {
        p.numero_documento = 'Pon el número del documento';
    }
    // Con DNI o NIE, el Ministerio exige tambien el segundo apellido y el
    // numero de soporte: sin ellos rechaza el parte entero.
    const documentoEspanol = t.numero_documento.trim()
        && (t.tipo_documento === 'D' || t.tipo_documento === 'N');
    if (documentoEspanol && !t.soporte_documento.trim()) {
        p.soporte_documento = 'Con DNI o NIE hace falta este número';
    }
    if (documentoEspanol && !t.apellido_segundo.trim()) {
        p.apellido_segundo = 'Con DNI o NIE hace falta el segundo apellido';
    }
    if (edad !== null && edad >= 14 && !t.firma_base64) p.firma_base64 = 'Falta la firma';
    if (edad !== null && edad < 18 && !t.is_titular && !t.parentesco) {
        p.parentesco = 'Elige la relación';
    }
    if (t.is_titular && !t.telefono_movil.trim()) p.telefono_movil = 'Pon un teléfono de contacto';
    return p;
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------

const PrecheckinPage = () => {
    const [params] = useSearchParams();
    const code = (params.get('code') || '').toUpperCase();

    const [booking, setBooking] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState(null);

    const [travelers, setTravelers] = useState([emptyTraveler(true)]);
    const [paso, setPaso] = useState(0);          // 0 = portada · 1..N = viajeros · N+1 = repaso
    const [tocados, setTocados] = useState({});   // campos que ya se han intentado
    const [accept, setAccept] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState(null);
    const [hecho, setHecho] = useState(false);
    const [huboBorrador, setHuboBorrador] = useState(false);
    const [guardadoAviso, setGuardadoAviso] = useState(false);

    const paises = useMemo(construirPaises, []);
    const arriba = useRef(null);

    // ------------------------------------------------------------- cargar
    useEffect(() => {
        if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) {
            setErrorCarga('El enlace no es válido. Revisa el correo de confirmación o escríbenos.');
            setCargando(false);
            return;
        }
        (async () => {
            const { data, error } = await supabase
                .from('guest_bookings')
                .select('booking_code, guest_name, guest_email, guest_phone, pax_count, check_in, check_out, status, apartments(name)')
                .eq('booking_code', code)
                .maybeSingle();

            if (error || !data) {
                setErrorCarga('No encontramos esa reserva. Revisa el enlace o escríbenos.');
            } else if (!['confirmed', 'completed'].includes(data.status)) {
                setErrorCarga('Esta reserva todavía no está confirmada. Termina el pago primero.');
            } else if (data.check_in && new Date(data.check_in) - new Date() > 7 * 86400000) {
                setErrorCarga('Este formulario se abre una semana antes de tu llegada. Te avisaremos por correo.');
            } else {
                setBooking(data);
                const guardado = leerBorrador(code);
                if (guardado?.travelers?.length) {
                    setTravelers(guardado.travelers);
                    setHuboBorrador(true);
                } else {
                    const partes = (data.guest_name || '').trim().split(/\s+/);
                    setTravelers([{
                        ...emptyTraveler(true),
                        nombre: partes[0] || '',
                        apellido_primero: partes[1] || '',
                        apellido_segundo: partes.slice(2).join(' ') || '',
                        email: data.guest_email || '',
                        telefono_movil: data.guest_phone || '',
                    }]);
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

    const enviar = async () => {
        if (!accept) return;
        setEnviando(true);
        setErrorEnvio(null);
        try {
            const { error } = await supabase.rpc('submit_traveler_records', {
                p_booking_code: code,
                p_travelers: travelers.map((t) => ({
                    ...t,
                    apellido_segundo: t.apellido_segundo || null,
                    soporte_documento: t.soporte_documento || null,
                    telefono_fijo: t.telefono_fijo || null,
                    telefono_movil: t.telefono_movil || null,
                    email: t.email || null,
                    parentesco: t.parentesco || null,
                    firma_base64: t.firma_base64 || null,
                })),
            });
            if (error) throw error;
            try { localStorage.removeItem(claveBorrador(code)); } catch { /* da igual */ }
            setHecho(true);
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('precheckin_too_early')) setErrorEnvio('Todavía es pronto. Se abre una semana antes de tu llegada.');
            else if (msg.includes('booking_status_invalid')) setErrorEnvio('La reserva no está confirmada todavía.');
            else if (msg.includes('booking_already_past')) setErrorEnvio('Esa reserva ya ha terminado.');
            else setErrorEnvio('No hemos podido guardarlo. Prueba otra vez en un momento o escríbenos.');
        } finally {
            setEnviando(false);
        }
    };

    // ----------------------------------------------------------- pintado
    return (
        <div className="min-h-screen bg-[#FCFBF9]">
            <PageHead
                title="Tus datos antes de llegar — Apartamentos Tío José María"
                description="Registro de viajeros obligatorio (Real Decreto 933/2021)."
                path="/precheckin"
                noindex
            />

            <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
                    <Link to="/" className="inline-flex items-center gap-1.5 text-rural-700 font-bold text-sm min-h-[44px]">
                        <ChevronLeft size={18} aria-hidden="true" /> Inicio
                    </Link>
                    {booking && !hecho && paso > 0 && (
                        <span className="text-sm font-semibold text-gray-600">
                            {paso <= total ? `Persona ${paso} de ${total}` : 'Último paso'}
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

            <main className="px-4 pb-28 pt-6">
                <div className="max-w-xl mx-auto" ref={arriba}>
                    {cargando ? (
                        <p className="text-center text-gray-500 py-20">Cargando tu reserva…</p>
                    ) : errorCarga ? (
                        <Caja>
                            <h1 className="font-serif text-2xl font-bold text-text-primary mb-2">Un momento</h1>
                            <p className="text-base text-gray-700">{errorCarga}</p>
                        </Caja>
                    ) : hecho ? (
                        <Terminado booking={booking} cuantos={total} />
                    ) : paso === 0 ? (
                        <Portada
                            booking={booking}
                            huboBorrador={huboBorrador}
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
                        />
                    )}
                </div>
            </main>

            {/* Barra de abajo: siempre a mano, nunca escondida */}
            {booking && !hecho && !errorCarga && paso > 0 && (
                <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3">
                    <div className="max-w-xl mx-auto flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setPaso(paso - 1)}
                            className="min-h-[52px] px-4 rounded-2xl font-bold text-rural-700 bg-white border-2 border-rural-200 hover:bg-rural-50"
                        >
                            <ChevronLeft size={20} aria-hidden="true" />
                            <span className="sr-only">Atrás</span>
                        </button>

                        {paso <= total ? (
                            <>
                                <button
                                    type="button"
                                    onClick={guardarYSalir}
                                    className="min-h-[52px] px-4 rounded-2xl font-bold text-rural-700 bg-rural-50 hover:bg-rural-100 inline-flex items-center gap-2"
                                >
                                    <Save size={18} aria-hidden="true" />
                                    <span className="hidden sm:inline">Guardar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={siguiente}
                                    className="flex-1 min-h-[52px] px-5 rounded-2xl font-bold text-white bg-rural-600 hover:bg-rural-700 inline-flex items-center justify-center gap-2"
                                >
                                    {paso === total ? 'Repasar' : 'Siguiente'}
                                    <ChevronRight size={20} aria-hidden="true" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={enviar}
                                disabled={!accept || enviando}
                                className="flex-1 min-h-[52px] px-5 rounded-2xl font-bold text-white bg-rural-600 hover:bg-rural-700 disabled:opacity-45 inline-flex items-center justify-center gap-2"
                            >
                                <Check size={20} aria-hidden="true" />
                                {enviando ? 'Guardando…' : 'Enviar mis datos'}
                            </button>
                        )}
                    </div>
                    {guardadoAviso && (
                        <p className="max-w-xl mx-auto mt-2 text-sm text-rural-700 font-semibold text-center">
                            Guardado en este móvil. Vuelve al mismo enlace cuando quieras y sigues donde lo dejaste.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

const Caja = ({ children, className = '' }) => (
    <div className={`bg-white rounded-3xl border border-gray-200 shadow-sm p-6 ${className}`}>{children}</div>
);

const Portada = ({ booking, huboBorrador, onEmpezar }) => (
    <>
        <h1 className="font-serif text-3xl font-bold text-text-primary leading-tight">
            Tus datos antes de llegar
        </h1>
        <p className="text-base text-gray-700 mt-3 leading-relaxed">
            La ley española nos obliga a registrar los datos de todas las personas que se alojan
            (Real Decreto 933/2021). Se rellena una vez, en un par de minutos, y así en la entrada
            sólo nos damos la bienvenida.
        </p>

        <Caja className="mt-5">
            <p className="text-sm uppercase tracking-widest font-bold text-gray-500">Tu reserva</p>
            <p className="font-serif text-xl font-bold text-text-primary mt-1">
                {booking?.apartments?.name}
            </p>
            <p className="text-base text-gray-700">
                Del {booking?.check_in} al {booking?.check_out} · {booking?.pax_count || 1}{' '}
                {(booking?.pax_count || 1) === 1 ? 'persona' : 'personas'}
            </p>
            <p className="font-mono text-sm text-rural-700 font-bold mt-1">{booking?.booking_code}</p>
        </Caja>

        {huboBorrador && (
            <p className="mt-4 text-base text-rural-800 bg-rural-50 border border-rural-200 rounded-2xl px-4 py-3">
                Ya habías empezado. Seguimos donde lo dejaste.
            </p>
        )}

        <ul className="mt-5 space-y-2 text-base text-gray-700">
            <li className="flex gap-2"><Shield size={18} className="mt-1 shrink-0 text-rural-600" aria-hidden="true" />
                Sólo se usan para cumplir esa obligación. No se comparten con nadie más.</li>
            <li className="flex gap-2"><Save size={18} className="mt-1 shrink-0 text-rural-600" aria-hidden="true" />
                Puedes dejarlo a medias: lo que escribas se queda guardado en este móvil.</li>
        </ul>

        <button
            type="button"
            onClick={onEmpezar}
            className="w-full mt-7 min-h-[56px] rounded-2xl font-bold text-white bg-rural-600 hover:bg-rural-700 text-lg inline-flex items-center justify-center gap-2"
        >
            Empezar <ChevronRight size={22} aria-hidden="true" />
        </button>
    </>
);

const PasoViajero = ({ idx, traveler: t, total, fechaEntrada, paises, mostrarPegas, cambiar, quitar }) => {
    const pegas = mostrarPegas ? pegasDe(t, fechaEntrada) : {};
    const edad = edadEn(t.fecha_nacimiento, fechaEntrada);
    const esMenorDe14 = edad !== null && edad < 14;
    const esMenorDeEdad = edad !== null && edad < 18;

    return (
        <div>
            <div className="flex items-start justify-between gap-3">
                <h1 className="font-serif text-2xl font-bold text-text-primary leading-tight">
                    {idx === 0 ? 'Tus datos' : `Persona ${idx + 1} de ${total}`}
                </h1>
                {idx > 0 && (
                    <button
                        type="button"
                        onClick={() => quitar(idx)}
                        className="min-h-[44px] px-3 rounded-xl text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5 text-sm font-bold"
                    >
                        <Trash2 size={16} aria-hidden="true" /> Quitar
                    </button>
                )}
            </div>
            <p className="text-base text-gray-600 mt-1">
                {idx === 0
                    ? 'Empezamos por quien reserva.'
                    : 'Los datos de cada persona que duerme aquí, también los niños.'}
            </p>

            <Caja className="mt-5">
                <Campo etiqueta="Nombre" id={`n${idx}`} error={pegas.nombre}>
                    <input id={`n${idx}`} className={cInput} type="text" autoComplete="given-name"
                        autoCapitalize="words" value={t.nombre}
                        onChange={(e) => cambiar(idx, 'nombre', e.target.value)} />
                </Campo>
                <Campo etiqueta="Primer apellido" id={`a1${idx}`} error={pegas.apellido_primero}>
                    <input id={`a1${idx}`} className={cInput} type="text" autoComplete="family-name"
                        autoCapitalize="words" value={t.apellido_primero}
                        onChange={(e) => cambiar(idx, 'apellido_primero', e.target.value)} />
                </Campo>
                <Campo etiqueta="Segundo apellido" ayuda="Si no tienes, déjalo en blanco."
                    id={`a2${idx}`} error={pegas.apellido_segundo}>
                    <input id={`a2${idx}`} className={cInput} type="text" autoCapitalize="words"
                        value={t.apellido_segundo}
                        onChange={(e) => cambiar(idx, 'apellido_segundo', e.target.value)} />
                </Campo>

                <Campo etiqueta="Sexo" error={pegas.sexo}>
                    <div className="flex gap-2">
                        {[['H', 'Hombre'], ['M', 'Mujer'], ['X', 'Prefiero no decirlo']].map(([v, l]) => (
                            <button key={v} type="button" onClick={() => cambiar(idx, 'sexo', v)}
                                aria-pressed={t.sexo === v}
                                className={`flex-1 min-h-[52px] px-2 rounded-2xl border-2 font-bold text-sm ${
                                    t.sexo === v
                                        ? 'bg-rural-600 border-rural-600 text-white'
                                        : 'bg-white border-gray-200 text-gray-700'
                                }`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </Campo>

                <Campo etiqueta="Fecha de nacimiento" id={`fn${idx}`} error={pegas.fecha_nacimiento}>
                    <input id={`fn${idx}`} className={cInput} type="date" max={hoyISO()}
                        autoComplete="bday" value={t.fecha_nacimiento}
                        onChange={(e) => cambiar(idx, 'fecha_nacimiento', e.target.value)} />
                </Campo>
            </Caja>

            <Caja className="mt-4">
                <Campo etiqueta="Tipo de documento" id={`td${idx}`}>
                    <select id={`td${idx}`} className={cInput} value={t.tipo_documento}
                        onChange={(e) => cambiar(idx, 'tipo_documento', e.target.value)}>
                        {DOC_TYPES.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                    </select>
                </Campo>
                <Campo etiqueta="Número del documento" id={`nd${idx}`} error={pegas.numero_documento}>
                    <input id={`nd${idx}`} className={`${cInput} font-mono tracking-wide`} type="text"
                        inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                        maxLength={20} value={t.numero_documento}
                        onChange={(e) => cambiar(idx, 'numero_documento', e.target.value.toUpperCase().replace(/\s/g, ''))} />
                </Campo>
                <Campo
                    etiqueta="Número de soporte"
                    ayuda="En el DNI español está detrás, arriba a la derecha, y empieza por letras. En el NIE, en el mismo sitio. Con otros documentos, déjalo en blanco."
                    id={`sd${idx}`}
                    error={pegas.soporte_documento}
                >
                    <input id={`sd${idx}`} className={`${cInput} font-mono tracking-wide`} type="text"
                        autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={20}
                        value={t.soporte_documento}
                        onChange={(e) => cambiar(idx, 'soporte_documento', e.target.value.toUpperCase().replace(/\s/g, ''))} />
                </Campo>
                <Campo etiqueta="Nacionalidad" id={`na${idx}`} error={pegas.nacionalidad}>
                    <SelectPais id={`na${idx}`} paises={paises} value={t.nacionalidad}
                        onChange={(v) => cambiar(idx, 'nacionalidad', v)} />
                </Campo>
            </Caja>

            <Caja className="mt-4">
                <p className="font-bold text-lg text-text-primary mb-3">Dónde vives habitualmente</p>
                <Campo etiqueta="Calle y número" id={`dv${idx}`} error={pegas.direccion_via}>
                    <input id={`dv${idx}`} className={cInput} type="text" autoComplete="street-address"
                        maxLength={200} value={t.direccion_via}
                        onChange={(e) => cambiar(idx, 'direccion_via', e.target.value)} />
                </Campo>
                <Campo etiqueta="Pueblo o ciudad" id={`dm${idx}`} error={pegas.direccion_municipio}>
                    <input id={`dm${idx}`} className={cInput} type="text" autoComplete="address-level2"
                        value={t.direccion_municipio}
                        onChange={(e) => cambiar(idx, 'direccion_municipio', e.target.value)} />
                </Campo>
                <Campo etiqueta="Código postal" id={`dc${idx}`}>
                    <input id={`dc${idx}`} className={cInput} type="text" inputMode="numeric"
                        autoComplete="postal-code" maxLength={10} value={t.direccion_cp}
                        onChange={(e) => cambiar(idx, 'direccion_cp', e.target.value)} />
                </Campo>
                <Campo etiqueta="País" id={`dp${idx}`} error={pegas.direccion_pais}>
                    <SelectPais id={`dp${idx}`} paises={paises} value={t.direccion_pais}
                        onChange={(v) => cambiar(idx, 'direccion_pais', v)} />
                </Campo>
            </Caja>

            {!esMenorDe14 && (
                <Caja className="mt-4">
                    <p className="font-bold text-lg text-text-primary mb-3">Cómo localizarte</p>
                    <Campo etiqueta="Teléfono móvil" id={`tm${idx}`} error={pegas.telefono_movil}>
                        <input id={`tm${idx}`} className={cInput} type="tel" inputMode="tel"
                            autoComplete="tel" value={t.telefono_movil}
                            onChange={(e) => cambiar(idx, 'telefono_movil', e.target.value)} />
                    </Campo>
                    <Campo etiqueta="Correo electrónico" id={`em${idx}`}>
                        <input id={`em${idx}`} className={cInput} type="email" inputMode="email"
                            autoComplete="email" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                            value={t.email}
                            onChange={(e) => cambiar(idx, 'email', e.target.value)} />
                    </Campo>
                </Caja>
            )}

            {esMenorDeEdad && idx > 0 && (
                <Caja className="mt-4">
                    <Campo
                        etiqueta="¿Qué eres tú de esta persona?"
                        ayuda="Al ser menor de edad, la ley nos pide la relación con quien lo acompaña."
                        id={`pa${idx}`}
                        error={pegas.parentesco}
                    >
                        <select id={`pa${idx}`} className={cInput} value={t.parentesco}
                            onChange={(e) => cambiar(idx, 'parentesco', e.target.value)}>
                            <option value="">Elige una opción…</option>
                            {PARENTESCOS.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                        </select>
                    </Campo>
                </Caja>
            )}

            {esMenorDe14 ? (
                <p className="mt-4 text-base text-gray-600 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    Al ser menor de 14 años no tiene que firmar: sus datos los das tú.
                </p>
            ) : (
                <Caja className="mt-4">
                    <Campo
                        etiqueta="Tu firma"
                        ayuda="Firma con el dedo dentro del recuadro. La ley pide la firma de todos los mayores de 14 años."
                        error={pegas.firma_base64}
                    >
                        <Firma valor={t.firma_base64} onChange={(v) => cambiar(idx, 'firma_base64', v)} />
                    </Campo>
                </Caja>
            )}
        </div>
    );
};

const Repaso = ({ travelers, fechaEntrada, maximo, onEditar, onAnadir, onQuitar, accept, setAccept, error }) => {
    const incompletos = travelers
        .map((t, i) => ({ i, pegas: pegasDe(t, fechaEntrada) }))
        .filter((x) => Object.keys(x.pegas).length > 0);

    return (
        <div>
            <h1 className="font-serif text-2xl font-bold text-text-primary">Un último repaso</h1>
            <p className="text-base text-gray-600 mt-1">
                Comprueba que están todas las personas que van a dormir aquí.
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
                                        {[t.nombre, t.apellido_primero, t.apellido_segundo].filter(Boolean).join(' ') || 'Sin nombre'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {i === 0 ? 'Quien reserva' : 'Acompañante'}
                                        {edad !== null ? ` · ${edad} años` : ''}
                                        {t.numero_documento ? ` · ${t.numero_documento}` : ''}
                                    </p>
                                    {mal && (
                                        <p className="text-sm font-semibold text-amber-800 mt-1 flex items-center gap-1.5">
                                            <AlertCircle size={15} aria-hidden="true" /> Le faltan cosas
                                        </p>
                                    )}
                                </div>
                                <button type="button" onClick={() => onEditar(i)}
                                    className="min-h-[44px] px-3 rounded-xl text-rural-700 bg-rural-50 font-bold text-sm inline-flex items-center gap-1.5">
                                    <Pencil size={15} aria-hidden="true" /> Cambiar
                                </button>
                                {i > 0 && (
                                    <button type="button" onClick={() => onQuitar(i)}
                                        aria-label={`Quitar a ${t.nombre || 'esta persona'}`}
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
                    <UserPlus size={19} aria-hidden="true" /> Añadir otra persona
                </button>
            )}
            {travelers.length >= maximo && (
                <p className="mt-4 text-sm text-gray-500">
                    Tu reserva es para {maximo} {maximo === 1 ? 'persona' : 'personas'}. Si vais a ser más,
                    escríbenos antes de llegar.
                </p>
            )}

            {incompletos.length > 0 && (
                <p className="mt-5 text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    Hay {incompletos.length} {incompletos.length === 1 ? 'persona' : 'personas'} a las que
                    les falta algo. Toca «Cambiar» para terminarlas.
                </p>
            )}

            <label className="mt-5 flex items-start gap-3 bg-white rounded-2xl border border-gray-200 p-4">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
                    className="mt-1 h-6 w-6 accent-rural-600 shrink-0" />
                <span className="text-base text-gray-700 leading-relaxed">
                    Los datos son ciertos y sé que el alojamiento tiene que comunicarlos a las autoridades,
                    como manda el Real Decreto 933/2021. He leído la{' '}
                    <Link to="/privacidad" target="_blank" className="underline text-rural-700 font-semibold">
                        política de privacidad
                    </Link>.
                </span>
            </label>

            {error && (
                <p className="mt-4 text-base text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    {error}
                </p>
            )}
        </div>
    );
};

const Terminado = ({ booking, cuantos }) => (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-rural-600 flex items-center justify-center text-white">
            <Check size={30} aria-hidden="true" />
        </div>
        <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">Listo, muchas gracias</h1>
        <p className="text-base text-gray-700 leading-relaxed">
            Tenemos los datos de {cuantos} {cuantos === 1 ? 'persona' : 'personas'} para la reserva{' '}
            <strong className="font-mono">{booking?.booking_code}</strong>. En la entrada sólo tienes que
            venir con el documento por si hay que comprobarlo.
        </p>
        <p className="text-sm text-gray-500 mt-4">
            Si te has equivocado en algo, vuelve a este mismo enlace y mándalo otra vez.
        </p>
        <Link to="/" className="inline-block mt-6 px-6 py-3.5 rounded-2xl font-bold text-white bg-rural-600">
            Volver al inicio
        </Link>
    </div>
);

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

const SelectPais = ({ id, paises, value, onChange }) => (
    <select id={id} className={cInput} value={value} onChange={(e) => onChange(e.target.value)}>
        <optgroup label="Los más habituales">
            {paises.frecuentes.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </optgroup>
        <optgroup label="Todos los países">
            {paises.resto.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </optgroup>
    </select>
);

// ---------------------------------------------------------------------------
// Firma con el dedo
// ---------------------------------------------------------------------------

const Firma = ({ valor, onChange }) => {
    const lienzo = useRef(null);
    const pintando = useRef(false);
    const [tieneTrazo, setTieneTrazo] = useState(!!valor);

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
                aria-label="Recuadro para firmar con el dedo"
                role="img"
            />
            <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                    {tieneTrazo ? 'Firma recogida' : 'Firma aquí con el dedo'}
                </span>
                <button type="button" onClick={borrar}
                    className="min-h-[44px] px-3 rounded-xl text-rural-700 bg-rural-50 font-bold text-sm inline-flex items-center gap-1.5">
                    <Eraser size={15} aria-hidden="true" /> Borrar
                </button>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------

function leerBorrador(code) {
    try {
        const crudo = localStorage.getItem(claveBorrador(code));
        return crudo ? JSON.parse(crudo) : null;
    } catch {
        return null;
    }
}

export default PrecheckinPage;
