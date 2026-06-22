import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, UserPlus, Trash2, Check, Shield } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';

// /precheckin?code=TJM-XXXXXX
// ============================
// Formulario público del registro documental de viajeros (RD 933/2021).
// Cubre los 18 campos obligatorios por viajero adulto. Disponible desde 7
// días antes del check-in. Los datos se guardan en traveler_records con
// RLS estricto y se envían al MIR vía edge function (Sprint 7c).

const COUNTRIES = [
    { code: 'ESP', name: 'España' },
    { code: 'PRT', name: 'Portugal' },
    { code: 'FRA', name: 'Francia' },
    { code: 'DEU', name: 'Alemania' },
    { code: 'ITA', name: 'Italia' },
    { code: 'GBR', name: 'Reino Unido' },
    { code: 'NLD', name: 'Países Bajos' },
    { code: 'BEL', name: 'Bélgica' },
    { code: 'IRL', name: 'Irlanda' },
    { code: 'USA', name: 'Estados Unidos' },
    { code: 'CAN', name: 'Canadá' },
    { code: 'MEX', name: 'México' },
    { code: 'ARG', name: 'Argentina' },
    { code: 'BRA', name: 'Brasil' },
    { code: 'CHL', name: 'Chile' },
    { code: 'COL', name: 'Colombia' },
    { code: 'PER', name: 'Perú' },
    { code: 'OTH', name: 'Otro (introduce código ISO-3)' },
];

const DOC_TYPES = [
    { code: 'D', name: 'DNI' },
    { code: 'P', name: 'Pasaporte' },
    { code: 'N', name: 'NIE' },
    { code: 'C', name: 'Permiso de conducir UE' },
    { code: 'E', name: 'Cédula de identidad UE' },
    { code: 'X', name: 'Otro documento oficial' },
];

const emptyTraveler = (isTitular = false) => ({
    is_titular: isTitular,
    apellido_primero: '',
    apellido_segundo: '',
    nombre: '',
    sexo: 'H',
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
});

const PrecheckinPage = () => {
    const [params] = useSearchParams();
    const code = (params.get('code') || '').toUpperCase();
    const [booking, setBooking] = useState(null);
    const [loadingBooking, setLoadingBooking] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [travelers, setTravelers] = useState([emptyTraveler(true)]);
    const [accept, setAccept] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!code || !/^TJM-[A-Z0-9]{6}$/.test(code)) {
            setLoadError('El enlace no es válido. Revisa el email de confirmación o escríbenos.');
            setLoadingBooking(false);
            return;
        }
        (async () => {
            const { data, error } = await supabase
                .from('guest_bookings')
                .select('booking_code, guest_name, guest_email, pax_count, check_in, check_out, status, apartments(name)')
                .eq('booking_code', code)
                .maybeSingle();
            if (error || !data) {
                setLoadError('No encontramos esa reserva. Revisa el enlace o escríbenos.');
            } else if (!['confirmed', 'completed'].includes(data.status)) {
                setLoadError('Esta reserva todavía no está confirmada. Completa el pago primero.');
            } else if (data.check_in && new Date(data.check_in) - new Date() > 7 * 86400000) {
                setLoadError('El precheckin se abre desde 7 días antes de la entrada. Te avisaremos por email.');
            } else {
                setBooking(data);
                // Pre-rellenar nombre del titular
                const parts = (data.guest_name || '').trim().split(/\s+/);
                setTravelers([{
                    ...emptyTraveler(true),
                    nombre: parts[0] || '',
                    apellido_primero: parts[1] || '',
                    apellido_segundo: parts.slice(2).join(' ') || '',
                    email: data.guest_email || '',
                }]);
            }
            setLoadingBooking(false);
        })();
    }, [code]);

    const updateTraveler = (idx, field, value) => {
        setTravelers(travelers.map((t, i) => i === idx ? { ...t, [field]: value } : t));
    };
    const addTraveler = () => {
        if (travelers.length >= (booking?.pax_count || 8)) return;
        setTravelers([...travelers, emptyTraveler(false)]);
    };
    const removeTraveler = (idx) => {
        if (idx === 0) return;
        setTravelers(travelers.filter((_, i) => i !== idx));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!accept) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const { error } = await supabase.rpc('submit_traveler_records', {
                p_booking_code: code,
                p_travelers: travelers,
            });
            if (error) throw error;
            setDone(true);
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('precheckin_too_early')) setSubmitError('Aún es pronto para el precheckin. Te lo abriremos 7 días antes de la entrada.');
            else if (msg.includes('booking_status_invalid')) setSubmitError('La reserva no está confirmada todavía.');
            else if (msg.includes('booking_already_past')) setSubmitError('Esa reserva ya ha finalizado.');
            else setSubmitError(msg || 'No hemos podido guardar el precheckin. Vuelve a intentarlo o escríbenos.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <PageHead
                title="Precheckin — Apartamentos Tío José María"
                description="Registro documental de viajeros (RD 933/2021). Datos obligatorios para el alojamiento."
                path="/precheckin"
                noindex
            />

            <nav className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                        <ChevronLeft size={20} aria-hidden="true" /> Volver
                    </Link>
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-600">
                        <Shield size={14} aria-hidden="true" className="text-rural-700" />
                        Datos protegidos · RD 933/2021
                    </span>
                </div>
            </nav>

            <main className="pt-24 pb-16 px-4 md:px-6">
                <div className="max-w-3xl mx-auto">
                    {loadingBooking ? (
                        <p className="text-center text-gray-500 font-serif italic py-20">Cargando tu reserva…</p>
                    ) : loadError ? (
                        <div className="rounded-3xl bg-white border border-gray-100 shadow-xl p-8 text-center">
                            <h1 className="font-serif text-2xl font-bold text-text-primary mb-3">No podemos abrir el precheckin</h1>
                            <p className="text-gray-600">{loadError}</p>
                        </div>
                    ) : done ? (
                        <DoneScreen booking={booking} count={travelers.length} />
                    ) : (
                        <Form
                            booking={booking}
                            travelers={travelers}
                            updateTraveler={updateTraveler}
                            addTraveler={addTraveler}
                            removeTraveler={removeTraveler}
                            accept={accept} setAccept={setAccept}
                            submitting={submitting} submitError={submitError}
                            onSubmit={onSubmit}
                        />
                    )}
                </div>
            </main>
        </div>
    );
};

const Form = ({ booking, travelers, updateTraveler, addTraveler, removeTraveler, accept, setAccept, submitting, submitError, onSubmit }) => (
    <form onSubmit={onSubmit}>
        <header className="mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-text-primary mb-2">Precheckin</h1>
            <p className="text-gray-600 leading-relaxed">
                Para cumplir la normativa española (RD 933/2021), necesitamos los datos de cada huésped adulto.
                Una vez completes este formulario, en la entrada solo nos saludamos y a disfrutar.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-rural-50 border border-rural-100 text-rural-700 font-medium">
                Reserva <span className="font-mono font-bold">{booking?.booking_code}</span> · {booking?.apartments?.name} · {booking?.check_in} → {booking?.check_out}
            </div>
        </header>

        {travelers.map((t, idx) => (
            <fieldset key={idx} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 mb-6">
                <legend className="px-3 -ml-3 font-serif text-lg font-bold text-text-primary">
                    {idx === 0 ? 'Titular (huésped principal)' : `Acompañante ${idx}`}
                </legend>
                {idx > 0 && (
                    <button type="button" onClick={() => removeTraveler(idx)}
                        className="float-right text-gray-400 hover:text-red-600 transition-colors"
                        aria-label={`Quitar acompañante ${idx}`}>
                        <Trash2 size={16} aria-hidden="true" />
                    </button>
                )}

                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <FormField label="Nombre *" required value={t.nombre} onChange={(v) => updateTraveler(idx, 'nombre', v)} />
                    <FormField label="Primer apellido *" required value={t.apellido_primero} onChange={(v) => updateTraveler(idx, 'apellido_primero', v)} />
                    <FormField label="Segundo apellido" value={t.apellido_segundo} onChange={(v) => updateTraveler(idx, 'apellido_segundo', v)} />
                    <FormSelect label="Sexo *" required value={t.sexo} onChange={(v) => updateTraveler(idx, 'sexo', v)}
                        options={[{ value: 'H', label: 'Hombre' }, { value: 'M', label: 'Mujer' }, { value: 'X', label: 'Otro / No especificar' }]} />
                    <FormSelect label="Tipo de documento *" required value={t.tipo_documento} onChange={(v) => updateTraveler(idx, 'tipo_documento', v)}
                        options={DOC_TYPES.map(d => ({ value: d.code, label: d.name }))} />
                    <FormField label="Número documento *" required value={t.numero_documento}
                        onChange={(v) => updateTraveler(idx, 'numero_documento', v.toUpperCase().trim())} maxLength={20} />
                    <FormField label="Soporte (DNI: nº atrás)" value={t.soporte_documento}
                        onChange={(v) => updateTraveler(idx, 'soporte_documento', v.toUpperCase().trim())} maxLength={20} />
                    <FormSelect label="Nacionalidad *" required value={t.nacionalidad} onChange={(v) => updateTraveler(idx, 'nacionalidad', v)}
                        options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))} />
                    <FormField label="Fecha nacimiento *" required type="date" max={new Date().toISOString().slice(0, 10)}
                        value={t.fecha_nacimiento} onChange={(v) => updateTraveler(idx, 'fecha_nacimiento', v)} />
                </div>

                <h3 className="font-serif text-base font-bold text-text-primary mt-6 mb-3">Dirección habitual</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                    <FormField label="Calle / Vía *" required value={t.direccion_via} onChange={(v) => updateTraveler(idx, 'direccion_via', v)} maxLength={200} className="sm:col-span-2" />
                    <FormField label="Municipio *" required value={t.direccion_municipio} onChange={(v) => updateTraveler(idx, 'direccion_municipio', v)} />
                    <FormField label="Código postal *" required value={t.direccion_cp} onChange={(v) => updateTraveler(idx, 'direccion_cp', v)} maxLength={10} />
                    <FormSelect label="País *" required value={t.direccion_pais} onChange={(v) => updateTraveler(idx, 'direccion_pais', v)}
                        options={COUNTRIES.map(c => ({ value: c.code, label: c.name }))} />
                </div>

                <h3 className="font-serif text-base font-bold text-text-primary mt-6 mb-3">Contacto</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                    <FormField label="Teléfono móvil" type="tel" value={t.telefono_movil} onChange={(v) => updateTraveler(idx, 'telefono_movil', v)} />
                    <FormField label="Teléfono fijo" type="tel" value={t.telefono_fijo} onChange={(v) => updateTraveler(idx, 'telefono_fijo', v)} />
                    <FormField label="Email" type="email" value={t.email} onChange={(v) => updateTraveler(idx, 'email', v)} className="sm:col-span-2" />
                </div>
            </fieldset>
        ))}

        {booking && travelers.length < (booking.pax_count || 8) && (
            <button type="button" onClick={addTraveler}
                className="w-full mb-6 inline-flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-rural-300 text-rural-700 font-bold hover:bg-rural-50 transition-colors">
                <UserPlus size={18} aria-hidden="true" /> Añadir acompañante adulto
            </button>
        )}

        <label className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-gray-100 mb-6">
            <input type="checkbox" required checked={accept} onChange={(e) => setAccept(e.target.checked)}
                className="mt-1 h-5 w-5 accent-rural-700 cursor-pointer" />
            <span className="text-sm text-gray-700 leading-relaxed">
                Confirmo que los datos son veraces y autorizo su transmisión al Ministerio del Interior conforme al
                Real Decreto 933/2021. He leído la{' '}
                <Link to="/privacidad" target="_blank" className="underline text-rural-700">política de privacidad</Link>.
            </span>
        </label>

        {submitError && <p className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{submitError}</p>}

        <button type="submit" disabled={submitting || !accept}
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
            {submitting ? 'Guardando…' : 'Enviar precheckin'}
        </button>

        <p className="mt-4 text-xs text-center text-gray-500 max-w-md mx-auto">
            Puedes volver a este enlace para corregir los datos en cualquier momento, hasta el día de la entrada.
        </p>
    </form>
);

const DoneScreen = ({ booking, count }) => (
    <div className="bg-gradient-to-br from-rural-50 to-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rural-700 flex items-center justify-center text-white">
            <Check size={28} aria-hidden="true" />
        </div>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-3">Precheckin enviado</h2>
        <p className="text-gray-700 mb-6 leading-relaxed">
            Datos de {count} {count === 1 ? 'huésped' : 'huéspedes'} guardados para la reserva <strong className="font-mono">{booking?.booking_code}</strong>.
            Si te das cuenta de algún error, vuelve a este mismo enlace y reenvía el formulario antes de la fecha de entrada.
        </p>
        <Link to="/" className="inline-block px-6 py-3 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
            Volver al inicio
        </Link>
    </div>
);

const FormField = ({ label, required, type = 'text', value, onChange, className = '', maxLength = 120, ...rest }) => (
    <label className={`block ${className}`}>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">{label}</span>
        <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)}
            maxLength={maxLength}
            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 text-text-primary"
            {...rest} />
    </label>
);

const FormSelect = ({ label, required, value, onChange, options, className = '' }) => (
    <label className={`block ${className}`}>
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">{label}</span>
        <select required={required} value={value} onChange={(e) => onChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-100 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 text-text-primary cursor-pointer">
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </label>
);

export default PrecheckinPage;
