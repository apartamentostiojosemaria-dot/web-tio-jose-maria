import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Search, Users, Phone, MessageCircle, Pencil, Trash2, ChevronRight,
    Mail, X, Check,
} from 'lucide-react';
import {
    Boton, Tarjeta, Campo, Chip, Aviso, Cargando, Vacio, claseInput, Confirmar,
    hoyISO, fechaCorta, fechaEnPalabras, canalSiImporta,
} from './ui';
import { sinAcentos, soloDigitos, correoReal, claveDeCliente } from './clienteClave';

// ============================================================
// ClientesPanel — Clientes (sección 4.5 bis del plan)
// ============================================================
// Quién lo usa: la madre de Jesús, en el móvil y en el ordenador.
// Para qué: encontrar a alguien que llama ("la señora que vino con perro"),
// llamarle de un toque, ver si ya ha estado aquí y apuntarle cosas.
//
// Lo que NO sale aquí a propósito (es nuestro, no suyo): etiquetas,
// permisos de correo, idioma, nacionalidad, ni si se dio de baja del
// boletín. Nada de eso cambia lo que ella hace con el cliente.
//
// Cómo se cuentan las cosas, una sola vez y en un solo sitio:
//   - "Ha venido N veces" = reservas confirmadas o terminadas que YA se
//     han ido (salida <= hoy). Una reserva futura no es una visita.
//   - "La última vez" = la salida más reciente de esas.
//   - Las que aún no han pasado se enseñan aparte, en su lista de reservas.
// La lista y la ficha usan la MISMA cuenta, calculada aquí abajo: así no
// puede haber dos cifras distintas para lo mismo.
// ============================================================

const NOMBRE_IDIOMA = { es: 'castellano', en: 'inglés', de: 'alemán', fr: 'francés' };

const TOPE_RESERVAS = 3000;   // de sobra: hoy hay 5 reservas en total
const ULTIMOS_EN_PORTADA = 8;
const ESTADOS_BUENOS = ['confirmed', 'completed'];

// ---------- Teléfonos ----------
// (comparar sin acentos y la clave del cliente viven en clienteClave.js:
// la ficha de la reserva tiene que llegar al mismo cliente)

/** Para el enlace de llamar. */
const paraLlamar = (t) => String(t || '').replace(/[^\d+]/g, '');

/** Para WhatsApp: solo dígitos, con el 34 delante si es un móvil español suelto. */
const paraWhatsapp = (t) => {
    let d = soloDigitos(t);
    if (!d) return '';
    if (d.length === 9) d = `34${d}`;
    return d;
};

/** Teléfono legible: +34 676 34 46 75 */
const telefonoBonito = (t) => {
    const d = soloDigitos(t);
    const espaciado = (n) => n.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4');
    if (d.length === 9) return espaciado(d);
    if (d.length === 11 && d.startsWith('34')) return `+34 ${espaciado(d.slice(2))}`;
    return String(t || '');
};

const mesYAno = (iso) => {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!a) return '';
    return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
        .format(new Date(a, m - 1, d));
};

// ---------- Buscar ----------

const coincide = (cliente, texto) => {
    const q = sinAcentos(texto);
    if (!q) return true;
    if (sinAcentos(cliente.nombre).includes(q)) return true;
    if (sinAcentos(cliente.email).includes(q)) return true;
    const digitos = soloDigitos(texto);
    if (digitos.length >= 3) {
        const suyos = soloDigitos(cliente.telefono);
        if (suyos && (suyos.includes(digitos) || digitos.endsWith(suyos))) return true;
    }
    return false;
};

// ---------- Juntar clientes y reservas en una sola lista ----------

/**
 * Cada cliente es SU FICHA (`customers`), y sus reservas son las que apuntan a
 * ella (`customer_id`, migración 0050): lo que se corrige en la ficha llega a
 * todas. Una reserva sin ficha (no debería quedar ninguna) se agrupa como
 * antes: por correo, si no por teléfono, si no por nombre.
 */
const construirClientes = ({ fichas, reservas, apartamentos, hoy }) => {
    const nombreApto = {};
    (apartamentos || []).forEach((a) => { nombreApto[a.id] = a.name; });

    const grupos = new Map();
    const dame = (clave) => {
        if (!grupos.has(clave)) {
            grupos.set(clave, {
                clave, id: null, email: '', emailFicha: '', idioma: '', nombre: '', telefono: '',
                reservas: [], veces: 0, ultima: null, ultimoMovimiento: '',
            });
        }
        return grupos.get(clave);
    };

    // 1) Las fichas guardadas mandan sobre lo que pusiera la reserva.
    (fichas || []).forEach((f) => {
        if (!f.id) return;
        const g = dame(`id:${f.id}`);
        g.id = f.id;
        g.email = correoReal(f.email);      // el que se enseña (sin rellenos)
        g.emailFicha = f.email || '';        // la clave de la ficha (apuntes)
        g.idioma = f.preferred_language || '';
        if (f.canonical_name) g.nombre = f.canonical_name;
        if (f.phone) g.telefono = f.phone;
    });

    // 2) Las reservas: rellenan lo que falte y aportan el historial.
    (reservas || []).forEach((r) => {
        const email = correoReal(r.guest_email);
        const clave = r.customer_id ? `id:${r.customer_id}` : claveDeCliente(r);
        if (clave === 'nombre:') return;
        const g = dame(clave);
        if (email && !g.email) g.email = email;
        if (!g.nombre && r.guest_name) g.nombre = r.guest_name;
        if (!g.telefono && r.guest_phone) g.telefono = r.guest_phone;
        g.reservas.push({ ...r, apartamento: nombreApto[r.apartment_id] || 'Apartamento' });
    });

    const lista = [...grupos.values()].map((g) => {
        g.reservas.sort((a, b) => String(b.check_in).localeCompare(String(a.check_in)));
        const pasadas = g.reservas.filter(
            (r) => ESTADOS_BUENOS.includes(r.status) && String(r.check_out) <= hoy
        );
        g.veces = pasadas.length;
        g.ultima = pasadas.length ? pasadas[0].check_out : null;
        // La próxima vez que viene (o que está dentro ahora).
        const futuras = g.reservas
            .filter((r) => ESTADOS_BUENOS.includes(r.status) && String(r.check_out) > hoy)
            .sort((a, b) => String(a.check_in).localeCompare(String(b.check_in)));
        g.proxima = futuras.length ? futuras[0].check_in : null;
        g.ultimoMovimiento = g.reservas.length ? g.reservas[0].check_in : '';
        if (!g.nombre) g.nombre = g.email || 'Sin nombre';
        return g;
    });

    // Primero los que vienen pronto (el más cercano arriba) y después los que
    // estuvieron hace menos. Antes mandaba la fecha más lejana: la primera de
    // «Los últimos clientes» era una reserva de agosto de 2027 (23-sep).
    lista.sort((a, b) => {
        if (a.proxima && b.proxima) return String(a.proxima).localeCompare(String(b.proxima));
        if (a.proxima) return -1;
        if (b.proxima) return 1;
        return String(b.ultima || b.ultimoMovimiento).localeCompare(String(a.ultima || a.ultimoMovimiento));
    });
    return lista;
};

// ============================================================
// Pantalla
// ============================================================

const ClientesPanel = ({ ir, perfil, params = {} }) => {
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState('');
    const [clientes, setClientes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    // Clave del cliente abierto. Desde la ficha de una reserva se llega ya abierto.
    const [abierto, setAbierto] = useState(params.clienteId ? `id:${params.clienteId}` : (params.clave || null));
    const hoy = hoyISO();

    const cargar = useCallback(async () => {
        setCargando(true);
        setFallo('');
        const [fichas, reservas, apartamentos] = await Promise.all([
            supabase.from('customers').select('id, email, canonical_name, phone, preferred_language'),
            supabase.from('guest_bookings')
                .select('id, customer_id, guest_name, guest_email, guest_phone, apartment_id, check_in, check_out, status, total_price, channel, source, pax_count')
                .order('check_in', { ascending: false })
                .limit(TOPE_RESERVAS),
            supabase.from('apartments').select('id, name'),
        ]);

        if (fichas.error || reservas.error || apartamentos.error) {
            setFallo('No he podido cargar los clientes. Prueba a recargar la página.');
            setCargando(false);
            return;
        }

        setClientes(construirClientes({
            fichas: fichas.data, reservas: reservas.data,
            apartamentos: apartamentos.data, hoy,
        }));
        setCargando(false);
    }, [hoy]);

    useEffect(() => { cargar(); }, [cargar]);

    const encontrados = useMemo(
        () => clientes.filter((c) => coincide(c, busqueda)),
        [clientes, busqueda]
    );

    const cliente = abierto ? clientes.find((c) => c.clave === abierto) : null;

    if (cargando) return <Cargando texto="Buscando a tus clientes…" />;

    if (cliente) {
        return (
            <FichaCliente
                cliente={cliente}
                perfil={perfil}
                ir={ir}
                onCerrar={() => setAbierto(null)}
                onGuardado={cargar}
            />
        );
    }

    const buscando = busqueda.trim().length > 0;
    const aEnsenar = buscando ? encontrados : encontrados.slice(0, ULTIMOS_EN_PORTADA);

    return (
        <div className="space-y-6">
            {fallo && <Aviso tono="urgente" titulo={fallo} />}

            {/* ---------- Buscador ---------- */}
            <div>
                <label htmlFor="buscar-cliente" className="block text-base font-bold text-text-primary mb-2">
                    Busca a un cliente
                </label>
                <div className="relative">
                    <Search size={22} aria-hidden="true"
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        id="buscar-cliente"
                        type="search"
                        inputMode="search"
                        autoComplete="off"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Nombre o teléfono"
                        className={`${claseInput} pl-12 pr-14 min-h-[60px] text-lg`}
                    />
                    {buscando && (
                        <button type="button" onClick={() => setBusqueda('')} aria-label="Borrar la búsqueda"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100">
                            <X size={20} aria-hidden="true" />
                        </button>
                    )}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                    Da igual con acentos o sin ellos, y el teléfono con prefijo o sin él.
                </p>
            </div>

            {/* ---------- Resultados ---------- */}
            <section aria-labelledby="lista-t" className="space-y-3">
                <h2 id="lista-t" className="text-base font-bold text-text-primary">
                    {buscando
                        ? `${encontrados.length} ${encontrados.length === 1 ? 'cliente' : 'clientes'}`
                        : 'Los que vienen pronto y los de hace poco'}
                </h2>

                {aEnsenar.length === 0 ? (
                    <Vacio
                        icono={Users}
                        mensaje={buscando
                            ? 'No he encontrado a nadie con eso. Prueba con menos letras, o solo con los últimos números del teléfono.'
                            : 'Todavía no hay clientes. En cuanto apuntes una reserva, aquí aparece quién es.'}
                    />
                ) : (
                    aEnsenar.map((c) => (
                        <LineaCliente key={c.clave} cliente={c} onAbrir={() => setAbierto(c.clave)} />
                    ))
                )}

                {!buscando && encontrados.length > ULTIMOS_EN_PORTADA && (
                    <p className="text-sm text-gray-600 pt-1">
                        Hay {encontrados.length} clientes en total. Escribe arriba para encontrar a cualquiera.
                    </p>
                )}
            </section>
        </div>
    );
};

// ---------- Una línea de la lista ----------

const diaYMes = (iso) => {
    const [a, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
    if (!a) return '';
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', ...(a !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
        .format(new Date(a, m - 1, d));
};

const resumenVisitas = (c) => {
    // Lo que sirve primero: cuándo viene. Luego, si ya estuvo.
    const viene = c.proxima ? `Viene el ${diaYMes(c.proxima)}` : '';
    let estuvo = '';
    if (c.veces === 1) estuvo = `estuvo en ${mesYAno(c.ultima)}`;
    else if (c.veces > 1) estuvo = `ha venido ${c.veces} veces, la última en ${mesYAno(c.ultima)}`;
    if (viene && estuvo) return `${viene} · ${estuvo}`;
    if (viene) return `${viene} · es la primera vez`;
    if (estuvo) return estuvo.charAt(0).toUpperCase() + estuvo.slice(1);
    return 'Todavía no ha venido';
};

const LineaCliente = ({ cliente, onAbrir }) => (
    <Tarjeta onClick={onAbrir} aria-label={`Abrir la ficha de ${cliente.nombre}`}>
        <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-text-primary leading-tight break-words">{cliente.nombre}</p>
                {cliente.telefono && (
                    <p className="text-base text-gray-600 tabular-nums mt-0.5">{telefonoBonito(cliente.telefono)}</p>
                )}
                <p className="text-sm text-gray-600 mt-1">{resumenVisitas(cliente)}</p>
            </div>
            <ChevronRight size={24} aria-hidden="true" className="text-gray-400 shrink-0" />
        </div>
    </Tarjeta>
);

// ============================================================
// Ficha del cliente
// ============================================================

const FichaCliente = ({ cliente, perfil, ir, onCerrar, onGuardado }) => {
    const [apuntes, setApuntes] = useState([]);
    const [cargandoApuntes, setCargandoApuntes] = useState(true);
    const [editando, setEditando] = useState(false);
    const hoy = hoyISO();

    const cargarApuntes = useCallback(async () => {
        const clave = cliente.emailFicha || cliente.email;
        if (!clave) { setApuntes([]); setCargandoApuntes(false); return; }
        setCargandoApuntes(true);
        const { data } = await supabase
            .from('customer_notes')
            .select('id, body, created_at, author')
            .eq('customer_email', clave)
            .order('created_at', { ascending: false });
        setApuntes(data || []);
        setCargandoApuntes(false);
    }, [cliente.emailFicha, cliente.email]);

    useEffect(() => { cargarApuntes(); }, [cargarApuntes]);

    const tel = cliente.telefono;

    return (
        <div className="space-y-6">
            <button type="button" onClick={onCerrar}
                className="inline-flex items-center gap-1 min-h-[44px] text-base font-bold text-rural-700 hover:underline">
                <ChevronRight size={20} aria-hidden="true" className="rotate-180" />
                Volver a la lista
            </button>

            {/* ---------- Quién es ---------- */}
            <section>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary leading-tight break-words">
                    {cliente.nombre}
                </h2>
                <p className="text-base text-gray-600 mt-1">{resumenVisitas(cliente)}.</p>
                {cliente.idioma && cliente.idioma !== 'es' && (
                    <div className="mt-2">
                        <Chip tono="azul">Habla {NOMBRE_IDIOMA[cliente.idioma] || cliente.idioma} · le escribimos en su idioma</Chip>
                    </div>
                )}
            </section>

            {/* ---------- Llamar / WhatsApp ---------- */}
            {tel ? (
                <Tarjeta>
                    <p className="text-xl font-bold text-text-primary tabular-nums">{telefonoBonito(tel)}</p>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <a href={`tel:${paraLlamar(tel)}`}
                            className="inline-flex items-center justify-center gap-2 min-h-[56px] rounded-2xl font-bold text-base bg-rural-600 text-white hover:bg-rural-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30">
                            <Phone size={20} aria-hidden="true" /> Llamar
                        </a>
                        <a href={`https://wa.me/${paraWhatsapp(tel)}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 min-h-[56px] rounded-2xl font-bold text-base bg-white text-rural-700 border-2 border-rural-200 hover:bg-rural-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rural-600/30">
                            <MessageCircle size={20} aria-hidden="true" /> WhatsApp
                        </a>
                    </div>
                    {cliente.email && (
                        <p className="text-base text-gray-600 mt-2 flex items-start gap-2 break-all">
                            <Mail size={18} aria-hidden="true" className="mt-3.5 shrink-0 text-gray-400" />
                            <a href={`mailto:${cliente.email}`} className="underline hover:text-rural-700 inline-block py-3">
                                {cliente.email}
                            </a>
                        </p>
                    )}
                </Tarjeta>
            ) : (
                <Tarjeta>
                    <p className="text-base text-gray-600">Este cliente no tiene teléfono apuntado.</p>
                    {cliente.email && (
                        <p className="text-base text-gray-600 break-all">
                            <a href={`mailto:${cliente.email}`} className="underline hover:text-rural-700 inline-block py-3">
                                {cliente.email}
                            </a>
                        </p>
                    )}
                </Tarjeta>
            )}

            {/* ---------- Corregir nombre y teléfono ---------- */}
            {editando ? (
                <FormularioCorregir
                    cliente={cliente}
                    onCancelar={() => setEditando(false)}
                    onHecho={async () => { setEditando(false); await onGuardado(); }}
                />
            ) : (
                <Boton variante="secundario" icono={Pencil} ancho onClick={() => setEditando(true)}>
                    Corregir sus datos
                </Boton>
            )}

            {/* ---------- Apuntes ---------- */}
            <Apuntes
                cliente={cliente}
                perfil={perfil}
                apuntes={apuntes}
                cargando={cargandoApuntes}
                onCambio={cargarApuntes}
            />

            {/* ---------- Sus reservas ---------- */}
            <section aria-labelledby="res-t" className="space-y-3">
                <h3 id="res-t" className="text-base font-bold text-text-primary">Sus reservas</h3>
                {cliente.reservas.length === 0 ? (
                    <Vacio mensaje="Todavía no tiene ninguna reserva." />
                ) : (
                    cliente.reservas.map((r) => (
                        <Tarjeta key={r.id} onClick={() => ir('reserva', { reservaId: r.id })}
                            aria-label={`Abrir la reserva de ${r.apartamento} del ${fechaEnPalabras(r.check_in)}`}>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-base text-text-primary">
                                        {r.apartamento} · {fechaCorta(r.check_in)} – {fechaCorta(r.check_out)}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <EstadoReserva reserva={r} hoy={hoy} />
                                        {canalSiImporta(r) && <Chip tono="azul">{canalSiImporta(r)}</Chip>}
                                    </div>
                                </div>
                                <ChevronRight size={24} aria-hidden="true" className="text-gray-400 shrink-0" />
                            </div>
                        </Tarjeta>
                    ))
                )}
            </section>
        </div>
    );
};

const EstadoReserva = ({ reserva, hoy }) => {
    if (reserva.status === 'cancelled') return <Chip tono="rojo">Anulada</Chip>;
    if (reserva.status === 'no_show') return <Chip tono="rojo">No se presentaron</Chip>;
    if (String(reserva.check_out) <= hoy) return <Chip tono="neutro">Ya estuvo</Chip>;
    if (String(reserva.check_in) <= hoy) return <Chip tono="verde">Está aquí ahora</Chip>;
    return <Chip tono="verde">Viene el {fechaCorta(reserva.check_in)}</Chip>;
};

// ---------- Corregir nombre y teléfono ----------

const FormularioCorregir = ({ cliente, onCancelar, onHecho }) => {
    const [nombre, setNombre] = useState(cliente.nombre === cliente.email ? '' : cliente.nombre);
    const [telefono, setTelefono] = useState(cliente.telefono || '');
    const [correo, setCorreo] = useState(cliente.email || '');
    const [idioma, setIdioma] = useState(cliente.idioma || 'es');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    // Todo va a la FICHA y la base lo copia a todas sus reservas (0050). Ya
    // no hace falta correo para guardar: sin él, la ficha lleva uno de
    // relleno propio que no se enseña.
    const guardar = async () => {
        setError('');
        if (!nombre.trim()) { setError('Ponle un nombre, aunque sea solo el de pila.'); return; }
        const email = String(correo || '').trim().toLowerCase();
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            setError('Ese correo no está bien escrito. Míralo otra vez o déjalo vacío.');
            return;
        }
        if (!cliente.id) {
            setError('Este cliente todavía no tiene ficha. Recarga la página y vuelve a probar.');
            return;
        }
        setGuardando(true);
        const { error: fallo } = await supabase.rpc('tjm_guardar_cliente', {
            p_id: cliente.id,
            p_nombre: nombre.trim(),
            p_telefono: telefono.trim() || null,
            p_correo: email || null,
            // Solo si lo ha cambiado ella: si no, se sigue deduciendo del teléfono.
            p_idioma: idioma !== (cliente.idioma || 'es') ? idioma : null,
        });
        setGuardando(false);
        if (fallo) {
            setError('No he podido guardarlo. Inténtalo otra vez dentro de un momento.');
            return;
        }
        await onHecho();
    };

    return (
        <Tarjeta titulo="Corregir sus datos">
            <p className="text-sm text-gray-600 -mt-1 mb-4">
                Lo que cambies aquí se cambia también en todas sus reservas.
            </p>
            <Campo etiqueta="Cómo se llama" htmlFor="c-nombre" obligatorio>
                <input id="c-nombre" type="text" value={nombre} autoComplete="name"
                    onChange={(e) => setNombre(e.target.value)} className={claseInput} />
            </Campo>

            <Campo etiqueta="Teléfono" htmlFor="c-tel"
                ayuda="Como te lo dicte: con prefijo o sin él, con espacios o sin ellos.">
                <input id="c-tel" type="tel" inputMode="tel" value={telefono} autoComplete="tel"
                    onChange={(e) => setTelefono(e.target.value)} className={claseInput} />
            </Campo>

            <Campo etiqueta="Correo" htmlFor="c-mail"
                ayuda="Si no lo tienes, déjalo vacío. Con correo le llegan la confirmación y el enlace para sus datos.">
                <input id="c-mail" type="email" inputMode="email" value={correo} autoComplete="email"
                    onChange={(e) => setCorreo(e.target.value)} className={claseInput} />
            </Campo>

            <div className="mb-5">
                <p className="block text-base font-bold text-text-primary mb-2">En qué idioma le escribimos</p>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(NOMBRE_IDIOMA).map(([clave, nombreIdioma]) => (
                        <Chip key={clave} tono={idioma === clave ? 'verde' : 'neutro'}
                            onClick={() => setIdioma(clave)} aria-pressed={idioma === clave}
                            className={idioma === clave ? 'ring-2 ring-rural-600' : undefined}>
                            {idioma === clave ? '✓ ' : ''}{nombreIdioma.charAt(0).toUpperCase() + nombreIdioma.slice(1)}
                        </Chip>
                    ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">Sale solo por el prefijo de su teléfono; cámbialo si no acierta.</p>
            </div>

            {error && <Aviso tono="urgente" titulo={error} className="mb-4" />}

            <div className="flex flex-col sm:flex-row gap-3">
                <Boton onClick={guardar} cargando={guardando} icono={Check} ancho>Guardar</Boton>
                <Boton variante="secundario" onClick={onCancelar} disabled={guardando} ancho>Dejarlo como está</Boton>
            </div>
        </Tarjeta>
    );
};

// ---------- Apuntes ----------

const Apuntes = ({ cliente, perfil, apuntes, cargando, onCambio }) => {
    const [nuevo, setNuevo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [textoEditado, setTextoEditado] = useState('');
    const [aBorrar, setABorrar] = useState(null);   // el apunte que se va a borrar
    const [borrando, setBorrando] = useState(false);
    const [error, setError] = useState('');

    const quien = perfil?.full_name || perfil?.email || 'panel';

    // Los apuntes cuelgan de la ficha (su correo, aunque sea de relleno):
    // ya no hace falta que el cliente tenga correo de verdad.
    const claveFicha = cliente.emailFicha || cliente.email;
    if (!claveFicha) {
        return (
            <Tarjeta titulo="Apuntes">
                <p className="text-base text-gray-600">
                    Este cliente todavía no tiene ficha. Recarga la página y vuelve a probar.
                </p>
            </Tarjeta>
        );
    }

    const anadir = async () => {
        if (!nuevo.trim()) return;
        setGuardando(true);
        setError('');
        const { error: fallo } = await supabase.from('customer_notes').insert({
            customer_email: claveFicha,
            author: quien,
            body: nuevo.trim(),
        });
        setGuardando(false);
        if (fallo) { setError('No he podido guardar el apunte. Inténtalo otra vez.'); return; }
        setNuevo('');
        await onCambio();
    };

    const guardarEdicion = async (id) => {
        if (!textoEditado.trim()) return;
        setGuardando(true);
        setError('');
        const { error: fallo } = await supabase.from('customer_notes')
            .update({ body: textoEditado.trim() }).eq('id', id);
        setGuardando(false);
        if (fallo) { setError('No he podido cambiar el apunte. Inténtalo otra vez.'); return; }
        setEditandoId(null);
        await onCambio();
    };

    const borrar = async () => {
        if (!aBorrar) return;
        setBorrando(true);
        await supabase.from('customer_notes').delete().eq('id', aBorrar.id);
        setBorrando(false);
        setABorrar(null);
        await onCambio();
    };

    return (
        <Tarjeta titulo="Apuntes">
            <p className="text-sm text-gray-600 -mt-2 mb-4">
                Lo que quieras recordar de esta persona: «alérgica al polen», «vino con perro»,
                «prefiere planta baja».
            </p>

            <label htmlFor="apunte-nuevo" className="sr-only">Escribir un apunte</label>
            <textarea
                id="apunte-nuevo"
                rows={3}
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                placeholder="Escribe aquí lo que quieras recordar"
                className={`${claseInput} min-h-[96px] resize-y`}
            />
            <div className="mt-3">
                <Boton onClick={anadir} disabled={!nuevo.trim()} cargando={guardando} ancho>
                    Guardar el apunte
                </Boton>
            </div>

            {error && <Aviso tono="urgente" titulo={error} className="mt-4" />}

            <div className="mt-5 space-y-3">
                {cargando && <p className="text-base text-gray-600">Un momento…</p>}
                {!cargando && apuntes.length === 0 && (
                    <p className="text-base text-gray-600">Todavía no le has apuntado nada.</p>
                )}
                {apuntes.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-gray-200 p-4">
                        {editandoId === a.id ? (
                            <>
                                <label htmlFor={`ap-${a.id}`} className="sr-only">Cambiar el apunte</label>
                                <textarea id={`ap-${a.id}`} rows={3} value={textoEditado}
                                    onChange={(e) => setTextoEditado(e.target.value)}
                                    className={`${claseInput} min-h-[96px] resize-y`} />
                                <div className="flex flex-col sm:flex-row gap-3 mt-3">
                                    <Boton onClick={() => guardarEdicion(a.id)} cargando={guardando} icono={Check} ancho>
                                        Guardar
                                    </Boton>
                                    <Boton variante="secundario" onClick={() => setEditandoId(null)} ancho>
                                        Dejarlo como estaba
                                    </Boton>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-base text-text-primary whitespace-pre-wrap break-words">{a.body}</p>
                                <p className="text-sm text-gray-500 mt-2">
                                    {a.created_at ? fechaEnPalabras(String(a.created_at).slice(0, 10)) : ''}
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <button type="button"
                                        onClick={() => { setEditandoId(a.id); setTextoEditado(a.body); }}
                                        className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-base font-bold text-rural-700 hover:bg-rural-50">
                                        <Pencil size={18} aria-hidden="true" /> Cambiarlo
                                    </button>
                                    <button type="button" onClick={() => setABorrar(a)}
                                        className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-base font-bold text-red-700 hover:bg-red-50">
                                        <Trash2 size={18} aria-hidden="true" /> Borrarlo
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <Confirmar
                abierta={!!aBorrar}
                titulo="¿Borro este apunte?"
                texto={aBorrar
                    ? `«${String(aBorrar.body || '').slice(0, 120)}${String(aBorrar.body || '').length > 120 ? '…' : ''}». No se puede deshacer.`
                    : ''}
                textoSi="Sí, borrarlo"
                textoNo="No, dejarlo"
                cargando={borrando}
                onSi={borrar}
                onNo={() => setABorrar(null)}
            />
        </Tarjeta>
    );
};

export default ClientesPanel;
