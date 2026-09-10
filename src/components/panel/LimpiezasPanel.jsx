import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Brush, Check, Undo2, Camera, Plus, X, AlertTriangle, Image as ImagenIcono,
} from 'lucide-react';
import {
    Boton, Tarjeta, Campo, Chip, Aviso, Cargando, Vacio, claseInput,
    hoyISO, aISO, aFecha, fechaEnPalabrasRelativa,
    HORA_ENTRADA, HORA_SALIDA, ZONA,
} from './ui';

// ============================================================
// LimpiezasPanel — Limpiezas (secciones 2.3 y 4.6 del plan)
// ============================================================
// Quien lo usa: la madre de Jesus, casi siempre desde el movil y muchas
// veces de pie en la puerta de un apartamento.
//
// Lo que de verdad le urge saber es una sola cosa: DONDE hay que limpiar
// HOY, y si ademas entra alguien ese mismo dia (porque entonces hay que
// limpiar entre que uno se va y el otro llega). Eso va arriba y en grande.
//
// Reglas de esta pantalla:
//   - Lista vertical de arriba abajo. Nada de rejillas ni de semanas.
//   - Las atrasadas primero y en rojo: son las que se le han pasado.
//   - Un solo boton grande por tarjeta: "Marcar como hecha". Si se
//     equivoca, "No estaba hecha" lo deshace. Sin menus de estados.
//   - Los estados raros de la base ("en curso", "sin hacer", "problema")
//     no se le ensenan como botones: se respetan si ya vienen puestos
//     desde el panel completo, y se cuentan como pendientes.
//
// Quien sale y quien entra NO se leen de las columnas booking_out_id /
// booking_in_id: esas las rellena el disparador el dia que se confirma la
// reserva y no se enteran de lo que venga despues. Se calculan mirando las
// reservas de esos dias, que es la verdad de hoy.
// ============================================================

const DIAS_ADELANTE = 30;
const DIAS_ATRAS = 60;          // para no perder de vista una atrasada antigua
const DIAS_HECHAS = DIAS_ATRAS;  // el MISMO tramo que se puede ver atrasado.
// Si se ensenan atrasadas de hasta 60 dias pero las hechas solo de 30, una
// limpieza vieja que ella marque hecha DESAPARECE y ya no hay forma de
// deshacerlo desde el panel. Las dos ventanas van juntas o no van.
const ESTADOS_VIVOS = ['confirmed', 'pending', 'completed'];
const HECHAS = ['done', 'skipped'];

// Las fotos necesitan un sitio donde dejarlas y hoy NO existe: los cubos de
// Storage son `apartments`, `calendars`, `event-posters`, `internal-docs` e
// `invoices`, y todas sus políticas piden `check_is_admin()`, así que un
// perfil `staff` no puede subir nada a ninguno.
//
// El botón está escrito y funciona, pero se queda apagado hasta que exista
// el cubo. No se comprueba desde el navegador porque Storage NO deja
// distinguirlo: con un cubo que no existe, `list()` devuelve una lista
// vacía SIN error, y `getBucket()` y `createSignedUrl()` contestan "Bucket
// not found" / "Object not found" exactamente igual que con uno que sí
// existe. Una comprobación así mentiría, y un botón que falla al pulsarlo
// es peor que no tenerlo.
//
// Para encenderlo: aplicar `supabase/migrations/_pendiente_clientes.sql`
// (crea el cubo `limpiezas` y su política para `is_staff()`) y poner
// VITE_FOTOS_LIMPIEZA=true en el entorno.
const CUBO_FOTOS = 'limpiezas';
const FOTOS_ACTIVAS = import.meta.env.VITE_FOTOS_LIMPIEZA === 'true';

// Dias de CALENDARIO, no 24 h: el domingo del cambio de hora tiene 23 o 25
// horas y sumar milisegundos deja la ventana corrida un dia.
const sumaDias = (iso, dias) => {
    const f = aFecha(iso);
    return aISO(new Date(f.getFullYear(), f.getMonth(), f.getDate() + dias));
};

/** "hoy a las 13:11" · "el 8 de septiembre" */
const cuandoSeMarco = (cuando, hoy) => {
    const f = new Date(cuando);
    if (Number.isNaN(f.getTime())) return '';
    const dia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(f);
    const hora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' }).format(f);
    if (dia === hoy) return `hoy a las ${hora}`;
    return `el ${new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, day: 'numeric', month: 'long' }).format(f)}`;
};

// ============================================================

const LimpiezasPanel = () => {
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState('');
    const [tareas, setTareas] = useState([]);
    const [apartamentos, setApartamentos] = useState([]);
    const [reservas, setReservas] = useState([]);
    const [verHechas, setVerHechas] = useState(false);
    const [apuntando, setApuntando] = useState(false);
    const hoy = hoyISO();

    const cargar = useCallback(async () => {
        setCargando(true);
        setFallo('');
        const desde = sumaDias(hoy, -DIAS_ATRAS);
        const hasta = sumaDias(hoy, DIAS_ADELANTE);

        const [t, a, r] = await Promise.all([
            supabase.from('cleaning_tasks')
                .select('id, apartment_id, scheduled_date, status, notes, photos, assigned_to, completed_at')
                .gte('scheduled_date', desde).lte('scheduled_date', hasta)
                .order('scheduled_date', { ascending: true }),
            supabase.from('apartments').select('id, name').order('id'),
            supabase.from('guest_bookings')
                .select('id, apartment_id, guest_name, check_in, check_out, status, pax_count')
                .in('status', ESTADOS_VIVOS)
                .or(`and(check_in.gte.${desde},check_in.lte.${hasta}),and(check_out.gte.${desde},check_out.lte.${hasta})`),
        ]);

        if (t.error || a.error || r.error) {
            setFallo('No he podido cargar las limpiezas. Prueba a recargar la página.');
            setCargando(false);
            return;
        }

        setTareas(t.data || []);
        setApartamentos(a.data || []);
        setReservas(r.data || []);
        setCargando(false);
    }, [hoy]);

    useEffect(() => { cargar(); }, [cargar]);


    const nombreApto = useMemo(() => {
        const m = {};
        apartamentos.forEach((a) => { m[a.id] = a.name; });
        return m;
    }, [apartamentos]);

    /** A cada limpieza le pego quién se va y quién entra ese día en ese apartamento. */
    const conGente = useMemo(() => tareas.map((t) => ({
        ...t,
        apartamento: nombreApto[t.apartment_id] || 'Apartamento',
        sale: reservas.find((r) => r.apartment_id === t.apartment_id && r.check_out === t.scheduled_date) || null,
        entra: reservas.find((r) => r.apartment_id === t.apartment_id && r.check_in === t.scheduled_date) || null,
    })), [tareas, reservas, nombreApto]);

    const atrasadas = conGente
        .filter((t) => t.scheduled_date < hoy && !HECHAS.includes(t.status))
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    // De hoy en adelante van TODAS, también las que ya ha marcado hechas.
    // Si al marcarla desapareciera de la pantalla, un toque por error no
    // tendría vuelta atrás a la vista: el botón "No estaba hecha" tiene que
    // seguir donde ella lo dejó.
    const proximas = conGente.filter((t) => t.scheduled_date >= hoy);

    const hechas = conGente
        .filter((t) => t.scheduled_date < hoy && HECHAS.includes(t.status)
            && t.scheduled_date >= sumaDias(hoy, -DIAS_HECHAS))
        .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

    if (cargando) return <Cargando texto="Mirando qué toca limpiar…" />;

    return (
        <div className="space-y-7">
            {fallo && <Aviso tono="urgente" titulo={fallo} />}

            <p className="text-base text-gray-600 leading-relaxed">
                Aquí está lo que hay que limpiar, empezando por hoy. Cuando termines una, púlsala
                y queda hecha.
            </p>

            {/* ---------- Atrasadas ---------- */}
            {atrasadas.length > 0 && (
                <section aria-labelledby="atr-t" className="space-y-3">
                    <h2 id="atr-t" className="text-base font-bold text-red-700 flex items-center gap-2">
                        <AlertTriangle size={20} aria-hidden="true" />
                        {atrasadas.length === 1
                            ? 'Se te ha pasado una'
                            : `Se te han pasado ${atrasadas.length}`}
                    </h2>
                    {atrasadas.map((t) => (
                        <TarjetaLimpieza key={t.id} tarea={t} hoy={hoy} atrasada
                            onCambio={cargar} />
                    ))}
                </section>
            )}

            {/* ---------- Hoy y los próximos días ---------- */}
            <section aria-labelledby="pro-t" className="space-y-3">
                <h2 id="pro-t" className="text-base font-bold text-text-primary">
                    Hoy y los próximos días
                </h2>
                {proximas.length === 0 ? (
                    <Vacio icono={Brush} mensaje="No hay ninguna limpieza apuntada para hoy ni para los próximos días." />
                ) : (
                    proximas.map((t) => (
                        <TarjetaLimpieza key={t.id} tarea={t} hoy={hoy}
                            onCambio={cargar} />
                    ))
                )}
            </section>

            {/* ---------- Apuntar una limpieza suelta ---------- */}
            {apuntando ? (
                <NuevaLimpieza
                    apartamentos={apartamentos}
                    hoy={hoy}
                    onCancelar={() => setApuntando(false)}
                    onHecho={async () => { setApuntando(false); await cargar(); }}
                />
            ) : (
                <Boton variante="secundario" icono={Plus} ancho onClick={() => setApuntando(true)}>
                    Apuntar una limpieza que no es de una reserva
                </Boton>
            )}

            {/* ---------- Las ya hechas, si las quiere ver ---------- */}
            <section aria-labelledby="hec-t" className="space-y-3 pt-2">
                <button type="button" onClick={() => setVerHechas((v) => !v)}
                    className="min-h-[48px] text-base font-bold text-rural-700 underline">
                    {verHechas ? 'Ocultar las de días pasados' : 'Ver las que ya hiciste'}
                </button>
                {verHechas && (
                    <>
                        <h2 id="hec-t" className="sr-only">Limpiezas de días pasados que ya están hechas</h2>
                        {hechas.length === 0 ? (
                            <p className="text-base text-gray-600">No hay ninguna hecha en los últimos dos meses.</p>
                        ) : (
                            hechas.map((t) => (
                                <TarjetaLimpieza key={t.id} tarea={t} hoy={hoy}
                                    onCambio={cargar} />
                            ))
                        )}
                    </>
                )}
            </section>
        </div>
    );
};

// ============================================================
// Una limpieza
// ============================================================

const TarjetaLimpieza = ({ tarea, hoy, atrasada = false, onCambio }) => {
    const [guardando, setGuardando] = useState(false);
    const [abriendoNota, setAbriendoNota] = useState(false);
    const [nota, setNota] = useState(tarea.notes || '');
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState('');

    const hecha = tarea.status === 'done';
    const mismoDia = !!(tarea.sale && tarea.entra);
    const fotos = Array.isArray(tarea.photos) ? tarea.photos : [];

    const marcar = async (comoHecha) => {
        setGuardando(true);
        setError('');
        const cambio = comoHecha
            ? { status: 'done', completed_at: new Date().toISOString() }
            : { status: 'pending', completed_at: null };
        const { error: fallo } = await supabase.from('cleaning_tasks').update(cambio).eq('id', tarea.id);
        setGuardando(false);
        if (fallo) { setError('No he podido guardarlo. Inténtalo otra vez.'); return; }
        await onCambio();
    };

    const guardarNota = async () => {
        setGuardando(true);
        setError('');
        const { error: fallo } = await supabase.from('cleaning_tasks')
            .update({ notes: nota.trim() || null }).eq('id', tarea.id);
        setGuardando(false);
        if (fallo) { setError('No he podido guardar la nota. Inténtalo otra vez.'); return; }
        setAbriendoNota(false);
        await onCambio();
    };

    const subirFoto = async (evento) => {
        const fichero = evento.target.files && evento.target.files[0];
        evento.target.value = '';
        if (!fichero) return;
        setSubiendo(true);
        setError('');
        const extension = (fichero.name.split('.').pop() || 'jpg').toLowerCase();
        const ruta = `${tarea.id}/${Date.now()}.${extension}`;
        const { error: falloSubida } = await supabase.storage
            .from(CUBO_FOTOS).upload(ruta, fichero, { contentType: fichero.type || 'image/jpeg' });
        if (falloSubida) {
            setSubiendo(false);
            setError('No he podido guardar la foto. Apunta lo que pasa en la nota y díselo a Jesús.');
            return;
        }
        const { error: falloFila } = await supabase.from('cleaning_tasks')
            .update({ photos: [...fotos, { ruta, cuando: new Date().toISOString() }] })
            .eq('id', tarea.id);
        setSubiendo(false);
        if (falloFila) { setError('La foto se ha subido pero no he podido apuntarla. Díselo a Jesús.'); return; }
        await onCambio();
    };

    const borde = atrasada ? 'border-red-300 bg-red-50/40' : hecha ? 'border-rural-200' : 'border-gray-200';

    return (
        <div className={`bg-white rounded-3xl border-2 shadow-sm p-5 ${borde}`}>
            {/* Qué apartamento y qué día */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-serif text-2xl font-bold text-text-primary leading-tight">
                        {tarea.apartamento}
                    </p>
                    <p className={`text-base mt-0.5 ${atrasada ? 'font-bold text-red-700' : 'text-gray-600'}`}>
                        {fechaEnPalabrasRelativa(tarea.scheduled_date)}
                    </p>
                </div>
                <EstadoLimpieza tarea={tarea} atrasada={atrasada} />
            </div>

            {/* Quién sale y quién entra */}
            <div className="mt-4 space-y-1.5">
                {tarea.sale && (
                    <p className="text-base text-text-primary">
                        Se va <span className="font-bold">{tarea.sale.guest_name}</span> {HORA_SALIDA}.
                    </p>
                )}
                {tarea.entra && (
                    <p className="text-base text-text-primary">
                        Entra <span className="font-bold">{tarea.entra.guest_name}</span> {HORA_ENTRADA}
                        {tarea.entra.pax_count ? `, ${tarea.entra.pax_count} personas` : ''}.
                    </p>
                )}
                {!tarea.sale && !tarea.entra && (
                    <p className="text-base text-gray-600">
                        Esta limpieza no es de ninguna reserva: la apuntaste tú.
                    </p>
                )}
            </div>

            {/* El aviso que de verdad importa */}
            {mismoDia && (
                <div className="mt-4">
                    <Aviso
                        tono="atencion"
                        titulo={`${tarea.sale.guest_name} se va ${HORA_SALIDA} y ${tarea.entra.guest_name} entra ${HORA_ENTRADA}`}
                        texto="Hay que limpiar entre medias, el mismo día."
                    />
                </div>
            )}

            {/* Nota apuntada */}
            {tarea.notes && !abriendoNota && (
                <p className="mt-4 text-base text-text-primary bg-gray-50 rounded-2xl p-3 whitespace-pre-wrap break-words">
                    {tarea.notes}
                </p>
            )}

            {/* Fotos guardadas */}
            {fotos.length > 0 && (
                <p className="mt-3 text-sm text-gray-600 flex items-center gap-1.5">
                    <ImagenIcono size={16} aria-hidden="true" />
                    {fotos.length === 1 ? '1 foto guardada' : `${fotos.length} fotos guardadas`}
                </p>
            )}

            {error && <Aviso tono="urgente" titulo={error} className="mt-4" />}

            {/* El botón grande */}
            <div className="mt-5">
                {hecha ? (
                    <div className="space-y-3">
                        {tarea.completed_at && (
                            <p className="text-base text-rural-700 flex items-center gap-2">
                                <Check size={20} aria-hidden="true" />
                                La marcaste hecha {cuandoSeMarco(tarea.completed_at, hoy)}
                            </p>
                        )}
                        <Boton variante="secundario" icono={Undo2} ancho
                            onClick={() => marcar(false)} cargando={guardando}>
                            No estaba hecha
                        </Boton>
                    </div>
                ) : (
                    <Boton tamano="grande" icono={Check} ancho
                        onClick={() => marcar(true)} cargando={guardando}>
                        Marcar como hecha
                    </Boton>
                )}
            </div>

            {/* Apuntar algo y foto */}
            <div className="mt-3">
                {abriendoNota ? (
                    <div>
                        <label htmlFor={`nota-${tarea.id}`} className="block text-base font-bold text-text-primary mb-2">
                            Apunta lo que pase
                        </label>
                        <textarea id={`nota-${tarea.id}`} rows={3} value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            placeholder="Falta una toalla, se ha roto un vaso…"
                            className={`${claseInput} min-h-[96px] resize-y`} />
                        <div className="flex flex-col sm:flex-row gap-3 mt-3">
                            <Boton onClick={guardarNota} cargando={guardando} icono={Check} ancho>Guardar la nota</Boton>
                            <Boton variante="secundario" ancho
                                onClick={() => { setNota(tarea.notes || ''); setAbriendoNota(false); }}>
                                Dejarlo
                            </Boton>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setAbriendoNota(true)}
                            className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-2xl text-base font-bold text-rural-700 bg-rural-50 hover:bg-rural-100">
                            {tarea.notes ? 'Cambiar la nota' : 'Apuntar algo'}
                        </button>

                        {FOTOS_ACTIVAS && (
                            <label className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-2xl text-base font-bold text-rural-700 bg-rural-50 hover:bg-rural-100 cursor-pointer">
                                <Camera size={20} aria-hidden="true" />
                                {subiendo ? 'Guardando la foto…' : 'Hacer una foto'}
                                <input type="file" accept="image/*" capture="environment"
                                    onChange={subirFoto} disabled={subiendo} className="sr-only" />
                            </label>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const EstadoLimpieza = ({ tarea, atrasada }) => {
    if (tarea.status === 'done') return <Chip tono="verde" icono={Check}>Hecha</Chip>;
    if (tarea.status === 'skipped') return <Chip tono="neutro">Sin hacer</Chip>;
    if (tarea.status === 'issue') return <Chip tono="rojo" icono={AlertTriangle}>Hay un problema</Chip>;
    if (atrasada) return <Chip tono="rojo">Atrasada</Chip>;
    return <Chip tono="ambar">Pendiente</Chip>;
};

// ============================================================
// Apuntar una limpieza que no viene de una reserva
// ============================================================

const NuevaLimpieza = ({ apartamentos, hoy, onCancelar, onHecho }) => {
    const [apartamento, setApartamento] = useState(null);
    const [dia, setDia] = useState(hoy);
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const guardar = async () => {
        setError('');
        if (!apartamento) { setError('Elige primero qué apartamento hay que limpiar.'); return; }
        if (!dia) { setError('Pon qué día hay que limpiarlo.'); return; }
        setGuardando(true);
        const { error: fallo } = await supabase.from('cleaning_tasks').insert({
            apartment_id: apartamento,
            scheduled_date: dia,
            status: 'pending',
            notes: nota.trim() || null,
        });
        setGuardando(false);
        if (fallo) { setError('No he podido apuntarla. Inténtalo otra vez.'); return; }
        await onHecho();
    };

    return (
        <Tarjeta titulo="Apuntar una limpieza">
            <p className="text-sm text-gray-600 -mt-2 mb-4">
                Para cuando hay que limpiar sin que se vaya nadie: después de una obra, un repaso
                antes de temporada, lo que sea.
            </p>

            <Campo etiqueta="¿Qué apartamento?" obligatorio>
                <div className="flex flex-wrap gap-2">
                    {apartamentos.map((a) => (
                        <button key={a.id} type="button" onClick={() => setApartamento(a.id)}
                            aria-pressed={apartamento === a.id}
                            className={`min-h-[52px] px-5 rounded-2xl border-2 text-base font-bold transition-colors ${
                                apartamento === a.id
                                    ? 'bg-rural-600 border-rural-600 text-white'
                                    : 'bg-white border-gray-200 text-text-primary hover:border-rural-400'
                            }`}>
                            {a.name}
                        </button>
                    ))}
                </div>
            </Campo>

            <Campo etiqueta="¿Qué día?" htmlFor="nl-dia" obligatorio>
                <input id="nl-dia" type="date" value={dia} min={sumaDias(hoy, -365)}
                    onChange={(e) => setDia(e.target.value)} className={claseInput} />
            </Campo>

            <Campo etiqueta="¿Algo que apuntar?" htmlFor="nl-nota" ayuda="Puedes dejarlo en blanco.">
                <textarea id="nl-nota" rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
                    placeholder="Repaso después de la obra del baño" className={`${claseInput} min-h-[72px] resize-y`} />
            </Campo>

            {error && <Aviso tono="urgente" titulo={error} className="mb-4" />}

            <div className="flex flex-col sm:flex-row gap-3">
                <Boton onClick={guardar} cargando={guardando} icono={Check} ancho>Apuntarla</Boton>
                <Boton variante="secundario" onClick={onCancelar} disabled={guardando} icono={X} ancho>
                    Dejarlo
                </Boton>
            </div>
        </Tarjeta>
    );
};

export default LimpiezasPanel;
