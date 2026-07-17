import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Calendar, Users, Search, Shield, MessageCircle, Phone, Check, ArrowRight } from 'lucide-react';
import PageHead from '../components/seo/PageHead';
import { supabase } from '../lib/supabase';
import { whatsappLink } from '../constants/urls';
import { imgAttrs } from '../utils/supabaseImage';

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
};

const formatPrice = (p) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(p));

const ReservarPage = () => {
    const [step, setStep] = useState('search');      // search | choose | guest | done
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [guests, setGuests] = useState(2);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [available, setAvailable] = useState([]);
    const [selected, setSelected] = useState(null);
    const [guestForm, setGuestForm] = useState({ name: '', email: '', phone: '', accept: false, marketing: false });
    const [holdResult, setHoldResult] = useState(null);
    const [holdError, setHoldError] = useState(null);
    const [holding, setHolding] = useState(false);

    const searchAvailability = async (e) => {
        e?.preventDefault();
        setSearching(true);
        setSearchError(null);
        setAvailable([]);
        try {
            const { data, error } = await supabase.rpc('check_availability', {
                p_check_in: checkIn,
                p_check_out: checkOut,
                p_pax: guests,
            });
            if (error) throw error;
            setAvailable(data || []);
            setStep('choose');
        } catch (err) {
            setSearchError(err.message || 'No hemos podido comprobar disponibilidad. Vuelve a intentarlo o escríbenos por WhatsApp.');
        } finally {
            setSearching(false);
        }
    };

    const confirmHold = async (e) => {
        e?.preventDefault();
        if (!selected || !guestForm.accept) return;
        setHolding(true);
        setHoldError(null);
        try {
            // 1. Crear hold en Supabase (15 min TTL, anti-overbooking via EXCLUDE)
            const { data, error } = await supabase.rpc('create_booking_hold', {
                p_apartment_id: selected.apartment_id,
                p_check_in: checkIn,
                p_check_out: checkOut,
                p_pax: guests,
                p_guest_name: guestForm.name.trim(),
                p_guest_email: guestForm.email.trim(),
                p_guest_phone: guestForm.phone.trim() || null,
            });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            setHoldResult(row);

            // RGPD: registrar consentimiento de marketing si el huésped lo marcó.
            // Fallo silencioso — no bloquea la reserva.
            if (guestForm.marketing && guestForm.email) {
                try {
                    await supabase.rpc('record_marketing_consent', {
                        p_email: guestForm.email.trim(),
                        p_granted: true,
                        p_source: 'booking_form',
                        p_user_agent: navigator.userAgent,
                        p_legal_version: '1.0',
                        p_booking_code: row.booking_code,
                    });
                } catch { /* no rompe la reserva si la auditoría falla */ }
            }

            // 2. Pedir sesión Stripe Checkout y redirigir. Si la edge function
            //    no está configurada todavía (sin STRIPE_SECRET_KEY), el hold
            //    queda creado y mostramos pantalla de cierre por WhatsApp.
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const res = await fetch(`${supabaseUrl}/functions/v1/create-payment-session`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        apikey: anonKey,
                        authorization: `Bearer ${anonKey}`,
                    },
                    body: JSON.stringify({ bookingCode: row.booking_code }),
                });
                if (res.ok) {
                    const { url } = await res.json();
                    if (url) { window.location.href = url; return; }
                }
                // Stripe no configurado o error → fallback a pantalla WhatsApp
                setStep('done');
            } catch {
                setStep('done');
            }
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('apartment_not_available') || msg.includes('no_overlap_bookings')) {
                setHoldError('Justo ese apartamento ya no está libre para esas fechas. Vuelve atrás y elige otro.');
            } else {
                setHoldError(msg || 'No hemos podido reservar. Vuelve a intentarlo en un momento.');
            }
        } finally {
            setHolding(false);
        }
    };

    const reset = () => {
        setStep('search'); setAvailable([]); setSelected(null);
        setHoldResult(null); setHoldError(null); setSearchError(null);
        setGuestForm({ name: '', email: '', phone: '', accept: false, marketing: false });
    };

    return (
        <div className="min-h-screen bg-white">
            <PageHead
                title="Reserva directa con disponibilidad real"
                description="Reserva directa sin intermediarios. Elige fechas, comprueba disponibilidad en tiempo real y reserva en menos de 2 minutos."
                path="/reservar"
            />

            <nav className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-gray-100 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                        <ChevronLeft size={20} aria-hidden="true" /> Volver
                    </Link>
                    <div className="hidden sm:flex items-center gap-4 text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                            <Shield size={14} aria-hidden="true" className="text-rural-700" />
                            Reserva segura
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Sin intermediarios</span>
                        <span aria-hidden="true">·</span>
                        <span>VTAR/JA/00044</span>
                    </div>
                </div>
            </nav>

            <main className="pt-24 pb-16 px-4 md:px-6">
                <div className="max-w-3xl mx-auto">
                    <Stepper step={step} />

                    {step === 'search' && (
                        <SearchForm
                            checkIn={checkIn} setCheckIn={setCheckIn}
                            checkOut={checkOut} setCheckOut={setCheckOut}
                            guests={guests} setGuests={setGuests}
                            searching={searching} error={searchError}
                            onSubmit={searchAvailability}
                        />
                    )}

                    {step === 'choose' && (
                        <ChooseApartment
                            checkIn={checkIn} checkOut={checkOut} guests={guests}
                            available={available}
                            onBack={() => setStep('search')}
                            onSelect={(apt) => { setSelected(apt); setStep('guest'); }}
                        />
                    )}

                    {step === 'guest' && selected && (
                        <GuestForm
                            selected={selected} checkIn={checkIn} checkOut={checkOut} guests={guests}
                            form={guestForm} setForm={setGuestForm}
                            holding={holding} error={holdError}
                            onBack={() => setStep('choose')}
                            onSubmit={confirmHold}
                        />
                    )}

                    {step === 'done' && holdResult && (
                        <BookingHeldSuccess hold={holdResult} selected={selected} onReset={reset} />
                    )}
                </div>
            </main>
        </div>
    );
};

// ============================================================
const Stepper = ({ step }) => {
    const steps = [
        { id: 'search', label: 'Fechas' },
        { id: 'choose', label: 'Apartamento' },
        { id: 'guest', label: 'Tus datos' },
        { id: 'done', label: 'Confirmación' },
    ];
    const currentIdx = steps.findIndex(s => s.id === step);
    return (
        <ol className="flex justify-between mb-10 text-xs font-medium" aria-label="Pasos de la reserva">
            {steps.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                    <li key={s.id} className="flex-1 flex flex-col items-center">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 ${active ? 'bg-primary text-white' : done ? 'bg-rural-700 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            {done ? <Check size={12} aria-hidden="true" /> : i + 1}
                        </span>
                        <span className={active ? 'text-primary' : done ? 'text-rural-700' : 'text-gray-400'}>{s.label}</span>
                    </li>
                );
            })}
        </ol>
    );
};

const SearchForm = ({ checkIn, setCheckIn, checkOut, setCheckOut, guests, setGuests, searching, error, onSubmit }) => (
    <form onSubmit={onSubmit} className="bg-gradient-to-br from-rural-50 to-white rounded-3xl border border-gray-100 shadow-xl p-6 md:p-10">
        <h1 className="font-serif text-2xl md:text-4xl font-bold text-text-primary mb-2">Comprueba disponibilidad</h1>
        <p className="text-gray-600 mb-8">Elige fechas y número de personas. Te enseñamos al instante qué apartamentos están libres y a qué precio.</p>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Field icon={Calendar} label="Entrada">
                <input type="date" required min={today()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                    aria-label="Fecha de entrada" className="w-full bg-transparent outline-none text-text-primary font-medium" />
            </Field>
            <Field icon={Calendar} label="Salida">
                <input type="date" required min={checkIn ? addDays(checkIn, 1) : addDays(today(), 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                    aria-label="Fecha de salida" className="w-full bg-transparent outline-none text-text-primary font-medium" />
            </Field>
        </div>
        <Field icon={Users} label="Personas">
            <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} aria-label="Número de personas"
                className="w-full bg-transparent outline-none text-text-primary font-medium appearance-none cursor-pointer">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>)}
            </select>
        </Field>

        {error && <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{error}</p>}

        <button type="submit" disabled={searching || !checkIn || !checkOut}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
            {searching ? <span>Buscando…</span> : <><Search size={18} aria-hidden="true" /> Ver apartamentos disponibles</>}
        </button>

        <FallbackContact />
    </form>
);

const ChooseApartment = ({ checkIn, checkOut, guests, available, onBack, onSelect }) => (
    <div>
        <button type="button" onClick={onBack} className="text-sm text-rural-700 font-bold mb-6 inline-flex items-center gap-1 hover:gap-2 transition-all">
            <ChevronLeft size={16} aria-hidden="true" /> Cambiar fechas o personas
        </button>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-1">Apartamentos disponibles</h2>
        <p className="text-sm text-gray-600 mb-6">
            {checkIn} → {checkOut} · {guests} {guests === 1 ? 'persona' : 'personas'}
        </p>

        {available.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 shadow-sm bg-white p-8 text-center">
                <p className="text-text-primary font-bold mb-2">No hay apartamentos libres para esas fechas.</p>
                <p className="text-sm text-gray-600 mb-4">Prueba con otras fechas, o escríbenos: a veces tenemos hueco que no aparece online.</p>
                <FallbackContact />
            </div>
        ) : (
            <ul className="space-y-4">
                {available.map(apt => (
                    <li key={apt.apartment_id}>
                        <article className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="sm:w-44 h-32 sm:h-auto rounded-xl overflow-hidden bg-rural-50 flex-shrink-0">
                                {apt.images?.[0] && (
                                    <img
                                        {...imgAttrs(apt.images[0], { width: 360, height: 240, quality: 78 })}
                                        alt={`Apartamento ${apt.name}`}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                            <div className="flex-1 flex flex-col">
                                <h3 className="font-serif text-xl font-bold text-text-primary">{apt.name}</h3>
                                <p className="text-xs text-gray-500 mb-2">{apt.capacity_people} {apt.capacity_people === 1 ? 'plaza' : 'plazas'}</p>
                                {apt.short_description && (
                                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3">{apt.short_description}</p>
                                )}
                                <div className="mt-auto flex items-end justify-between flex-wrap gap-3">
                                    <div>
                                        <p className="font-serif text-2xl font-bold text-text-primary">{formatPrice(apt.total_price)}</p>
                                        <p className="text-xs text-gray-500">{apt.nights} {apt.nights === 1 ? 'noche' : 'noches'} · {formatPrice(apt.nightly_avg)}/noche</p>
                                    </div>
                                    <button type="button" onClick={() => onSelect(apt)}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white bg-primary hover:bg-rural-700 transition-colors">
                                        Reservar <ArrowRight size={14} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </article>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const GuestForm = ({ selected, checkIn, checkOut, guests, form, setForm, holding, error, onBack, onSubmit }) => (
    <form onSubmit={onSubmit} className="bg-gradient-to-br from-rural-50 to-white rounded-3xl border border-gray-100 shadow-xl p-6 md:p-10">
        <button type="button" onClick={onBack} className="text-sm text-rural-700 font-bold mb-6 inline-flex items-center gap-1 hover:gap-2 transition-all">
            <ChevronLeft size={16} aria-hidden="true" /> Elegir otro apartamento
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
            <p className="text-xs uppercase tracking-widest font-bold text-primary mb-1">Tu selección</p>
            <p className="font-serif text-lg font-bold text-text-primary">{selected.name}</p>
            <p className="text-sm text-gray-600">{checkIn} → {checkOut} · {guests} {guests === 1 ? 'persona' : 'personas'} · {selected.nights} {selected.nights === 1 ? 'noche' : 'noches'}</p>
            <p className="font-serif text-2xl font-bold text-primary mt-2">{formatPrice(selected.total_price)}</p>
        </div>

        <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-4">Tus datos</h2>

        <div className="space-y-4">
            <Field icon={null} label="Nombre y apellidos">
                <input type="text" required minLength={2} maxLength={120} value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    aria-label="Nombre y apellidos"
                    className="w-full bg-transparent outline-none text-text-primary font-medium" />
            </Field>
            <Field icon={null} label="Email">
                <input type="email" required maxLength={200} value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    aria-label="Email"
                    className="w-full bg-transparent outline-none text-text-primary font-medium" />
            </Field>
            <Field icon={null} label="Teléfono (opcional)">
                <input type="tel" maxLength={30} value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    aria-label="Teléfono"
                    placeholder="+34 ..."
                    className="w-full bg-transparent outline-none text-text-primary font-medium" />
            </Field>

            <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
                <input type="checkbox" required checked={form.accept}
                    onChange={(e) => setForm({ ...form, accept: e.target.checked })}
                    aria-required="true"
                    className="mt-1 h-5 w-5 accent-rural-700 cursor-pointer" />
                <span className="text-sm text-gray-700 leading-relaxed">
                    He leído y acepto las{' '}
                    <Link to="/condiciones" target="_blank" className="underline text-rural-700">condiciones de reserva</Link>.
                </span>
            </label>

            {/* La privacidad se informa, no se consiente: la base del tratamiento es la
                ejecución de la reserva (art. 6.1.b RGPD), no el consentimiento del art. 6.1.a. */}
            <p className="text-[11px] leading-relaxed text-gray-500 px-1">
                <strong>Protección de datos — información básica.</strong> Responsable: el titular del alojamiento (ver{' '}
                <Link to="/aviso-legal" target="_blank" className="underline">aviso legal</Link>). Finalidad: gestionar tu
                reserva y, en su caso, el pago. Legitimación: ejecución de un contrato (art. 6.1.b RGPD). Destinatarios:
                Supabase (UE) y Stripe, como encargados del tratamiento. Conservación: mientras dure la relación
                contractual y los plazos legales aplicables. Puedes ejercer tus derechos de acceso, rectificación,
                supresión y demás escribiendo a{' '}
                <a href="mailto:apartamentostiojosemaria@gmail.com" className="underline">apartamentostiojosemaria@gmail.com</a>.
                Más información en la{' '}
                <Link to="/privacidad" target="_blank" className="underline">política de privacidad</Link>.
            </p>

            <label className="flex items-start gap-3 p-3 bg-rural-50/40 rounded-xl border border-gray-100">
                <input type="checkbox" checked={form.marketing}
                    onChange={(e) => setForm({ ...form, marketing: e.target.checked })}
                    className="mt-1 h-5 w-5 accent-rural-700 cursor-pointer" />
                <span className="text-sm text-gray-700 leading-relaxed">
                    Quiero recibir ocasionalmente <strong>ofertas y novedades</strong> de Tío José María (opcional).
                    <span className="block text-xs text-gray-500 mt-0.5">Puedes darte de baja en cualquier momento con el enlace que aparece en cada email.</span>
                </span>
            </label>
        </div>

        {error && <p className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{error}</p>}

        <button type="submit" disabled={holding || !form.accept}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
            {holding ? 'Reservando…' : <>Reservar y pagar {formatPrice(selected.total_price)} <ArrowRight size={18} aria-hidden="true" /></>}
        </button>

        <p className="mt-4 text-xs text-gray-500 text-center max-w-md mx-auto">
            Tu apartamento queda reservado durante 15 minutos mientras completas el pago. Pago 100% seguro con tarjeta, procesado por Stripe.
        </p>
    </form>
);

const BookingHeldSuccess = ({ hold, selected, onReset }) => {
    const message = `Hola, acabo de reservar ${selected.name} (${hold.booking_code}). Total ${formatPrice(hold.total_price)}. ¿Me confirmáis cómo pagar?`;
    return (
        <div className="bg-gradient-to-br from-rural-50 to-white rounded-3xl border border-gray-100 shadow-xl p-8 md:p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-rural-700 flex items-center justify-center text-white">
                <Check size={24} aria-hidden="true" />
            </div>
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary mb-3">
                Tu reserva está apartada
            </h2>
            <p className="text-gray-700 mb-2">
                Código <span className="font-mono font-bold text-primary">{hold.booking_code}</span>
            </p>
            <p className="text-gray-700 mb-6">
                {selected.name} · {formatPrice(hold.total_price)}
            </p>
            <p className="text-sm text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
                Te hemos guardado el apartamento durante 15 minutos. Mientras terminamos de afinar la pasarela de pago online, escríbenos por WhatsApp con el código y te decimos cómo confirmar la reserva (transferencia o Bizum, lo que prefieras).
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={whatsappLink(message)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-primary shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    <MessageCircle size={18} aria-hidden="true" /> Cerrar por WhatsApp
                </a>
                <button type="button" onClick={onReset}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold border-2 border-primary text-primary hover:-translate-y-0.5 transition-all">
                    Hacer otra búsqueda
                </button>
            </div>
        </div>
    );
};

const Field = ({ icon: Icon, label, children }) => (
    <label className="block bg-white rounded-2xl border border-gray-100 px-4 py-3 hover:border-rural-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            {Icon && <Icon size={12} aria-hidden="true" />} {label}
        </span>
        {children}
    </label>
);

const FallbackContact = () => (
    <div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm" aria-label="Otras formas de contactar">
        <a href={whatsappLink('Hola, quiero reservar en Tío José María.')} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 text-text-primary hover:border-rural-300">
            <MessageCircle size={16} aria-hidden="true" className="text-rural-700" />
            WhatsApp directo
        </a>
        <a href="tel:+34676344675" className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 text-text-primary hover:border-rural-300">
            <Phone size={16} aria-hidden="true" className="text-rural-700" />
            676 34 46 75
        </a>
    </div>
);

export default ReservarPage;
