import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import PageHead from '../components/seo/PageHead';

// Pantalla a la que redirige la edge function booking-status-update tras
// procesar un click en "Confirmar" / "Rechazar" desde el email admin.
// La function hace el trabajo (update status, blocked_dates, email al
// huesped) y luego redirige aqui con los datos en query params. Esta
// pantalla solo es visual.

const REASON_LABELS = {
    invalid_link: 'El enlace no es válido o está incompleto.',
    invalid_token: 'El enlace ha caducado o ha sido manipulado.',
    not_found: 'No encontramos la reserva en la base de datos.',
};

const AdminResponse = () => {
    const [params] = useSearchParams();
    const status = params.get('status');
    const action = params.get('action');
    const apt = params.get('apt');
    const guest = params.get('guest');
    const checkIn = params.get('checkIn');
    const checkOut = params.get('checkOut');
    const price = params.get('price');
    const reason = params.get('reason');

    const isError = status === 'error';
    const isConfirm = action === 'confirm';
    const verb = isConfirm ? 'confirmada' : 'rechazada';
    const Icon = isError ? AlertTriangle : isConfirm ? CheckCircle2 : XCircle;
    const accent = isError ? 'text-red-600 bg-red-50' : isConfirm ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50';
    const titleColor = isError ? 'text-red-700' : isConfirm ? 'text-green-700' : 'text-amber-700';

    const title = isError
        ? 'No se ha podido procesar'
        : status === 'already'
            ? `Esta reserva ya estaba ${verb}`
            : `Reserva ${verb}`;

    return (
        <div className="min-h-screen bg-rural-50 flex items-center justify-center p-6">
            <PageHead title="Resultado de la acción" path="/admin/respuesta" />
            <main className="max-w-lg w-full bg-white rounded-3xl shadow-xl p-10 md:p-12 text-center">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${accent}`}>
                    <Icon size={40} strokeWidth={2} />
                </div>
                <h1 className={`font-serif text-2xl md:text-3xl font-bold mb-2 ${titleColor}`}>{title}</h1>

                {!isError && guest && apt && (
                    <p className="text-secondary text-sm mb-6">{guest} · {apt}</p>
                )}

                {!isError && checkIn && checkOut && (
                    <div className="bg-rural-50 rounded-2xl p-5 text-left mb-6 space-y-1.5 text-sm">
                        <p><strong className="text-text-primary">Fechas:</strong> {checkIn} → {checkOut}</p>
                        {price && <p><strong className="text-text-primary">Precio:</strong> {price}</p>}
                    </div>
                )}

                {isError ? (
                    <p className="text-sm text-secondary mb-6">
                        {REASON_LABELS[reason] || 'Algo ha ido mal.'} Entra al panel de admin para gestionarla manualmente.
                    </p>
                ) : status === 'already' ? (
                    <p className="text-sm text-secondary mb-6">
                        No hemos vuelto a enviar email al huésped (operación idempotente). Si necesitas reenviarlo, hazlo desde el panel admin.
                    </p>
                ) : (
                    <p className="text-sm text-secondary mb-6">
                        Hemos enviado el email correspondiente al huésped y actualizado el calendario de disponibilidad.
                    </p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/admin" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-full text-sm font-bold hover:shadow-lg transition-all">
                        Ir al panel admin <ArrowRight size={16} />
                    </Link>
                    <Link to="/" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 text-text-primary rounded-full text-sm font-bold hover:border-primary transition-colors">
                        Volver al inicio
                    </Link>
                </div>
            </main>
        </div>
    );
};

export default AdminResponse;
