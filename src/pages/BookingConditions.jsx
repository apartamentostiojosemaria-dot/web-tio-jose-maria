import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PageHead from '../components/seo/PageHead';

// Condiciones de reserva — página independiente enlazada desde la ficha de
// apartamento y desde /reservar. Reutiliza los datos del titular ya
// publicados en el Aviso Legal (misma identidad, no la dupliques a mano si
// cambia allí).
const BookingConditions = () => (
    <div className="min-h-screen bg-white">
        <PageHead
            title="Condiciones de reserva"
            description="Cómo funciona la reserva en Apartamentos Rurales Tío José María: proceso, precio, pago, check-in y check-out, cancelación y reclamaciones."
            path="/condiciones"
        />
        <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
            <div className="max-w-4xl mx-auto flex items-center">
                <Link to="/" className="flex items-center gap-2 text-rural-700 font-bold hover:gap-3 transition-all">
                    <ChevronLeft size={20} aria-hidden="true" /> Volver
                </Link>
            </div>
        </nav>

        <main className="pt-24 pb-20 px-6">
            <div className="max-w-4xl mx-auto prose prose-gray">
                <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2 text-text-primary">Condiciones de reserva</h1>
                <p className="text-sm text-gray-400 mb-10">Última actualización: 17 de julio de 2026</p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">1. Quién presta el servicio</h2>
                <ul className="text-gray-700 leading-relaxed mb-6 list-disc pl-6">
                    <li><strong>Titular:</strong> Jesús Martínez Sánchez (persona física, autónomo)</li>
                    <li><strong>Denominación comercial:</strong> Apartamentos Rurales Tío José María</li>
                    <li><strong>Domicilio:</strong> Calle Baja 1, 23486 Hinojares, Jaén (España)</li>
                    <li><strong>Teléfono / WhatsApp:</strong> +34 676 34 46 75</li>
                    <li><strong>Email:</strong> apartamentostiojosemaria@gmail.com</li>
                    <li><strong>Inscripción turística:</strong> Vivienda Turística de Alojamiento Rural, Registro de Turismo de Andalucía, código <strong>VTAR/JA/00044</strong>.</li>
                </ul>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Más datos de identificación en el <Link to="/aviso-legal" className="underline text-rural-700">Aviso legal</Link>.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">2. Cómo se reserva</h2>
                <p className="text-gray-700 leading-relaxed mb-3">
                    Tienes dos formas de reservar en esta web, y funcionan de manera distinta:
                </p>
                <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-3">
                    <li>
                        <strong>Solicitud desde la ficha del apartamento.</strong> Rellenas fechas y datos y envías una
                        solicitud. No se realiza ningún cargo en ese momento ni quedan tus datos de pago guardados.
                        Bloqueamos las fechas de forma provisional y te confirmamos por email en menos de 24 horas
                        (normalmente mucho antes). La reserva no es firme hasta esa confirmación.
                    </li>
                    <li>
                        <strong>Reserva con pago en <Link to="/reservar" className="underline text-rural-700">/reservar</Link>.</strong> Buscas
                        disponibilidad, eliges apartamento y tus datos quedan retenidos con las fechas apartadas durante
                        <strong> 15 minutos</strong> mientras completas el pago con tarjeta a través de Stripe. Esta pasarela
                        está todavía en fase de pruebas: mientras la terminamos de consolidar, es posible que en algún caso
                        cerremos el pago contigo directamente por WhatsApp (transferencia o Bizum) en lugar de con tarjeta
                        online. Si eso ocurre te lo indicamos expresamente en la pantalla de confirmación.
                    </li>
                </ul>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">3. Precio</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    El precio que se muestra en cada apartamento y en el resumen de tu reserva es el precio final, con
                    todos los impuestos aplicables incluidos. No hay comisiones ni cargos adicionales por reservar
                    directamente con nosotros.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">4. Forma y momento del pago</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Si reservas desde la ficha del apartamento, no se te pide ni se te cobra nada al enviar la solicitud;
                    la forma de pago se acuerda directamente con el propietario una vez confirmada la reserva. Si reservas
                    desde <Link to="/reservar" className="underline text-rural-700">/reservar</Link>, el pago se realiza con
                    tarjeta en el momento de la reserva, de forma segura, a través de Stripe (o, mientras esa pasarela
                    termina de consolidarse, por transferencia o Bizum acordado por WhatsApp).
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">5. Check-in y check-out</h2>
                <ul className="text-gray-700 leading-relaxed mb-4 list-disc pl-6 space-y-1">
                    <li><strong>Check-in:</strong> presencial, de 16:00 a 20:00. Si tu llegada va a ser fuera de ese horario, escríbenos con antelación para acordarlo.</li>
                    <li><strong>Check-out:</strong> hasta las 12:00.{/* TODO Jesús: confirmar hora check-out — usamos 12:00 porque así aparece en el detalle de reserva del área de cliente (ClientArea.jsx), pero conviene que lo confirmes como dato oficial de cara al público. */}</li>
                </ul>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">6. Fianza</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    No se solicita ni se cobra fianza en ninguno de los dos procesos de reserva.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">7. Mascotas</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Con carácter general no se admiten mascotas. Consulta el equipamiento y las normas concretas de cada
                    apartamento en su ficha antes de reservar.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">8. Política de cancelación</h2>
                {/* Policy decided by the owner on 2026-07-17: free until 7 days before
                    check-in; later cancellations get one free date change instead of a refund. */}
                <ul className="list-disc pl-6 text-gray-700 leading-relaxed mb-4 space-y-2">
                    <li>
                        <strong>Cancelación gratuita hasta 7 días antes de la llegada.</strong> Si ya habías pagado,
                        te devolvemos el 100% del importe por el mismo medio de pago.
                    </li>
                    <li>
                        <strong>Con menos de 7 días de antelación</strong> la reserva no es reembolsable, pero te
                        ofrecemos <strong>un cambio de fechas gratuito</strong> (una vez, según disponibilidad y
                        dentro de los 12 meses siguientes). Si las nuevas fechas tienen una tarifa distinta, se
                        ajusta la diferencia.
                    </li>
                    <li>
                        <strong>No presentarse (no-show)</strong> sin aviso previo supone la pérdida del importe de
                        la reserva.
                    </li>
                    <li>
                        Si tu solicitud desde la ficha aún no estaba confirmada ni pagada, puedes cancelarla en
                        cualquier momento sin coste — basta con avisarnos.
                    </li>
                </ul>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Para cancelar o cambiar fechas, escríbenos por WhatsApp o email con tu localizador. Cuanto antes
                    nos avises, más fácil es encontrar una solución.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">9. Fuerza mayor</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Ninguna de las partes será responsable del incumplimiento de la reserva cuando este se deba a causas de
                    fuerza mayor: catástrofes naturales, cortes de suministro prolongados, decisiones de autoridades
                    públicas u otras circunstancias imprevisibles e inevitables ajenas a nuestra voluntad. En ese caso te
                    propondremos cambiar de fechas o, si no es posible, la devolución de lo abonado.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">10. Si algo no sale como esperabas</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Como establecimiento turístico andaluz, disponemos de hojas de reclamaciones a disposición de los
                    usuarios (puedes solicitarlas en el alojamiento o a través de la{' '}
                    <a
                        href="https://www.juntadeandalucia.es/organismos/turismoculturayeducacion/areas/turismo/calidad/hojas-reclamaciones.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-rural-700"
                    >
                        Consejería de Turismo de la Junta de Andalucía
                    </a>). También puedes someter cualquier controversia de consumo, de forma gratuita y voluntaria, a las
                    Juntas Arbitrales de Consumo. Más detalle en el{' '}
                    <Link to="/aviso-legal" className="underline text-rural-700">Aviso legal</Link>.
                </p>

                <h2 className="font-serif text-xl font-bold mt-8 mb-3 text-text-primary">11. Protección de datos</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                    Los datos que nos facilitas al reservar se tratan conforme a nuestra{' '}
                    <Link to="/privacidad" className="underline text-rural-700">Política de privacidad</Link>.
                </p>
            </div>
        </main>
    </div>
);

export default BookingConditions;
