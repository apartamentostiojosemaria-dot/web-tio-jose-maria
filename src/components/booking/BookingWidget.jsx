import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, ChevronLeft, ChevronRight, Check, AlertCircle, ArrowRight, Phone, Mail, User, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logError } from '../../utils/logger';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const BookingWidget = ({ apartment, blockedDates = [], highSeasons = [] }) => {
    const [step, setStep] = useState(1);
    const [checkIn, setCheckIn] = useState(null);
    const [checkOut, setCheckOut] = useState(null);
    const [selecting, setSelecting] = useState('checkin');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [form, setForm] = useState({ name: '', email: '', phone: '', pax: 2, notes: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isDateBlocked = (date) => blockedDates.some(range => {
        const start = new Date(range.start_date);
        const end = new Date(range.end_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
    });

    const isHighSeason = (date) => highSeasons.some(range => {
        const start = new Date(range.start_date);
        const end = new Date(range.end_date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end;
    });

    const isPastDate = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    const isInRange = (date) => checkIn && checkOut && date > checkIn && date < checkOut;

    const isRangeBlocked = (start, end) => {
        const d = new Date(start);
        while (d <= end) {
            if (isDateBlocked(d)) return true;
            d.setDate(d.getDate() + 1);
        }
        return false;
    };

    const handleDateClick = (date) => {
        if (isPastDate(date) || isDateBlocked(date)) return;
        if (selecting === 'checkin') {
            setCheckIn(date);
            setCheckOut(null);
            setSelecting('checkout');
        } else {
            if (date <= checkIn) { setCheckIn(date); setCheckOut(null); return; }
            if (isRangeBlocked(checkIn, date)) {
                setError('Hay fechas ocupadas en el rango seleccionado');
                setTimeout(() => setError(null), 3000);
                return;
            }
            setCheckOut(date);
            setSelecting('checkin');
        }
    };

    const priceBreakdown = useMemo(() => {
        if (!checkIn || !checkOut) return null;
        let lowNights = 0, highNights = 0;
        const d = new Date(checkIn);
        while (d < checkOut) {
            if (isHighSeason(d)) highNights++; else lowNights++;
            d.setDate(d.getDate() + 1);
        }
        const priceLow = apartment.price_low;
        const priceHigh = apartment.price_high;
        const hasPrices = priceLow && priceHigh;
        const total = hasPrices ? (lowNights * priceLow) + (highNights * priceHigh) : null;
        return { lowNights, highNights, priceLow, priceHigh, total, nights: lowNights + highNights, hasPrices };
    }, [checkIn, checkOut, apartment, highSeasons]);

    const formatDate = (d) => d ? `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)}` : '\u2014';

    // Formato YYYY-MM-DD respetando zona horaria local (toISOString convierte
    // a UTC y rompe fechas en zonas con offset positivo: 2026-09-08 00:00 CEST
    // pasa a 2026-09-07 22:00 UTC y queda guardado como 7 en BD).
    const toLocalDateString = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const handleSubmit = async () => {
        if (!form.name || !form.email || !checkIn || !checkOut) return;
        setSubmitting(true);
        setError(null);
        const checkInStr = toLocalDateString(checkIn);
        const checkOutStr = toLocalDateString(checkOut);

        const { data: insertedRow, error: insertError } = await supabase
            .from('guest_bookings')
            .insert({
                apartment_id: apartment.id, guest_name: form.name, guest_email: form.email,
                guest_phone: form.phone, pax_count: form.pax, check_in: checkInStr, check_out: checkOutStr,
                total_price: priceBreakdown.total, price_breakdown: priceBreakdown, notes: form.notes, source: 'web',
            })
            .select('id')
            .single();

        if (insertError) {
            logError('BookingWidget.submit', insertError);
            setError('Ha ocurrido un error. Intentalo de nuevo o contacta por WhatsApp.');
            setSubmitting(false);
        } else {
            // El bloqueo de fechas y el envio de emails los hace la edge function
            // con service role (el anon key no tiene permiso para insert en
            // blocked_dates). Pasamos el booking_id para que pueda releerlo si
            // lo necesita.
            try {
                await supabase.functions.invoke('notify-booking', {
                    body: {
                        booking_id: insertedRow?.id,
                        booking_data: { apartment_name: apartment.name, apartments: { name: apartment.name }, guest_name: form.name, guest_email: form.email, guest_phone: form.phone, pax_count: form.pax, check_in: checkInStr, check_out: checkOutStr, total_price: priceBreakdown?.total, notes: form.notes }
                    },
                });
            } catch (e) { logError('BookingWidget.notify', e); }
            setStep(4);
            setSubmitting(false);
        }
    };

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;

        return (
            <div role="group" aria-label={`Calendario ${MONTH_NAMES[month]} ${year}`}>
                <div className="flex justify-between items-center mb-4">
                    <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-full" aria-label="Mes anterior"><ChevronLeft size={16} /></button>
                    <span className="font-serif font-bold text-sm text-text-primary">{MONTH_NAMES[month]} {year}</span>
                    <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-full" aria-label="Mes siguiente"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
                    {DAY_NAMES.map(d => <span key={d} className="text-center text-[10px] font-bold text-gray-500">{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const date = new Date(year, month, day);
                        date.setHours(0, 0, 0, 0);
                        const blocked = isDateBlocked(date);
                        const past = isPastDate(date);
                        const isCI = checkIn && date.getTime() === checkIn.getTime();
                        const isCO = checkOut && date.getTime() === checkOut.getTime();
                        const inRange = isInRange(date);
                        const disabled = blocked || past;

                        let className = 'aspect-square flex items-center justify-center text-xs font-bold rounded-lg transition-all ';
                        if (isCI) className += 'bg-rural-700 text-white rounded-r-none';
                        else if (isCO) className += 'bg-rural-700 text-white rounded-l-none';
                        else if (inRange) className += 'bg-rural-100 text-rural-800';
                        else if (disabled) className += 'text-gray-300 cursor-not-allowed';
                        else className += 'hover:bg-rural-50 cursor-pointer text-gray-700';
                        if (blocked) className += ' line-through';

                        return (
                            <button
                                key={day}
                                disabled={disabled}
                                onClick={() => handleDateClick(date)}
                                className={className}
                                aria-label={`${day} ${MONTH_NAMES[month]}${blocked ? ', ocupado' : ''}${isCI ? ', fecha de entrada' : ''}${isCO ? ', fecha de salida' : ''}`}
                                aria-selected={isCI || isCO}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-primary/5">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-serif font-bold text-lg text-text-primary">Reserva Directa</h3>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700">Sin comisiones</span>
                </div>
                <p className="text-xs text-gray-600">Mismo alojamiento y fechas: si lo encuentras más barato, igualamos el precio.</p>
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="dates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setSelecting('checkin')} className={`p-3 rounded-xl border text-left transition-all ${selecting === 'checkin' ? 'border-rural-400 bg-rural-50' : 'border-gray-100'}`}>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Entrada</p>
                                <p className="font-bold text-sm text-text-primary">{checkIn ? formatDate(checkIn) : 'Selecciona'}</p>
                            </button>
                            <button onClick={() => { if (checkIn) setSelecting('checkout'); }} className={`p-3 rounded-xl border text-left transition-all ${selecting === 'checkout' ? 'border-rural-400 bg-rural-50' : 'border-gray-100'}`}>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Salida</p>
                                <p className="font-bold text-sm text-text-primary">{checkOut ? formatDate(checkOut) : 'Selecciona'}</p>
                            </button>
                        </div>
                        {renderCalendar()}
                        <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rural-700" /> Seleccionado</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-200 line-through" /> Ocupado</span>
                        </div>
                        {priceBreakdown && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-rural-50 border border-rural-100 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">{priceBreakdown.nights} {priceBreakdown.nights === 1 ? 'noche' : 'noches'}</span>
                                    <span className="font-bold text-text-primary">{priceBreakdown.hasPrices ? `${priceBreakdown.total}€` : 'Precio a confirmar'}</span>
                                </div>
                                {priceBreakdown.hasPrices && priceBreakdown.lowNights > 0 && (
                                    <div className="flex justify-between text-xs text-gray-600">
                                        <span>{priceBreakdown.lowNights} × {priceBreakdown.priceLow}€ (temp. baja)</span>
                                        <span>{priceBreakdown.lowNights * priceBreakdown.priceLow}€</span>
                                    </div>
                                )}
                                {priceBreakdown.hasPrices && priceBreakdown.highNights > 0 && (
                                    <div className="flex justify-between text-xs text-amber-600">
                                        <span>{priceBreakdown.highNights} × {priceBreakdown.priceHigh}€ (temp. alta)</span>
                                        <span>{priceBreakdown.highNights * priceBreakdown.priceHigh}€</span>
                                    </div>
                                )}
                                {!priceBreakdown.hasPrices && <p className="text-xs text-gray-600 italic">El precio final te lo confirmaremos tras enviar la solicitud.</p>}
                            </motion.div>
                        )}
                        {error && <p className="text-xs text-red-500 flex items-center gap-1" role="alert"><AlertCircle size={12} /> {error}</p>}
                        <button disabled={!checkIn || !checkOut} onClick={() => setStep(2)} className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-primary transition-all hover:shadow-lg disabled:opacity-40">
                            Continuar <ArrowRight size={16} />
                        </button>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-4">
                        <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-600"><ChevronLeft size={14} /> Cambiar fechas</button>
                        <div className="p-3 rounded-xl bg-rural-50 border border-rural-100 flex items-center justify-between text-sm">
                            <span className="font-bold text-text-primary">{formatDate(checkIn)} → {formatDate(checkOut)}</span>
                            <span className="font-bold text-primary">{priceBreakdown?.hasPrices ? `${priceBreakdown.total}€` : 'Precio a confirmar'}</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="bk-name" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Nombre completo *</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                    <input id="bk-name" type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 focus:border-rural-400" placeholder="Tu nombre" required />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="bk-email" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Email *</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                    <input id="bk-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 focus:border-rural-400" placeholder="tu@email.com" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="bk-phone" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Teléfono</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                        <input id="bk-phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 focus:border-rural-400" placeholder="+34..." />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="bk-pax" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Huéspedes</label>
                                    <div className="relative">
                                        <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                        <select id="bk-pax" value={form.pax} onChange={e => setForm(f => ({ ...f, pax: Number(e.target.value) }))} className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 focus:border-rural-400 appearance-none bg-white">
                                            {Array.from({ length: apartment.capacity_people || 4 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="bk-notes" className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Notas (opcional)</label>
                                <textarea id="bk-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rural-200 focus:border-rural-400 resize-none" placeholder="Hora de llegada, peticiones especiales..." />
                            </div>
                        </div>
                        {error && <p className="text-xs text-red-500 flex items-center gap-1" role="alert"><AlertCircle size={12} /> {error}</p>}
                        <button disabled={!form.name || !form.email} onClick={() => setStep(3)} className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-primary transition-all hover:shadow-lg disabled:opacity-40">
                            Revisar reserva <ArrowRight size={16} />
                        </button>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-4">
                        <button onClick={() => setStep(2)} className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-600"><ChevronLeft size={14} /> Modificar datos</button>
                        <div className="p-5 rounded-2xl bg-rural-50 border border-rural-100 space-y-3">
                            <h4 className="font-serif font-bold text-text-primary">Resumen de tu reserva</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-500">Apartamento</span><span className="font-bold text-text-primary">{apartment.name}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Entrada</span><span className="font-bold">{checkIn?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Salida</span><span className="font-bold">{checkOut?.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Noches</span><span className="font-bold">{priceBreakdown?.nights}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Huéspedes</span><span className="font-bold">{form.pax}</span></div>
                                <hr className="border-rural-200" />
                                <div className="flex justify-between"><span className="text-gray-500">Nombre</span><span className="font-bold">{form.name}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-bold text-xs">{form.email}</span></div>
                                {form.phone && <div className="flex justify-between"><span className="text-gray-500">Teléfono</span><span className="font-bold">{form.phone}</span></div>}
                                <hr className="border-rural-200" />
                                <div className="flex justify-between text-lg"><span className="font-bold text-text-primary">Total</span><span className="font-bold text-primary">{priceBreakdown?.hasPrices ? `${priceBreakdown.total}€` : 'A confirmar'}</span></div>
                            </div>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 flex items-start gap-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <span>Al enviar la solicitud bloqueamos provisionalmente estas fechas y te confirmamos la disponibilidad antes de 24 h. El pago se realiza directamente con el propietario.</span>
                        </div>

                        {/* Resumen visible de condiciones clave, antes del envío. */}
                        <p className="text-xs text-gray-600 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <span>Solicitud sin cargo</span><span aria-hidden="true">·</span>
                            <span>Te confirmamos en menos de 24 h</span><span aria-hidden="true">·</span>
                            <span>Cancelación gratis hasta 7 días antes</span><span aria-hidden="true">·</span>
                            <span>Check-in presencial 16:00–20:00</span><span aria-hidden="true">·</span>
                            <span>Sin fianza</span>
                            {' '}—{' '}
                            <Link to="/condiciones" target="_blank" className="underline text-rural-700 font-medium">
                                Ver condiciones de reserva
                            </Link>
                        </p>

                        {/* Primera capa informativa RGPD (patrón AEPD), discreta pero visible sin desplegar. */}
                        <p className="text-[11px] leading-relaxed text-gray-500 border-t border-gray-100 pt-3">
                            <strong>Protección de datos — información básica.</strong> Responsable: el titular del alojamiento
                            (ver <Link to="/aviso-legal" target="_blank" className="underline">aviso legal</Link>).
                            Finalidad: gestionar tu solicitud de reserva. Legitimación: medidas precontractuales a petición
                            tuya (art. 6.1.b RGPD). Destinatarios: Supabase, alojado en la UE, como encargado del
                            tratamiento. Conservación: mientras se gestiona tu solicitud y los plazos legales aplicables.
                            Derechos: acceso, rectificación, supresión y demás derechos escribiendo a{' '}
                            <a href="mailto:apartamentostiojosemaria@gmail.com" className="underline">apartamentostiojosemaria@gmail.com</a>.
                            Más información en la{' '}
                            <Link to="/privacidad" target="_blank" className="underline">política de privacidad</Link>.
                        </p>

                        {error && <p className="text-xs text-red-500 flex items-center gap-1" role="alert"><AlertCircle size={12} /> {error}</p>}
                        <button disabled={submitting} onClick={handleSubmit} className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-primary transition-all hover:shadow-lg disabled:opacity-60">
                            {submitting
                                ? 'Enviando...'
                                : priceBreakdown?.hasPrices
                                    ? `Solicitar reserva por ${priceBreakdown.total} € · Sin cargo ahora`
                                    : 'Solicitar reserva · Sin cargo ahora'}
                            {!submitting && <Check size={16} />}
                        </button>
                    </motion.div>
                )}

                {step === 4 && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                            <Check size={32} className="text-primary" />
                        </div>
                        <h3 className="font-serif font-bold text-xl text-text-primary">Solicitud recibida</h3>
                        <p className="text-sm text-gray-500">
                            Hemos bloqueado provisionalmente estas fechas para <strong>{apartment.name}</strong>.
                            Te confirmamos por email a <strong>{form.email}</strong> antes de 24 h (normalmente mucho antes).
                        </p>
                        <div className="p-4 rounded-xl bg-rural-50 border border-rural-100">
                            <p className="text-xs text-gray-600 mb-1">Resumen</p>
                            <p className="font-bold text-sm text-text-primary">
                                {checkIn?.toLocaleDateString('es-ES')} {'→'} {checkOut?.toLocaleDateString('es-ES')} {'·'} {priceBreakdown?.nights} noches{priceBreakdown?.hasPrices ? ` · ${priceBreakdown.total}€` : ''}
                            </p>
                        </div>
                        <p className="text-xs text-gray-600">
                            La reserva no es firme hasta que la confirmamos.
                            Si tienes prisa o dudas, escr&iacute;benos directamente:
                        </p>
                        <a href={`https://api.whatsapp.com/send?phone=34676344675&text=Hola, acabo de solicitar una reserva para ${apartment.name} del ${checkIn?.toLocaleDateString('es-ES')} al ${checkOut?.toLocaleDateString('es-ES')}.`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary transition-colors hover:opacity-80">
                            <Phone size={16} /> Contactar por WhatsApp
                        </a>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BookingWidget;
